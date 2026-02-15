import { auth, db } from '../../infrastructure/firebase/config';
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { User } from '../../domain/entities/User';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
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
            // Import Google Sign-In
            const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

            // Configure Google Sign-In
            GoogleSignin.configure({
                webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID,
            });

            // Sign in with Google
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();


            const idToken = response.data?.idToken;

            if (!idToken) {
                console.error('[Google Sign-In] No ID token in response:', JSON.stringify(response));
                throw new Error('No ID token received from Google');
            }


            // Create Firebase credential using compat API
            const googleCredential = firebase.auth.GoogleAuthProvider.credential(idToken);


            // Sign in to Firebase
            const credential = await auth.signInWithCredential(googleCredential);


            return this.mapUser(credential.user)!;
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string };
            if (__DEV__) console.error('[Google Sign-In] Error:', err.code, err.message, error);
            throw new Error('Google Sign-In failed: ' + (err.message || 'Unknown error'));
        }
    }

    async signInWithApple(): Promise<User> {
        try {
            // Import Apple Authentication
            const AppleAuthentication = await import('expo-apple-authentication');


            // Sign in with Apple - use numeric values for scopes
            // AppleAuthenticationScope: FULL_NAME = 0, EMAIL = 1
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [0, 1],
            });


            if (!credential.identityToken) {
                throw new Error('No identity token received from Apple');
            }

            // Create Firebase credential using compat API
            const provider = new firebase.auth.OAuthProvider('apple.com');
            const appleCredential = provider.credential({
                idToken: credential.identityToken,
            });


            // Sign in to Firebase
            const firebaseCredential = await auth.signInWithCredential(appleCredential);


            return this.mapUser(firebaseCredential.user)!;
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string };
            if (__DEV__) console.error('[Apple Sign-In] Error:', err.code, err.message, error);
            if (err.code === 'ERR_CANCELED') {
                throw new Error('Apple Sign-In was cancelled');
            }
            throw new Error('Apple Sign-In failed: ' + (err.message || 'Unknown error'));
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

    /**
     * Returns the primary sign-in provider for the current user.
     * Used by the UI to decide which re-auth flow to show.
     */
    getSignInProvider(): 'google.com' | 'apple.com' | 'password' | 'anonymous' | null {
        const currentUser = auth.currentUser;
        if (!currentUser) return null;
        if (currentUser.isAnonymous) return 'anonymous';
        const providers = currentUser.providerData.map((p: firebase.UserInfo | null) => p?.providerId).filter(Boolean);
        if (providers.includes('google.com')) return 'google.com';
        if (providers.includes('apple.com')) return 'apple.com';
        if (providers.includes('password')) return 'password';
        return 'anonymous'; // fallback — treat unrecognized as anonymous
    }

    /**
     * Re-authenticate email/password user with their password,
     * then immediately delete the account and all data.
     */
    async reauthenticateWithPasswordAndDelete(password: string): Promise<void> {
        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) {
            throw new Error('No user or email found.');
        }

        // Re-authenticate
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            password,
        );
        await currentUser.reauthenticateWithCredential(credential);

        // Now delete data + account
        await this.deleteUserDataAndAccount(currentUser);
    }

    /**
     * Delete all user data from Firestore, then delete the Firebase Auth account.
     * This should only be called AFTER successful re-authentication.
     */
    private async deleteUserDataAndAccount(currentUser: firebase.User): Promise<void> {
        const uid = currentUser.uid;

        // Step 1: Delete all user data from Firestore
        const collectionsToDelete = ['notes', 'recordings', 'folders'];
        for (const col of collectionsToDelete) {
            try {
                const q = query(collection(db, col), where('userId', '==', uid));
                const snapshot = await getDocs(q);
                const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, col, d.id)));
                await Promise.all(deletePromises);
            } catch (error: unknown) {
                const errMsg = error instanceof Error ? error.message : String(error);
                if (__DEV__) console.warn(`[DeleteAccount] Failed to delete ${col}:`, errMsg);
            }
        }

        // Step 2: Delete the Firebase Auth account (re-auth already done)
        await currentUser.delete();
        if (__DEV__) console.log('[DeleteAccount] Account and data deleted successfully');
    }

    async deleteAccount(): Promise<void> {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('No user is currently signed in.');
        }

        // Determine provider and re-authenticate FIRST
        const provider = this.getSignInProvider();

        if (provider === 'anonymous') {
            // Anonymous users: delete Firestore data and sign out.
            // The anonymous auth record will be cleaned up by Firebase automatically.
            const uid = currentUser.uid;
            const collectionsToDelete = ['notes', 'recordings', 'folders'];
            for (const col of collectionsToDelete) {
                try {
                    const q = query(collection(db, col), where('userId', '==', uid));
                    const snapshot = await getDocs(q);
                    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, col, d.id)));
                    await Promise.all(deletePromises);
                } catch (error: unknown) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    if (__DEV__) console.warn(`[DeleteAccount] Failed to delete ${col}:`, errMsg);
                    // If credential expired, just skip data cleanup — sign out will still work
                }
            }
            // Try to delete the auth account directly; if token is expired, just sign out
            try {
                await currentUser.delete();
            } catch (deleteErr: unknown) {
                const errCode = (deleteErr as { code?: string })?.code;
                if (__DEV__) console.warn('[DeleteAccount] Anonymous delete failed, signing out:', errCode);
                // auth/requires-recent-login or auth/invalid-login-credentials — just sign out
            }
            await auth.signOut();
            return;
        }

        if (provider === 'google.com') {
            try {
                const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
                GoogleSignin.configure({
                    webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID,
                });
                await GoogleSignin.hasPlayServices();
                const response = await GoogleSignin.signIn();
                const idToken = response.data?.idToken;
                if (!idToken) throw new Error('Google re-authentication failed.');
                const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
                await currentUser.reauthenticateWithCredential(credential);
            } catch (error: unknown) {
                if (__DEV__) console.error('[DeleteAccount] Google re-auth failed:', error);
                throw new Error('Google re-authentication failed. Please try again.');
            }
        } else if (provider === 'apple.com') {
            try {
                const AppleAuthentication = await import('expo-apple-authentication');
                const appleCredential = await AppleAuthentication.signInAsync({
                    requestedScopes: [0, 1],
                });
                if (!appleCredential.identityToken) throw new Error('Apple re-authentication failed.');
                const oauthProvider = new firebase.auth.OAuthProvider('apple.com');
                const credential = oauthProvider.credential({
                    idToken: appleCredential.identityToken,
                });
                await currentUser.reauthenticateWithCredential(credential);
            } catch (error: unknown) {
                if (__DEV__) console.error('[DeleteAccount] Apple re-auth failed:', error);
                throw new Error('Apple re-authentication failed. Please try again.');
            }
        } else if (provider === 'password') {
            // Email/password users need to provide their password.
            // Throw a specific error that the UI layer can handle.
            const err: Error & { code?: string } = new Error('Password required for re-authentication.');
            err.code = 'auth/needs-password';
            throw err;
        }

        // Re-auth succeeded — delete data + account
        await this.deleteUserDataAndAccount(currentUser);
    }

    async signOut(): Promise<void> {
        await auth.signOut();
    }

    onAuthStateChanged(callback: (user: User | null) => void): () => void {
        return auth.onAuthStateChanged((user: firebase.User | null) => {
            callback(this.mapUser(user));
        });
    }
}
