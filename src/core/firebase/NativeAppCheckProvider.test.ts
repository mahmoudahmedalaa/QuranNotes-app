import {
    ReactNativeFirebaseAppCheckProvider,
    getToken,
    initializeAppCheck,
} from '@react-native-firebase/app-check';
import { getApp } from '@react-native-firebase/app';
import { createNativeAppCheckTokenProvider } from './NativeAppCheckProvider';

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn(() => ({ name: '[DEFAULT]' })) }));
jest.mock('@react-native-firebase/app-check', () => ({
    ReactNativeFirebaseAppCheckProvider: jest.fn().mockImplementation(() => ({ configure: jest.fn() })),
    initializeAppCheck: jest.fn(() => ({ app: 'check' })),
    getToken: jest.fn(async () => ({ token: 'native-token' })),
}));

describe('NativeAppCheckProvider', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each([
        ['development' as const, 'debug'],
        ['production' as const, 'appAttest'],
    ])('configures the official Apple provider for %s', async (environment, expectedProvider) => {
        const provider = createNativeAppCheckTokenProvider();
        await provider.initialize(environment);

        const nativeProvider = (ReactNativeFirebaseAppCheckProvider as jest.Mock).mock.results[0].value;
        expect(nativeProvider.configure).toHaveBeenCalledWith({ apple: { provider: expectedProvider } });
        expect(initializeAppCheck).toHaveBeenCalledWith(getApp(), {
            provider: nativeProvider,
            isTokenAutoRefreshEnabled: true,
        });
        await expect(provider.getToken()).resolves.toBe('native-token');
        expect(getToken).toHaveBeenCalledWith({ app: 'check' }, false);
    });

    it('declares the required Expo plugins, static frameworks, deployment target, and entitlement', () => {
        const appJson = require('../../../app.json').expo;
        expect(appJson.plugins).toEqual(expect.arrayContaining([
            ['@react-native-firebase/app', { ios: { disableSPM: true } }],
            '@react-native-firebase/app-check',
            ['expo-build-properties', {
                ios: {
                    deploymentTarget: '15.1',
                    useFrameworks: 'static',
                    forceStaticLinking: ['RNFBApp', 'RNFBAppCheck'],
                },
            }],
        ]));
        expect(appJson.ios.entitlements['com.apple.developer.devicecheck.appattest-environment']).toBe('production');
    });
});
