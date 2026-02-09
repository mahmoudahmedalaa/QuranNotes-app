import { User } from '../entities/User';

export interface IAuthRepository {
    getCurrentUser(): Promise<User | null>;
    signInAnonymously(): Promise<User>;
    signInWithGoogle(): Promise<User>;
    signInWithEmail(email: string, password: string): Promise<User>;
    signUpWithEmail(email: string, password: string): Promise<User>;
    sendPasswordReset(email: string): Promise<void>;
    signOut(): Promise<void>;
    deleteAccount(): Promise<void>;
    reauthenticateAndDelete(password?: string): Promise<void>;
    onAuthStateChanged(callback: (user: User | null) => void): () => void;
}
