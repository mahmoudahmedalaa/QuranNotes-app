import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../../domain/entities/User';
import { RemoteAuthRepository } from '../../data/remote/RemoteAuthRepository';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    loginAnonymously: () => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    loginWithApple: () => Promise<void>;
    registerWithEmail: (email: string, pass: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: false,
    loginAnonymously: async () => { },
    loginWithEmail: async () => { },
    loginWithGoogle: async () => { },
    loginWithApple: async () => { },
    registerWithEmail: async () => { },
    resetPassword: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const authRepo = new RemoteAuthRepository();

    useEffect(() => {
        // Listen to auth state changes
        const unsubscribe = authRepo.onAuthStateChanged((authUser) => {
            setUser(authUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loginAnonymously = async () => {
        setLoading(true);
        try {
            const authUser = await authRepo.signInAnonymously();
            setUser(authUser);
        } catch (e) {
            console.error('[AuthContext] loginAnonymously error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const loginWithEmail = async (email: string, pass: string) => {
        setLoading(true);
        try {
            const authUser = await authRepo.signInWithEmail(email, pass);
            setUser(authUser);
        } catch (e) {
            console.error('[AuthContext] loginWithEmail error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const loginWithGoogle = async () => {
        setLoading(true);
        try {
            // Force sign out first to ensure clean state
            await authRepo.signOut();
            const authUser = await authRepo.signInWithGoogle();
            setUser(authUser);
        } catch (e) {
            console.error('[AuthContext] loginWithGoogle error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const loginWithApple = async () => {
        setLoading(true);
        try {
            // Force sign out first to ensure clean state
            await authRepo.signOut();
            const authUser = await authRepo.signInWithApple();
            setUser(authUser);
        } catch (e) {
            console.error('[AuthContext] loginWithApple error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const registerWithEmail = async (email: string, pass: string) => {
        setLoading(true);
        try {
            const authUser = await authRepo.signUpWithEmail(email, pass);
            setUser(authUser);
        } catch (e) {
            console.error('[AuthContext] registerWithEmail error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async (email: string) => {
        try {
            await authRepo.sendPasswordReset(email);
        } catch (e) {
            console.error('[AuthContext] resetPassword error:', e);
            throw e;
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            await authRepo.signOut();
            setUser(null);

            // Clear welcome state for next user (Device Global)
            await AsyncStorage.removeItem('hasSeenWelcome');

        } catch (e) {
            console.error('[AuthContext] logout error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        loginAnonymously,
        loginWithEmail,
        loginWithGoogle,
        loginWithApple,
        registerWithEmail,
        resetPassword,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
