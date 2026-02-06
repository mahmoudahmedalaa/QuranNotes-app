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
        } catch (error) {
            console.error('Anonymous login error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const loginWithEmail = async (email: string, password: string) => {
        setLoading(true);
        try {
            const authUser = await authRepo.signInWithEmail(email, password);
            setUser(authUser);
        } catch (error) {
            console.error('Email login error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const loginWithGoogle = async () => {
        setLoading(true);
        try {
            const authUser = await authRepo.signInWithGoogle();
            setUser(authUser);
        } catch (error) {
            console.error('Google login error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const loginWithApple = async () => {
        setLoading(true);
        try {
            const authUser = await authRepo.signInWithApple();
            setUser(authUser);
        } catch (error) {
            console.error('Apple login error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const registerWithEmail = async (email: string, password: string) => {
        setLoading(true);
        try {
            const authUser = await authRepo.signUpWithEmail(email, password);
            setUser(authUser);
        } catch (error) {
            console.error('Register error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async (email: string) => {
        try {
            await authRepo.sendPasswordReset(email);
        } catch (error) {
            console.error('Password reset error:', error);
            throw error;
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            await authRepo.signOut();
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                loginAnonymously,
                loginWithEmail,
                loginWithGoogle,
                loginWithApple,
                registerWithEmail,
                resetPassword,
                logout,
            }}>
            {children}
        </AuthContext.Provider>
    );
};
