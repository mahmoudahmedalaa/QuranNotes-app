import { resolveFirebaseClientConfig } from './FirebaseConfigResolver';

const COMPLETE_ENV = {
    EXPO_PUBLIC_FIREBASE_API_KEY: 'env-api-key',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'env-auth.example',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'env-project',
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'env-bucket',
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'env-sender',
    EXPO_PUBLIC_FIREBASE_APP_ID: 'env-app-id',
};

describe('resolveFirebaseClientConfig', () => {
    it('uses complete bundle-time environment values without loading native options', () => {
        const loadNativeOptions = jest.fn(() => ({ apiKey: 'native-api-key' }));

        expect(resolveFirebaseClientConfig(COMPLETE_ENV, loadNativeOptions)).toEqual({
            apiKey: 'env-api-key',
            authDomain: 'env-auth.example',
            projectId: 'env-project',
            storageBucket: 'env-bucket',
            messagingSenderId: 'env-sender',
            appId: 'env-app-id',
        });
        expect(loadNativeOptions).not.toHaveBeenCalled();
    });

    it('fills missing release values from native Firebase options', () => {
        const loadNativeOptions = jest.fn(() => ({
            apiKey: 'native-api-key',
            appId: 'native-app-id',
            messagingSenderId: 'native-sender',
            projectId: 'native-project',
            storageBucket: 'native-bucket',
        }));

        expect(resolveFirebaseClientConfig({}, loadNativeOptions)).toEqual({
            apiKey: 'native-api-key',
            authDomain: undefined,
            projectId: 'native-project',
            storageBucket: 'native-bucket',
            messagingSenderId: 'native-sender',
            appId: 'native-app-id',
        });
        expect(loadNativeOptions).toHaveBeenCalledTimes(1);
    });

    it('keeps environment overrides while filling only missing values', () => {
        const loadNativeOptions = jest.fn(() => ({
            apiKey: 'native-api-key',
            appId: 'native-app-id',
            projectId: 'native-project',
        }));

        expect(resolveFirebaseClientConfig({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'override-project' }, loadNativeOptions))
            .toMatchObject({
                apiKey: 'native-api-key',
                appId: 'native-app-id',
                projectId: 'override-project',
            });
    });

    it('fails closed to environment values when native option loading throws', () => {
        expect(resolveFirebaseClientConfig(
            { EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'env-project' },
            () => { throw new Error('native unavailable'); },
        )).toMatchObject({
            apiKey: undefined,
            appId: undefined,
            projectId: 'env-project',
        });
    });
});
