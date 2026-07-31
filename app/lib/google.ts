// Verifies a Google Identity Services ID token (the `credential` the one-tap /
// sign-in button hands back) against Google's tokeninfo endpoint, then checks
// issuer, audience, expiry and email verification ourselves.

const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export interface GoogleProfile {
    sub: string;
    email: string;
    name: string;
    picture?: string;
}

export function googleClientId(): string | null {
    return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
    const clientId = googleClientId();
    if (!clientId) throw new Error('Google sign-in is not configured on this server.');
    if (!idToken) throw new Error('Missing Google credential.');

    const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        { cache: 'no-store' },
    );
    if (!res.ok) throw new Error('Google rejected this sign-in token.');

    const info: Record<string, string> = await res.json();

    if (!ISSUERS.has(info.iss)) throw new Error('Unexpected token issuer.');
    if (info.aud !== clientId) throw new Error('This token was issued for a different app.');
    if (Number(info.exp) * 1000 < Date.now()) throw new Error('Google sign-in token has expired.');
    if (info.email_verified !== 'true' && (info.email_verified as unknown) !== true) {
        throw new Error('This Google account has no verified email address.');
    }
    if (!info.email || !info.sub) throw new Error('Google returned an incomplete profile.');

    return {
        sub: info.sub,
        email: info.email.toLowerCase(),
        name: info.name || info.given_name || info.email.split('@')[0],
        picture: info.picture,
    };
}
