"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_MODULES } from '../lib/modules';
import { DEFAULT_CURRENCIES, DEFAULT_CURRENCY, normalizeCurrencies } from '../lib/currency';

interface Settings {
    /** Default display currency — used when only one currency is enabled, and as
     *  the starting point for the per-screen currency toggle. */
    currency: string;
    /** Currencies the user made available for display across the app. */
    currencies: string[];
    refreshInterval: number;
    notifications: boolean;
    soundAlerts: boolean;
    priceAlerts: boolean;
    modules: Record<string, boolean>;
}

interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
    currency: DEFAULT_CURRENCY,
    currencies: [...DEFAULT_CURRENCIES],
    refreshInterval: 30, // Default to 30 seconds as requested
    notifications: true,
    soundAlerts: false,
    priceAlerts: true,
    modules: DEFAULT_MODULES,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('app-settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge modules so any newly-added module defaults to enabled, and
                // repair the currency list (older saves only had a single currency).
                setSettings({
                    ...defaultSettings,
                    ...parsed,
                    modules: { ...DEFAULT_MODULES, ...(parsed.modules || {}) },
                    currencies: normalizeCurrencies(parsed.currencies, parsed.currency || defaultSettings.currency),
                });
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('app-settings', JSON.stringify(settings));
        }
    }, [settings, isLoaded]);

    const updateSettings = (newSettings: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
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
