// Firebase configuration using compat layer for React Native compatibility
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    FirebaseClientConfig,
    resolveFirebaseClientConfig,
} from './FirebaseConfigResolver';

function loadNativeFirebaseOptions(): FirebaseClientConfig {
    // Keep the native import out of Jest and non-native environments. In a
    // bundled iOS Release, RNFirebase reads these values from GoogleService-Info.plist.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeFirebase = require('@react-native-firebase/app') as {
        getApp?: () => { options?: FirebaseClientConfig };
    };
    return nativeFirebase.getApp?.().options ?? {};
}

const firebaseConfig = resolveFirebaseClientConfig(
    process.env,
    process.env.NODE_ENV === 'test' ? undefined : loadNativeFirebaseOptions,
);

// Initialize Firebase (singleton)
if (!firebase.apps.length) {
    const firebaseApp = firebase.initializeApp(firebaseConfig);

    // Explicitly initialize Auth with AsyncStorage persistence to fix "removeItem" error
    // We use require() to avoid TypeScript issues with the modular SDK inside compat setup
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const authModule = require('firebase/auth');
        if (authModule && authModule.getReactNativePersistence && authModule.initializeAuth) {
            authModule.initializeAuth(firebaseApp, {
                persistence: authModule.getReactNativePersistence(AsyncStorage)
            });
        }
    } catch (e: unknown) {
        // Ignore "Auth already initialized" error which can happen with hot reload
        const err = e as { code?: string };
        if (err.code !== 'auth/already-initialized') {
            if (__DEV__) console.error('Firebase Auth initialization error:', e);
        }
    }
}

// Export auth and firestore instances
export const auth = firebase.auth();
export const db = firebase.firestore();

// For backwards compatibility with code that calls getAuth()
export const getAuth = () => auth;
export const app = firebase.app();
