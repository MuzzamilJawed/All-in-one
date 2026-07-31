"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { migrateLocalDataToAccount } from "../lib/migrateLocal";

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    image: string | null;
    role: "admin" | "user";
    providers: string[];
}

interface AuthState {
    user: AuthUser | null;
    loading: boolean;
    /** Null when the server has no GOOGLE_CLIENT_ID — the Google button hides. */
    googleClientId: string | null;
    signIn: (email: string, password: string) => Promise<string | null>;
    signUp: (name: string, email: string, phone: string, password: string) => Promise<string | null>;
    signInWithGoogle: (credential: string) => Promise<string | null>;
    signOut: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [googleClientId, setGoogleClientId] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch("/api/auth/me", { cache: "no-store" });
            const json = await res.json();
            setUser(json?.data ?? null);
            setGoogleClientId(json?.config?.googleClientId ?? null);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // Shared tail of every sign-in path: adopt this browser's legacy
    // localStorage data, then publish the user. Returns an error string, or
    // null on success — the forms render whatever comes back.
    const complete = useCallback(async (res: Response): Promise<string | null> => {
        let json: any = null;
        try { json = await res.json(); } catch { /* non-JSON error page */ }
        if (!json?.success) return json?.error || "Something went wrong — please try again.";
        await migrateLocalDataToAccount();
        setUser(json.data);
        setLoading(false);
        return null;
    }, []);

    const post = (url: string, body: unknown) =>
        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

    const signIn = useCallback(async (email: string, password: string) => {
        try { return await complete(await post("/api/auth/login", { email, password })); }
        catch { return "Network error — couldn't reach the server."; }
    }, [complete]);

    const signUp = useCallback(async (name: string, email: string, phone: string, password: string) => {
        try { return await complete(await post("/api/auth/register", { name, email, phone, password })); }
        catch { return "Network error — couldn't reach the server."; }
    }, [complete]);

    const signInWithGoogle = useCallback(async (credential: string) => {
        try { return await complete(await post("/api/auth/google", { credential })); }
        catch { return "Network error — couldn't reach the server."; }
    }, [complete]);

    const signOut = useCallback(async () => {
        try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* clear locally anyway */ }
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, googleClientId, signIn, signUp, signInWithGoogle, signOut, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
    return ctx;
}
