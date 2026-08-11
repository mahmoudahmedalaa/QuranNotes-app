export class AsyncGenerationGuard {
    private generation = 0;

    next(): number {
        this.generation += 1;
        return this.generation;
    }

    current(): number {
        return this.generation;
    }

    invalidate(): void {
        this.generation += 1;
    }

    isCurrent(candidate: number): boolean {
        return candidate === this.generation;
    }
}
