// Firebase configuration using compat layer for React Native compatibility
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration from environment
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton)
if (!firebase.apps.length) {
    const app = firebase.initializeApp(firebaseConfig);

    // Explicitly initialize Auth with AsyncStorage persistence to fix "removeItem" error
    // We use require() to avoid TypeScript issues with the modular SDK inside compat setup
    try {
        const authModule = require('firebase/auth');
        if (authModule && authModule.getReactNativePersistence && authModule.initializeAuth) {
            authModule.initializeAuth(app, {
                persistence: authModule.getReactNativePersistence(AsyncStorage)
            });
        }
    } catch (e: any) {
        // Ignore "Auth already initialized" error which can happen with hot reload
        if (e.code !== 'auth/already-initialized') {
            console.error('Firebase Auth initialization error:', e);
        }
    }
}

// Export auth and firestore instances
export const auth = firebase.auth();
export const db = firebase.firestore();

// For backwards compatibility with code that calls getAuth()
export const getAuth = () => auth;
export const app = firebase.app();
