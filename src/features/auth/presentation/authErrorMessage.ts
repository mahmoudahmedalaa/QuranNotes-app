const MIN_SIGN_UP_PASSWORD_LENGTH = 6;

function getAuthErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return null;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
    switch (getAuthErrorCode(error)) {
        case 'auth/email-already-in-use':
            return 'An account already exists with this email. Try signing in instead.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/weak-password':
        case 'auth/password-does-not-meet-requirements':
            return "Your password doesn't meet the requirements. Please update it and try again.";
        case 'auth/network-request-failed':
            return "We couldn't connect. Check your internet connection and try again.";
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment and try again.';
        default:
            return fallback;
    }
}

export function getSignUpPasswordError(password: string): string | null {
    if (password.length < MIN_SIGN_UP_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_SIGN_UP_PASSWORD_LENGTH} characters.`;
    }

    if (!/[A-Z]/.test(password)) {
        return 'Password must include at least one uppercase letter.';
    }

    return null;
}
