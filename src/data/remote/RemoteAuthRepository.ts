import {
    signInAnonymously as firebaseSignInAnonymously,
    signOut as firebaseSignOut,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    User as FirebaseUser,
    Auth,
} from 'firebase/auth';
import { getAuth } from '../../infrastructure/firebase/config';
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { User } from '../../domain/entities/User';

export class RemoteAuthRepository implements IAuthRepository {

    private mapUser(firebaseUser: FirebaseUser | null): User | null {
        if (!firebaseUser) return null;
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            isAnonymous: firebaseUser.isAnonymous,
            photoURL: firebaseUser.photoURL,
        };
    }

    async getCurrentUser(): Promise<User | null> {
        return this.mapUser(getAuth().currentUser);
    }

    async signInAnonymously(): Promise<User> {
        const credential = await firebaseSignInAnonymously(getAuth());
        return this.mapUser(credential.user)!;
    }

    async signInWithGoogle(): Promise<User> {
        try {
            // Import Google Sign-In
            const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
            const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');

            // Configure Google Sign-In
            GoogleSignin.configure({
                webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID, // From Firebase Console
            });

            // Sign in with Google
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();
            const idToken = response.data?.idToken;

            if (!idToken) {
                throw new Error('No ID token received from Google');
            }

            // Create Firebase credential
            const googleCredential = GoogleAuthProvider.credential(idToken);

            // Sign in to Firebase
            const credential = await signInWithCredential(getAuth(), googleCredential);
            return this.mapUser(credential.user)!;
        } catch (error) {
            console.error('Google Sign-In error:', error);
            throw new Error('Google Sign-In failed');
        }
    }

    async signInWithApple(): Promise<User> {
        try {
            // Import Apple Authentication
            const AppleAuthentication = await import('expo-apple-authentication');
            const { OAuthProvider, signInWithCredential } = await import('firebase/auth');

            // Sign in with Apple
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            // Create Firebase credential
            const provider = new OAuthProvider('apple.com');
            const appleCredential = provider.credential({
                idToken: credential.identityToken!,
            });

            // Sign in to Firebase
            const firebaseCredential = await signInWithCredential(getAuth(), appleCredential);
            return this.mapUser(firebaseCredential.user)!;
        } catch (error) {
            console.error('Apple Sign-In error:', error);
            throw new Error('Apple Sign-In failed');
        }
    }

    async signInWithEmail(email: string, password: string): Promise<User> {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const credential = await signInWithEmailAndPassword(getAuth(), email, password);
        return this.mapUser(credential.user)!;
    }

    async signUpWithEmail(email: string, password: string): Promise<User> {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        const credential = await createUserWithEmailAndPassword(getAuth(), email, password);
        return this.mapUser(credential.user)!;
    }

    async sendPasswordReset(email: string): Promise<void> {
        const { sendPasswordResetEmail } = await import('firebase/auth');
        await sendPasswordResetEmail(getAuth(), email);
    }

    async signOut(): Promise<void> {
        await firebaseSignOut(getAuth());
    }

    onAuthStateChanged(callback: (user: User | null) => void): () => void {
        return firebaseOnAuthStateChanged(getAuth(), user => {
            callback(this.mapUser(user));
        });
    }
}
