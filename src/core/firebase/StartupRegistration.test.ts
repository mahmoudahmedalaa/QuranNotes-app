import fs from 'node:fs';
import path from 'node:path';

describe('native startup registration', () => {
    it('keeps the RNTP playback service registered at the application entrypoint', () => {
        const entrypoint = fs.readFileSync(path.join(process.cwd(), 'index.js'), 'utf8');
        const audioContext = fs.readFileSync(
            path.join(process.cwd(), 'src/features/audio-player/infrastructure/AudioContext.tsx'),
            'utf8',
        );

        expect(entrypoint).toContain('TrackPlayer.registerPlaybackService(() => PlaybackService)');
        expect(audioContext).not.toContain('registerPlaybackService');
    });
});
