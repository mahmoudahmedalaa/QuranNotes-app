import fs from 'node:fs';

describe('NoorAIScreen request races', () => {
    it('persists a replayable request before transport and reconciles it on foreground', () => {
        const source = fs.readFileSync(require.resolve('./NoorAIScreen'), 'utf8');
        const handler = source.slice(source.indexOf('const handleSend'), source.indexOf('// ── Initialize'));
        expect(handler).toMatch(/if \(!text \|\| inFlightRef\.current \|\| pendingRequestRef\.current\) return/);
        expect(handler.indexOf('await saveConversation')).toBeLessThan(handler.indexOf('await savePendingNoorRequest'));
        expect(handler.indexOf('await savePendingNoorRequest')).toBeLessThan(handler.indexOf('await runPendingRequest'));
        expect(source).toMatch(/AppState\.addEventListener\('change'/);
        expect(source).toMatch(/isNoorResumeTransition[\s\S]*runPendingRequest\(\{ \.\.\.pending, status: 'recovering' \}\)/);
        expect(source).toMatch(/recoverNoorRequest\(initialPending\.request/);
        expect(source).toMatch(/isPendingNoorRequestRecoverable\(initialPending\)/);
        expect(source).toMatch(/auth\.currentUser\?\.uid === initialPending\.ownerUid/);
        expect(source).toMatch(/onPress=\{handleRetryPending\}/);
        expect(source).not.toContain('Your message was not sent');
        expect(source).toMatch(/handleResumeConversation[\s\S]*requestGeneration\.invalidate\(\)/);
    });
});
