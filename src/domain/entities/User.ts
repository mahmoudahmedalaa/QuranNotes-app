export interface User {
    id: string;
    email: string | null;
    displayName: string | null;
    isAnonymous: boolean;
    photoURL: string | null;
}
