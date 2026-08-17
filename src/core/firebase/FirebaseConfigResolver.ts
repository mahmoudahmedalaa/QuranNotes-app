export interface FirebaseClientConfig {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
}

type FirebaseEnvironment = Record<string, string | undefined>;
type NativeOptionsLoader = () => FirebaseClientConfig;

function clean(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function fromEnvironment(environment: FirebaseEnvironment): FirebaseClientConfig {
    return {
        apiKey: clean(environment.EXPO_PUBLIC_FIREBASE_API_KEY),
        authDomain: clean(environment.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
        projectId: clean(environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
        storageBucket: clean(environment.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
        messagingSenderId: clean(environment.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
        appId: clean(environment.EXPO_PUBLIC_FIREBASE_APP_ID),
    };
}

function hasRequiredFirebaseValues(config: FirebaseClientConfig): boolean {
    return Boolean(config.apiKey && config.projectId && config.appId);
}

export function resolveFirebaseClientConfig(
    environment: FirebaseEnvironment,
    loadNativeOptions?: NativeOptionsLoader,
): FirebaseClientConfig {
    const environmentConfig = fromEnvironment(environment);
    if (hasRequiredFirebaseValues(environmentConfig) || !loadNativeOptions) {
        return environmentConfig;
    }

    let nativeConfig: FirebaseClientConfig = {};
    try {
        nativeConfig = loadNativeOptions();
    } catch {
        return environmentConfig;
    }

    return {
        apiKey: environmentConfig.apiKey ?? clean(nativeConfig.apiKey),
        authDomain: environmentConfig.authDomain ?? clean(nativeConfig.authDomain),
        projectId: environmentConfig.projectId ?? clean(nativeConfig.projectId),
        storageBucket: environmentConfig.storageBucket ?? clean(nativeConfig.storageBucket),
        messagingSenderId: environmentConfig.messagingSenderId ?? clean(nativeConfig.messagingSenderId),
        appId: environmentConfig.appId ?? clean(nativeConfig.appId),
    };
}
