import fs from 'node:fs';

describe('TafsirBottomSheet citation state', () => {
    it('clears prior question citations before a request and after transport failure', () => {
        const source = fs.readFileSync(require.resolve('./TafsirBottomSheet'), 'utf8');
        const handler = source.slice(source.indexOf('const handleAskQuestion'), source.indexOf('// Truncated scholar text'));
        expect(handler).toMatch(/setAnswerCitations\(\[\]\);[\s\S]*setAnswerLoading\(true\)/);
        expect(handler).toMatch(/catch \{[\s\S]*setAnswerCitations\(\[\]\)/);
    });
});
