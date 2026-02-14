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

    /**
     * Silently clean up a sound without notifying listeners.
     * Used to unload the old sound after the new one has already started.
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
     * Play a specific verse with the given reciter.
     * Uses a "load-then-swap" strategy: the new audio is loaded and starts
     * playing BEFORE the old sound is unloaded, eliminating audible gaps.
     */
    async playVerse(
        surah: number,
        verse: number,
        cdnFolder: string = 'Alafasy_128kbps',
    ): Promise<void> {
        try {
            // Build URL using EveryAyah CDN with the selected reciter's folder
            const paddedSurah = surah.toString().padStart(3, '0');
            const paddedVerse = verse.toString().padStart(3, '0');
            const primaryUrl = `https://everyayah.com/data/${cdnFolder}/${paddedSurah}${paddedVerse}.mp3`;

            // Fallback URL using Islamic Network CDN
            const fallbackUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${surah}:${verse}.mp3`;


            // Keep reference to old sound for cleanup AFTER new one starts
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
                        this.sound?.unloadAsync();
                        this.sound = null;
                    }
                }
            };

            let newSound: Audio.Sound;

            try {
                // Load new audio (starts playing immediately via shouldPlay: true)
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

            // New audio is now playing — swap in and clean up old
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
        this.notifyListeners({
            isPlaying: false,
            isBuffering: false,
            positionMillis: 0,
            durationMillis: 0,
            didJustFinish: false,
        });
    }
}
