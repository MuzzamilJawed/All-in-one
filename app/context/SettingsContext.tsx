"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { normalizeSettings, defaultSettings, type Settings } from '../lib/settingsShape';

export type { Settings };

interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
    /** False until the signed-in user's stored settings have arrived. */
    settingsLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Kept as a local cache so a reload paints the user's real preferences straight
// away instead of flashing defaults while /api/settings is in flight. The
// database is the source of truth; this is only a head start.
const CACHE_KEY = 'app-settings';

const readCache = (): Settings | null => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? normalizeSettings(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
};

const writeCache = (s: Settings) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch { /* quota / private mode */ }
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();

    const [settings, setSettings] = useState<Settings>(defaultSettings);
    // Which account's settings are currently in `settings`. `undefined` means
    // "nothing loaded yet". Signing in changes userId before the new user's
    // settings arrive, so keying on the id — rather than a plain boolean — stops
    // the save effect persisting the previous state over the incoming account.
    const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
    const settingsLoaded = loadedFor !== undefined;
    // Effects run in declaration order within one commit, so without this the
    // save effect would fire with the initial defaults still in its closure and
    // overwrite the cache before the read below had landed.
    const [hydrated, setHydrated] = useState(false);
    // Suppresses the save effect while we're applying values that came *from*
    // the server — otherwise loading would immediately write them back.
    const applyingRemote = useRef(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const userId = user?.id ?? null;

    // Paint the cached values immediately, before auth resolves.
    useEffect(() => {
        const cached = readCache();
        if (cached) {
            applyingRemote.current = true;
            setSettings(cached);
        }
        setHydrated(true);
    }, []);

    // Load this account's settings; promote the browser's cache the first time.
    useEffect(() => {
        if (authLoading) return;
        if (!userId) { setLoadedFor(null); return; }

        let active = true;
        (async () => {
            try {
                const res = await fetch('/api/settings', { cache: 'no-store' });
                const json = await res.json();
                if (!active) return;

                if (json?.success && json.hasSaved && json.data) {
                    applyingRemote.current = true;
                    setSettings(json.data);
                    writeCache(json.data);
                } else if (json?.success) {
                    // First sign-in on this account: adopt whatever this browser
                    // was already using rather than resetting them to defaults.
                    const seed = readCache() ?? defaultSettings;
                    setSettings(seed);
                    await fetch('/api/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(seed),
                    }).catch(() => { /* retried by the next change */ });
                }
            } catch {
                /* offline — carry on with the cache */
            } finally {
                if (active) setLoadedFor(userId);
            }
        })();
        return () => { active = false; };
    }, [userId, authLoading]);

    // Persist changes: cache immediately, database on a short debounce so a
    // burst of toggles is one request.
    useEffect(() => {
        if (!hydrated) return;
        if (applyingRemote.current) { applyingRemote.current = false; return; }
        writeCache(settings);
        // Never write until what we hold actually belongs to this account.
        if (!userId || loadedFor !== userId) return;

        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            }).catch(() => { /* offline — the cache still holds it */ });
        }, 600);

        return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    }, [settings, loadedFor, userId, hydrated]);

    const updateSettings = useCallback((newSettings: Partial<Settings>) => {
        setSettings(prev => normalizeSettings({ ...prev, ...newSettings }));
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, settingsLoaded }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
