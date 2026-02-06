import { IAuthRepository } from '../../repositories/IAuthRepository';
import { User } from '../../entities/User';

export class SignInAnonymouslyUseCase {
    constructor(private repo: IAuthRepository) { }
    async execute(): Promise<User> {
        return this.repo.signInAnonymously();
    }
}

export class SignOutUseCase {
    constructor(private repo: IAuthRepository) { }
    async execute(): Promise<void> {
        return this.repo.signOut();
    }
}

export class ObserveAuthStateUseCase {
    constructor(private repo: IAuthRepository) { }
    execute(callback: (user: User | null) => void): () => void {
        return this.repo.onAuthStateChanged(callback);
    }
}

export class SignInWithEmailUseCase {
    constructor(private repo: IAuthRepository) { }
    async execute(email: string, pass: string): Promise<User> {
        return this.repo.signInWithEmail(email, pass);
    }
}

export class SignUpWithEmailUseCase {
    constructor(private repo: IAuthRepository) { }
    async execute(email: string, pass: string): Promise<User> {
        return this.repo.signUpWithEmail(email, pass);
    }
}

export class SendPasswordResetUseCase {
    constructor(private repo: IAuthRepository) { }
    async execute(email: string): Promise<void> {
        return this.repo.sendPasswordReset(email);
    }
}
