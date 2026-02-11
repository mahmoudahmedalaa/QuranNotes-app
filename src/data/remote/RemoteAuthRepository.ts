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

    async deleteAccount(): Promise<void> {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('No user is currently signed in.');
        }

        const uid = currentUser.uid;
        const providers = (currentUser.providerData || []).filter(p => p != null).map(p => p.providerId);
        console.log('[DeleteAccount] Starting for user:', uid);
        console.log('[DeleteAccount] Providers:', JSON.stringify(providers));
        console.log('[DeleteAccount] isAnonymous:', currentUser.isAnonymous);

        // Step 1: Delete all Firestore user data FIRST (before auth deletion)
        const collectionsToDelete = ['notes', 'recordings', 'folders'];
        for (const col of collectionsToDelete) {
            try {
                const q = query(collection(db, col), where('userId', '==', uid));
                const snapshot = await getDocs(q);
                const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, col, d.id)));
                await Promise.all(deletePromises);
                console.log(`[DeleteAccount] Deleted ${snapshot.size} docs from ${col}`);
            } catch (error: any) {
                console.warn(`[DeleteAccount] Failed to delete ${col}:`, error.message);
            }
        }

        // Step 2: Try to delete auth account directly (works if recently signed in)
        try {
            await currentUser.delete();
            console.log('[DeleteAccount] Account deleted directly (no re-auth needed)');
            return;
        } catch (error: any) {
            if (error.code !== 'auth/requires-recent-login') {
                throw error;
            }
            console.log('[DeleteAccount] Requires re-auth — will sign in fresh');
        }

        // Step 3: Sign in fresh to get a new auth session
        // KEY FIX: Use signInWithCredential (NOT reauthenticateWithCredential)
        // reauthenticateWithCredential requires a nonce for Apple which we don't have.
        // signInWithCredential creates a brand new fresh session.
        // On iOS, try Apple first (most common), then Google, then anonymous.
        let signedInFresh = false;

        // Try Apple Sign-In (works for most iOS users regardless of providerData)
        if (!signedInFresh) {
            try {
                const AppleAuthentication = await import('expo-apple-authentication');
                const isAvailable = await AppleAuthentication.isAvailableAsync();
                if (isAvailable) {
                    console.log('[DeleteAccount] Trying Apple Sign-In for re-auth...');
                    const appleResult = await AppleAuthentication.signInAsync({
                        requestedScopes: [0, 1],
                    });
                    if (appleResult.identityToken) {
                        const provider = new firebase.auth.OAuthProvider('apple.com');
                        const credential = provider.credential({
                            idToken: appleResult.identityToken,
                        });
                        await auth.signInWithCredential(credential);
                        signedInFresh = true;
                        console.log('[DeleteAccount] Apple re-auth successful via signInWithCredential');
                    }
                }
            } catch (appleError: any) {
                console.log('[DeleteAccount] Apple re-auth failed:', appleError.code, appleError.message);
                // User may have cancelled or Apple isn't their provider — try next
            }
        }

        // Try Google Sign-In
        if (!signedInFresh) {
            try {
                console.log('[DeleteAccount] Trying Google Sign-In for re-auth...');
                const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
                GoogleSignin.configure({
                    webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID,
                });
                await GoogleSignin.hasPlayServices();
                const response = await GoogleSignin.signIn();
                const idToken = response.data?.idToken;
                if (idToken) {
                    const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
                    await auth.signInWithCredential(credential);
                    signedInFresh = true;
                    console.log('[DeleteAccount] Google re-auth successful via signInWithCredential');
                }
            } catch (googleError: any) {
                console.log('[DeleteAccount] Google re-auth failed:', googleError.code, googleError.message);
            }
        }

        // Try anonymous (for anonymous users)
        if (!signedInFresh && currentUser.isAnonymous) {
            try {
                console.log('[DeleteAccount] Trying anonymous re-auth...');
                await auth.signInAnonymously();
                signedInFresh = true;
                console.log('[DeleteAccount] Anonymous re-auth successful');
            } catch (anonError: any) {
                console.log('[DeleteAccount] Anonymous re-auth failed:', anonError.message);
            }
        }

        if (!signedInFresh) {
            throw new Error('Could not verify your identity. Please try again.');
        }

        // Step 4: Delete with the FRESH auth.currentUser reference
        const freshUser = auth.currentUser;
        if (!freshUser) {
            throw new Error('Authentication state lost after re-auth. Please try again.');
        }

        console.log('[DeleteAccount] Deleting with fresh user:', freshUser.uid);
        await freshUser.delete();
        console.log('[DeleteAccount] Account deleted successfully');
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
