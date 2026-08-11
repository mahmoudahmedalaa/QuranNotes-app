import { AsyncGenerationGuard } from './AsyncGenerationGuard';

describe('AsyncGenerationGuard', () => {
    it('rejects completion from a request invalidated by a context change', async () => {
        const guard = new AsyncGenerationGuard();
        const token = guard.next();
        let commit = 'new context';
        let resolveOld: (value: string) => void = () => undefined;
        const oldRequest = new Promise<string>((resolve) => { resolveOld = resolve; });
        const completion = oldRequest.then((value) => {
            if (guard.isCurrent(token)) commit = value;
        });

        guard.invalidate();
        resolveOld('stale answer');
        await completion;

        expect(commit).toBe('new context');
    });

    it('allows only the latest generation to commit', () => {
        const guard = new AsyncGenerationGuard();
        const first = guard.next();
        const second = guard.next();
        expect(guard.isCurrent(first)).toBe(false);
        expect(guard.isCurrent(second)).toBe(true);
    });
});
