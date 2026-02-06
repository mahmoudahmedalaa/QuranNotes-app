import { useState, useEffect } from 'react';
import { User } from '../../domain/entities/User';
import { RemoteAuthRepository } from '../../data/remote/RemoteAuthRepository';
import {
    SignInAnonymouslyUseCase,
    SignOutUseCase,
    ObserveAuthStateUseCase,
} from '../../domain/usecases/auth/AuthUseCases';

const repo = new RemoteAuthRepository();
const signInAnon = new SignInAnonymouslyUseCase(repo);
const signOut = new SignOutUseCase(repo);
const observe = new ObserveAuthStateUseCase(repo);

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = observe.execute(u => {
            setUser(u);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const loginAnonymously = async () => {
        try {
            await signInAnon.execute();
        } catch (e) {
            console.error(e);
        }
    };

    const logout = async () => {
        await signOut.execute();
    };

    return { user, loading, loginAnonymously, logout };
};
