export interface User {
    id: string;
    email: string | null;
    displayName: string | null;
    isAnonymous: boolean;
    photoURL: string | null;
    createdAt: string | null; // ISO string from Firebase metadata.creationTime
    providerId: string | null; // 'password' | 'google.com' | 'apple.com' etc.
}
