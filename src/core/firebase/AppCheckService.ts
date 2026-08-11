export interface AppCheckTokenProvider {
    initialize(environment: 'development' | 'production'): Promise<void>;
    getToken(forceRefresh?: boolean): Promise<string>;
}

export type AppCheckErrorCode = 'app_check_unavailable';

export class AppCheckError extends Error {
    readonly code: AppCheckErrorCode = 'app_check_unavailable';

    constructor() {
        super('App verification is unavailable.');
        this.name = 'AppCheckError';
    }
}

let provider: AppCheckTokenProvider | null = null;
let initializationPromise: Promise<void> | null = null;

export function configureAppCheckProvider(nextProvider: AppCheckTokenProvider): void {
    provider = nextProvider;
    initializationPromise = null;
}

export async function initializeQuranNotesAppCheck(): Promise<void> {
    if (!provider) throw new AppCheckError();
    if (!initializationPromise) {
        const configuredProvider = provider;
        initializationPromise = configuredProvider
            .initialize(__DEV__ ? 'development' : 'production')
            .catch(() => {
                throw new AppCheckError();
            });
    }
    return initializationPromise;
}

export async function getQuranNotesAppCheckToken(forceRefresh = false): Promise<string> {
    await initializeQuranNotesAppCheck();
    if (!provider) throw new AppCheckError();
    try {
        const token = await provider.getToken(forceRefresh);
        if (!token) throw new AppCheckError();
        return token;
    } catch {
        throw new AppCheckError();
    }
}

export function resetAppCheckForTests(): void {
    provider = null;
    initializationPromise = null;
}
