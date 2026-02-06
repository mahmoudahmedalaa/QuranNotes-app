import { auth } from '../../infrastructure/firebase/config';
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { User } from '../../domain/entities/User';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

export class RemoteAuthRepository implements IAuthRepository {

    private mapUser(firebaseUser: firebase.User | null): User | null {
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
        return this.mapUser(auth.currentUser);
    }

    async signInAnonymously(): Promise<User> {
        const credential = await auth.signInAnonymously();
        return this.mapUser(credential.user)!;
    }

    async signInWithGoogle(): Promise<User> {
        try {
            console.log('[Google Sign-In] Starting Google authentication...');
            // Import Google Sign-In
            const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

            // Configure Google Sign-In
            GoogleSignin.configure({
                webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID,
            });

            // Sign in with Google
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();

            console.log('[Google Sign-In] Got response:', !!response);

            const idToken = response.data?.idToken;

            if (!idToken) {
                console.error('[Google Sign-In] No ID token in response:', JSON.stringify(response));
                throw new Error('No ID token received from Google');
            }

            console.log('[Google Sign-In] Got ID Token, creating credential...');

            // Create Firebase credential using compat API
            const googleCredential = firebase.auth.GoogleAuthProvider.credential(idToken);

            console.log('[Google Sign-In] Signing in to Firebase...');

            // Sign in to Firebase
            const credential = await auth.signInWithCredential(googleCredential);

            console.log('[Google Sign-In] Success! User:', credential.user?.uid);

            return this.mapUser(credential.user)!;
        } catch (error: any) {
            console.error('[Google Sign-In] Error:', error.code, error.message, error);
            throw new Error('Google Sign-In failed: ' + (error.message || 'Unknown error'));
        }
    }

    async signInWithApple(): Promise<User> {
        try {
            // Import Apple Authentication
            const AppleAuthentication = await import('expo-apple-authentication');

            console.log('[Apple Sign-In] Starting Apple authentication...');

            // Sign in with Apple - use numeric values for scopes
            // AppleAuthenticationScope: FULL_NAME = 0, EMAIL = 1
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [0, 1],
            });

            console.log('[Apple Sign-In] Got Apple credential, identityToken:', !!credential.identityToken);

            if (!credential.identityToken) {
                throw new Error('No identity token received from Apple');
            }

            // Create Firebase credential using compat API
            const provider = new firebase.auth.OAuthProvider('apple.com');
            const appleCredential = provider.credential({
                idToken: credential.identityToken,
            });

            console.log('[Apple Sign-In] Signing in to Firebase...');

            // Sign in to Firebase
            const firebaseCredential = await auth.signInWithCredential(appleCredential);

            console.log('[Apple Sign-In] Success! User:', firebaseCredential.user?.uid);

            return this.mapUser(firebaseCredential.user)!;
        } catch (error: any) {
            console.error('[Apple Sign-In] Error:', error.code, error.message, error);
            if (error.code === 'ERR_CANCELED') {
                throw new Error('Apple Sign-In was cancelled');
            }
            throw new Error('Apple Sign-In failed: ' + (error.message || 'Unknown error'));
        }
    }

    async signInWithEmail(email: string, password: string): Promise<User> {
        const credential = await auth.signInWithEmailAndPassword(email, password);
        return this.mapUser(credential.user)!;
    }

    async signUpWithEmail(email: string, password: string): Promise<User> {
        const credential = await auth.createUserWithEmailAndPassword(email, password);
        // Send verification email
        if (credential.user) {
            await credential.user.sendEmailVerification();
        }
        // Sign out the user immediately - they need to verify email first
        await auth.signOut();
        return this.mapUser(credential.user)!;
    }

    async isEmailVerified(): Promise<boolean> {
        const currentUser = auth.currentUser;
        if (!currentUser) return false;
        // Reload to get latest verification status
        await currentUser.reload();
        return currentUser.emailVerified;
    }

    async resendVerificationEmail(): Promise<void> {
        const currentUser = auth.currentUser;
        if (currentUser && !currentUser.emailVerified) {
            await currentUser.sendEmailVerification();
        }
    }

    async sendPasswordReset(email: string): Promise<void> {
        await auth.sendPasswordResetEmail(email);
    }

    async signOut(): Promise<void> {
        await auth.signOut();
    }

    onAuthStateChanged(callback: (user: User | null) => void): () => void {
        return auth.onAuthStateChanged(user => {
            callback(this.mapUser(user));
        });
    }
}
