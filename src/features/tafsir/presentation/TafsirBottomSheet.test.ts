import fs from 'node:fs';

describe('TafsirBottomSheet citation state', () => {
    it('clears prior question citations before a request and after transport failure', () => {
        const source = fs.readFileSync(require.resolve('./TafsirBottomSheet'), 'utf8');
        const handler = source.slice(source.indexOf('const handleAskQuestion'), source.indexOf('// Truncated scholar text'));
        expect(handler).toMatch(/setAnswerCitations\(\[\]\);[\s\S]*setAnswerLoading\(true\)/);
        expect(handler).toMatch(/catch \{[\s\S]*setAnswerCitations\(\[\]\)/);
    });

    it('checks context and question generations before committing async results', () => {
        const source = fs.readFileSync(require.resolve('./TafsirBottomSheet'), 'utf8');
        expect(source).toMatch(/contextGeneration\.isCurrent\(summaryGeneration\)/);
        expect(source).toMatch(/contextGeneration\.isCurrent\(questionContextGeneration\)/);
        expect(source).toMatch(/questionGeneration\.isCurrent\(generation\)/);
    });

    it('clears question loading when a new visible context invalidates the pending request', () => {
        const source = fs.readFileSync(require.resolve('./TafsirBottomSheet'), 'utf8');
        const effect = source.slice(source.indexOf('// Load tafsir'), source.indexOf('const handleSourceChange'));
        expect(effect).toMatch(/questionGeneration\.invalidate\(\);[\s\S]*setAnswerLoading\(false\);/);
        const cleanup = effect.slice(effect.indexOf('return () =>'));
        expect(cleanup).not.toContain('setAnswerLoading');
    });
});
