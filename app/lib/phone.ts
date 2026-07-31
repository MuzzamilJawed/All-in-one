// Phone handling shared by the sign-up form, the register API and the profile
// screen so they all agree on what's acceptable.
//
// Deliberately permissive: numbers here are Pakistani (+92 3xx xxxxxxx), Gulf
// and international, and strict per-country rules reject more valid numbers
// than they catch bad ones. We only check the shape.

/** Strips formatting, keeping a leading + and the digits. */
export const normalizePhone = (raw: string): string => {
    const trimmed = String(raw || '').trim();
    const plus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    return digits ? `${plus ? '+' : ''}${digits}` : '';
};

/** Returns a message when the number is unusable, or null when it's fine. */
export const phoneProblem = (raw: string): string | null => {
    const value = normalizePhone(raw);
    if (!value) return 'Enter your phone number';
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7) return 'That phone number looks too short';
    if (digits.length > 15) return 'That phone number looks too long';
    return null;
};
