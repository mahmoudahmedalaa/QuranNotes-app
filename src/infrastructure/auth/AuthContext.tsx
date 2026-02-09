import React, { createContext, useContext, useState, useEffect } from 'react';

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
    deleteAccount: () => Promise<void>;
    reauthenticateAndDelete: (password?: string) => Promise<void>;
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
    deleteAccount: async () => { },
    reauthenticateAndDelete: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const authRepo = new RemoteAuthRepository();
    // Flag to suppress onAuthStateChanged during registration
    // (Firebase briefly sets user before signOut completes)
    const isRegistering = React.useRef(false);

    useEffect(() => {
        // Listen to auth state changes
        const unsubscribe = authRepo.onAuthStateChanged((authUser) => {
            if (isRegistering.current) {
                // During registration, ignore auth state changes
                return;
            }
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
        isRegistering.current = true;
        try {
            // signUpWithEmail creates account, sends verification email, and signs out.
            // We do NOT set user here — the user must verify email and then log in.
            await authRepo.signUpWithEmail(email, pass);
        } catch (e) {
            console.error('[AuthContext] registerWithEmail error:', e);
            throw e;
        } finally {
            isRegistering.current = false;
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
        } catch (e) {
            console.error('[AuthContext] logout error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const deleteAccount = async () => {
        setLoading(true);
        try {
            await authRepo.deleteAccount();
            setUser(null);
        } catch (e) {
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const reauthenticateAndDelete = async (password?: string) => {
        setLoading(true);
        try {
            await authRepo.reauthenticateAndDelete(password);
            setUser(null);
        } catch (e) {
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
        deleteAccount,
        reauthenticateAndDelete,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
