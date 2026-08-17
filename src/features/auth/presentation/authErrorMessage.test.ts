import { getAuthErrorMessage, getSignUpPasswordError } from './authErrorMessage';

const SIGN_UP_FALLBACK = "We couldn't create your account. Please try again.";

describe('getAuthErrorMessage', () => {
    it.each([
        ['auth/email-already-in-use', 'An account already exists with this email. Try signing in instead.'],
        ['auth/invalid-email', 'Please enter a valid email address.'],
        ['auth/weak-password', "Your password doesn't meet the requirements. Please update it and try again."],
        ['auth/password-does-not-meet-requirements', "Your password doesn't meet the requirements. Please update it and try again."],
        ['auth/network-request-failed', "We couldn't connect. Check your internet connection and try again."],
        ['auth/too-many-requests', 'Too many attempts. Please wait a moment and try again.'],
    ])('maps %s to user-facing copy', (code, expected) => {
        expect(getAuthErrorMessage({ code }, SIGN_UP_FALLBACK)).toBe(expected);
    });

    it('uses the safe fallback without exposing a raw provider message', () => {
        const error = new Error('Firebase: Internal provider details (auth/internal-error).');
        Object.assign(error, { code: 'auth/internal-error' });

        expect(getAuthErrorMessage(error, SIGN_UP_FALLBACK)).toBe(SIGN_UP_FALLBACK);
    });

    it('uses the safe fallback for non-error values', () => {
        expect(getAuthErrorMessage('Firebase failed', SIGN_UP_FALLBACK)).toBe(SIGN_UP_FALLBACK);
    });
});

describe('getSignUpPasswordError', () => {
    it('requires at least six characters', () => {
        expect(getSignUpPasswordError('Ab123')).toBe('Password must be at least 6 characters.');
    });

    it('requires at least one uppercase letter', () => {
        expect(getSignUpPasswordError('qwerty123456')).toBe('Password must include at least one uppercase letter.');
    });

    it('accepts a password that meets the current requirements', () => {
        expect(getSignUpPasswordError('Qwerty123456')).toBeNull();
    });
});
