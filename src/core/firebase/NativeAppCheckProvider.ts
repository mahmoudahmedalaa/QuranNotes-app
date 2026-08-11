import { getApp } from '@react-native-firebase/app';
import {
    ReactNativeFirebaseAppCheckProvider,
    getToken,
    initializeAppCheck,
} from '@react-native-firebase/app-check';
import type { AppCheckTokenProvider } from './AppCheckService';

export function createNativeAppCheckTokenProvider(): AppCheckTokenProvider {
    let appCheckInstance: ReturnType<typeof initializeAppCheck> | null = null;

    return {
        async initialize(environment): Promise<void> {
            const provider = new ReactNativeFirebaseAppCheckProvider();
            provider.configure({
                apple: {
                    provider: environment === 'development' ? 'debug' : 'appAttest',
                },
            });
            appCheckInstance = initializeAppCheck(getApp(), {
                provider,
                isTokenAutoRefreshEnabled: true,
            });
        },
        async getToken(forceRefresh = false): Promise<string> {
            if (!appCheckInstance) throw new Error('App Check has not initialized.');
            const result = await getToken(appCheckInstance, forceRefresh);
            return result.token;
        },
    };
}

export const nativeAppCheckTokenProvider = createNativeAppCheckTokenProvider();
