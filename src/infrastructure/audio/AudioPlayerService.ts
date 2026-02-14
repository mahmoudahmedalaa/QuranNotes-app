import { Audio } from 'expo-av';

export type PlaybackStatus = {
    isPlaying: boolean;
    isBuffering: boolean;
    positionMillis: number;
    durationMillis: number;
    didJustFinish: boolean;
};

export class AudioPlayerService {
    private sound: Audio.Sound | null = null;
    private listeners: ((status: PlaybackStatus) => void)[] = [];

    // ── Preload buffer for gapless transitions ──
    private preloadedSound: Audio.Sound | null = null;
    private preloadedKey: string | null = null;

    constructor() {
        Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
        });
    }

    addListener(callback: (status: PlaybackStatus) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners(status: PlaybackStatus) {
        this.listeners.forEach(l => l(status));
    }

    /** Build CDN URL for a verse */
    private buildUrl(surah: number, verse: number, cdnFolder: string): string {
        const s = surah.toString().padStart(3, '0');
        const v = verse.toString().padStart(3, '0');
        return `https://everyayah.com/data/${cdnFolder}/${s}${v}.mp3`;
    }

    /** Build a unique key for a verse (used to match preloaded buffer) */
    private verseKey(surah: number, verse: number, cdnFolder: string): string {
        return `${surah}:${verse}:${cdnFolder}`;
    }

    /**
     * Silently clean up a sound without notifying listeners.
     */
    private async silentUnload(sound: Audio.Sound | null) {
        if (!sound) return;
        try {
            await sound.stopAsync();
            await sound.unloadAsync();
        } catch (_e) {
            // already unloaded – ignore
        }
    }

    /**
     * Preload the next verse into memory without playing it.
     * Call this while the current verse is still playing.
     * If a different verse was previously preloaded, it's discarded.
     */
    async preloadVerse(
        surah: number,
        verse: number,
        cdnFolder: string = 'Alafasy_128kbps',
    ): Promise<void> {
        const key = this.verseKey(surah, verse, cdnFolder);

        // Already preloaded — nothing to do
        if (this.preloadedKey === key && this.preloadedSound) return;

        // Discard any previous preload
        if (this.preloadedSound) {
            this.silentUnload(this.preloadedSound);
            this.preloadedSound = null;
            this.preloadedKey = null;
        }

        try {
            const url = this.buildUrl(surah, verse, cdnFolder);
            // Load into memory but DON'T play (shouldPlay: false)
            const { sound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: false },
            );
            // Only keep if no newer preload has been requested
            if (this.preloadedKey === null) {
                this.preloadedSound = sound;
                this.preloadedKey = key;
            } else {
                // A different preload was started — discard this one
                this.silentUnload(sound);
            }
        } catch (_e) {
            // Preload is best-effort — if it fails, playVerse will load normally
            this.preloadedSound = null;
            this.preloadedKey = null;
        }
    }

    /**
     * Play a specific verse. If the verse was preloaded, starts instantly
     * from the buffer (gapless). Otherwise loads from network as before.
     */
    async playVerse(
        surah: number,
        verse: number,
        cdnFolder: string = 'Alafasy_128kbps',
    ): Promise<void> {
        try {
            const key = this.verseKey(surah, verse, cdnFolder);
            const oldSound = this.sound;
            this.sound = null;

            const onPlaybackStatusUpdate = (status: any) => {
                if (status.isLoaded) {
                    this.notifyListeners({
                        isPlaying: status.isPlaying,
                        isBuffering: status.isBuffering,
                        positionMillis: status.positionMillis,
                        durationMillis: status.durationMillis || 0,
                        didJustFinish: status.didJustFinish,
                    });

                    if (status.didJustFinish) {
                        // Don't unload here — let the swap in handleNextVerse clean up
                        // This prevents the brief silence between unload and next load
                    }
                }
            };

            let newSound: Audio.Sound;

            // ── Check if this verse is preloaded (instant start!) ──
            if (this.preloadedKey === key && this.preloadedSound) {
                newSound = this.preloadedSound;
                this.preloadedSound = null;
                this.preloadedKey = null;
                // Attach status listener and start playing
                newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
                await newSound.playAsync();
            } else {
                // Discard stale preload if any
                if (this.preloadedSound) {
                    this.silentUnload(this.preloadedSound);
                    this.preloadedSound = null;
                    this.preloadedKey = null;
                }

                const primaryUrl = this.buildUrl(surah, verse, cdnFolder);
                const fallbackUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${surah}:${verse}.mp3`;

                try {
                    const { sound } = await Audio.Sound.createAsync(
                        { uri: primaryUrl },
                        { shouldPlay: true },
                        onPlaybackStatusUpdate,
                    );
                    newSound = sound;
                } catch (_primaryError) {
                    const { sound } = await Audio.Sound.createAsync(
                        { uri: fallbackUrl },
                        { shouldPlay: true },
                        onPlaybackStatusUpdate,
                    );
                    newSound = sound;
                }
            }

            this.sound = newSound;
            this.silentUnload(oldSound);
        } catch (error) {
            console.error('[AudioPlayer] Failed to play audio:', error);
            this.notifyListeners({
                isPlaying: false,
                isBuffering: false,
                positionMillis: 0,
                durationMillis: 0,
                didJustFinish: false,
            });
        }
    }

    async pause(): Promise<void> {
        if (this.sound) {
            await this.sound.pauseAsync();
        }
    }

    async resume(): Promise<void> {
        if (this.sound) {
            await this.sound.playAsync();
        }
    }

    async stop(): Promise<void> {
        if (this.sound) {
            try {
                await this.sound.stopAsync();
                await this.sound.unloadAsync();
            } catch (e) {
                // Sound might already be unloaded
            }
            this.sound = null;
        }
        // Also clean up any preloaded audio
        if (this.preloadedSound) {
            this.silentUnload(this.preloadedSound);
            this.preloadedSound = null;
            this.preloadedKey = null;
        }
        this.notifyListeners({
            isPlaying: false,
            isBuffering: false,
            positionMillis: 0,
            durationMillis: 0,
            didJustFinish: false,
        });
    }
}
