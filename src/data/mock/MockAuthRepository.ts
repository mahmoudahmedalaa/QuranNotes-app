import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { User } from '../../domain/entities/User';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MOCK_USER_KEY = '@quran_notes:mock_user';

/**
 * Mock Auth Repository - Temporary replacement for Firebase Auth
 * Uses AsyncStorage to persist a mock user session
 * This allows the app to function without Firebase Auth native modules
 */
export class MockAuthRepository implements IAuthRepository {
    private currentUser: User | null = null;
    private authStateListeners: Array<(user: User | null) => void> = [];

    async getCurrentUser(): Promise<User | null> {
        if (!this.currentUser) {
            // Try to load from storage
            const stored = await AsyncStorage.getItem(MOCK_USER_KEY);
            if (stored) {
                this.currentUser = JSON.parse(stored);
            }
        }
        return this.currentUser;
    }

    async signInAnonymously(): Promise<User> {
        const user: User = {
            id: `mock_${Date.now()}`,
            email: null,
            displayName: 'Guest User',
            isAnonymous: true,
            photoURL: null,
        };

        await this.setCurrentUser(user);
        return user;
    }

    async signInWithGoogle(): Promise<User> {
        throw new Error('Google Sign-In requires Firebase Auth native modules - coming soon');
    }

    async signInWithApple(): Promise<User> {
        throw new Error('Apple Sign-In requires Firebase Auth native modules - coming soon');
    }

    async signInWithEmail(email: string, password: string): Promise<User> {
        // Mock email login - just create a user with the email
        const user: User = {
            id: `mock_${Date.now()}`,
            email,
            displayName: email.split('@')[0],
            isAnonymous: false,
            photoURL: null,
        };

        await this.setCurrentUser(user);
        return user;
    }

    async signUpWithEmail(email: string, password: string): Promise<User> {
        // Same as sign in for mock
        return this.signInWithEmail(email, password);
    }

    async sendPasswordReset(email: string): Promise<void> {
        console.log('Mock: Password reset email would be sent to:', email);
    }

    async signOut(): Promise<void> {
        await AsyncStorage.removeItem(MOCK_USER_KEY);
        this.currentUser = null;
        this.notifyListeners(null);
    }

    onAuthStateChanged(callback: (user: User | null) => void): () => void {
        this.authStateListeners.push(callback);

        // Immediately call with current user
        this.getCurrentUser().then(user => callback(user));

        // Return unsubscribe function
        return () => {
            const index = this.authStateListeners.indexOf(callback);
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
            }
        };
    }

    private async setCurrentUser(user: User): Promise<void> {
        this.currentUser = user;
        await AsyncStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
        this.notifyListeners(user);
    }

    private notifyListeners(user: User | null): void {
        this.authStateListeners.forEach(listener => listener(user));
    }
}
