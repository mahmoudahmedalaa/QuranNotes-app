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
     * Play a specific verse with the given reciter
     * @param surah Surah number (1-114)
     * @param verse Verse number
     * @param cdnFolder The EveryAyah CDN folder name (e.g., 'Alafasy_128kbps')
     */
    async playVerse(
        surah: number,
        verse: number,
        cdnFolder: string = 'Alafasy_128kbps',
    ): Promise<void> {
        try {
            // ALWAYS stop previous audio before playing new
            await this.stop();

            // Build URL using EveryAyah CDN with the selected reciter's folder
            const paddedSurah = surah.toString().padStart(3, '0');
            const paddedVerse = verse.toString().padStart(3, '0');
            const primaryUrl = `https://everyayah.com/data/${cdnFolder}/${paddedSurah}${paddedVerse}.mp3`;

            // Fallback URL using Islamic Network CDN
            const fallbackUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${surah}:${verse}.mp3`;

            console.log('[AudioPlayer] Attempting primary URL:', primaryUrl);

            let audioUrl = primaryUrl;

            // Try primary URL first, fall back if it fails
            try {
                const { sound } = await Audio.Sound.createAsync(
                    { uri: audioUrl },
                    { shouldPlay: true },
                    status => {
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
                    },
                );
                this.sound = sound;
            } catch (primaryError) {
                console.log('[AudioPlayer] Primary URL failed, trying fallback:', fallbackUrl);

                // Try fallback URL
                const { sound } = await Audio.Sound.createAsync(
                    { uri: fallbackUrl },
                    { shouldPlay: true },
                    status => {
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
                    },
                );
                this.sound = sound;
            }
        } catch (error) {
            console.error('[AudioPlayer] Failed to play audio:', error);
            // Notify listeners of error state
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
                console.log('[AudioPlayer] Cleanup:', e);
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
