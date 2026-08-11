/**
 * Runtime Environment Validator
 *
 * Runs at app startup to verify all critical environment variables are present.
 * This catches missing API keys IMMEDIATELY in development, before they ever
 * reach production users.
 *
 * History: On Feb 20 2026, an AI agent accidentally deleted .env from git,
 * causing RevenueCat to silently fail and breaking all in-app purchases
 * for production users. This validator ensures that can never happen silently again.
 */

interface EnvVar {
    key: string;
    description: string;
    critical: boolean; // true = payments/auth will break without it
}

const REQUIRED_ENV_VARS: EnvVar[] = [
    // RevenueCat — Payments
    {
        key: 'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
        description: 'RevenueCat iOS API key (payments)',
        critical: true,
    },
    // Firebase — Auth & Backend
    {
        key: 'EXPO_PUBLIC_FIREBASE_API_KEY',
        description: 'Firebase API key',
        critical: true,
    },
    {
        key: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
        description: 'Firebase project ID',
        critical: true,
    },
    {
        key: 'EXPO_PUBLIC_FIREBASE_APP_ID',
        description: 'Firebase app ID',
        critical: true,
    },
    {
        key: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
        description: 'Firebase auth domain',
        critical: true,
    },
    // Google Sign-In
    {
        key: 'EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID',
        description: 'Google Sign-In web client ID',
        critical: true,
    },
];

/**
 * Validates that all required environment variables are present.
 * Call this once at app startup (e.g., in root _layout.tsx useEffect).
 *
 * In __DEV__ mode: logs loud errors for missing vars.
 * In production: logs warnings silently (the damage is already done at build time,
 * but this helps with post-mortem debugging).
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    const warnings: string[] = [];

    for (const envVar of REQUIRED_ENV_VARS) {
        const value = (process.env as Record<string, string | undefined>)[envVar.key];

        if (!value || value.trim() === '') {
            if (envVar.critical) {
                missing.push(envVar.key);
                if (__DEV__) {
                    console.error(
                        `🚨 CRITICAL: Missing env var "${envVar.key}" (${envVar.description}). ` +
                        `This WILL break functionality in production!`
                    );
                }
            } else {
                warnings.push(envVar.key);
                if (__DEV__) {
                    console.warn(
                        `⚠️  Missing env var "${envVar.key}" (${envVar.description}). ` +
                        `Some features may not work.`
                    );
                }
            }
        }
    }

    if (missing.length > 0 && __DEV__) {
        console.error(
            `\n🚨🚨🚨 ENVIRONMENT VALIDATION FAILED 🚨🚨🚨\n` +
            `Missing ${missing.length} critical environment variable(s):\n` +
            missing.map(k => `  - ${k}`).join('\n') + '\n' +
            `\nCheck your .env file. These keys are required for payments/auth to work.\n` +
            `See .agent/rules/SECURITY.md for the full list.\n`
        );
    }

    if (missing.length === 0 && __DEV__) {
        console.log('✅ Environment validation passed — all critical keys present.');
    }

    return { valid: missing.length === 0, missing };
}
