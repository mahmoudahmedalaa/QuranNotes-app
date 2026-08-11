import fs from 'node:fs';

describe('NoorAIScreen request races', () => {
    it('claims an in-flight ref synchronously and checks generation before committing', () => {
        const source = fs.readFileSync(require.resolve('./NoorAIScreen'), 'utf8');
        const handler = source.slice(source.indexOf('const handleSend'), source.indexOf('// ── Derived'));
        expect(handler).toMatch(/if \(!text \|\| inFlightRef\.current\) return/);
        expect(handler).toMatch(/inFlightRef\.current = true;[\s\S]*await askNoor/);
        expect(handler).toMatch(/requestGeneration\.isCurrent\(generation\)[\s\S]*setMessages/);
        expect(source).toMatch(/handleResumeConversation[\s\S]*requestGeneration\.invalidate\(\)/);
    });
});
