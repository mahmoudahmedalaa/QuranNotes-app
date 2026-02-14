/**
 * AudioPlayerService — Verse playback via react-native-track-player
 *
 * Uses the native OS audio queue (AVQueuePlayer on iOS, ExoPlayer on Android)
 * for gapless playback and lock screen / Dynamic Island controls.
 *
 * NOTE: Recording functionality stays on expo-av (AudioRecorderService.ts).
 */
import TrackPlayer, {
    Capability,
    State,
    Event,
    AppKilledPlaybackBehavior,
} from 'react-native-track-player';

export type PlaybackStatus = {
    isPlaying: boolean;
    isBuffering: boolean;
    positionMillis: number;
    durationMillis: number;
    didJustFinish: boolean;
    /** Track index that just became active (used to sync verse state) */
    activeTrackIndex?: number;
};

export class AudioPlayerService {
    private listeners: ((status: PlaybackStatus) => void)[] = [];
    private isSetup = false;
    private setupPromise: Promise<void> | null = null;

    /** Build CDN URL for a verse */
    private buildUrl(surah: number, verse: number, cdnFolder: string): string {
        const s = surah.toString().padStart(3, '0');
        const v = verse.toString().padStart(3, '0');
        return `https://everyayah.com/data/${cdnFolder}/${s}${v}.mp3`;
    }

    /** Initialize the track player (idempotent — safe to call multiple times) */
    async setup(): Promise<void> {
        if (this.isSetup) return;
        if (this.setupPromise) return this.setupPromise;

        this.setupPromise = (async () => {
            try {
                await TrackPlayer.setupPlayer({
                    // Buffer ahead for gapless transitions
                    minBuffer: 30,
                    maxBuffer: 60,
                    backBuffer: 10,
                });

                await TrackPlayer.updateOptions({
                    capabilities: [
                        Capability.Play,
                        Capability.Pause,
                        Capability.SkipToNext,
                        Capability.SkipToPrevious,
                        Capability.SeekTo,
                        Capability.Stop,
                    ],
                    compactCapabilities: [
                        Capability.Play,
                        Capability.Pause,
                        Capability.SkipToNext,
                    ],
                    android: {
                        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
                    },
                });

                // Subscribe to native events and forward to our listeners
                this.subscribeToEvents();
                this.isSetup = true;
            } catch (e) {
                console.warn('[AudioPlayer] Setup failed:', e);
                // Player may already be set up (hot reload). Try to continue.
                this.isSetup = true;
                this.subscribeToEvents();
            }
        })();

        return this.setupPromise;
    }

    /** Subscribe to RNTP native events and translate to our PlaybackStatus */
    private subscribeToEvents() {
        // Track changed — fires when the player moves to a new track in the queue
        TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
            if (event.index !== undefined && event.index !== null) {
                this.notifyListeners({
                    isPlaying: true,
                    isBuffering: false,
                    positionMillis: 0,
                    durationMillis: 0,
                    didJustFinish: false,
                    activeTrackIndex: event.index,
                });
            }
        });

        // Playback state changed (playing, paused, buffering, etc.)
        TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
            const state = event.state;
            const isPlaying = state === State.Playing;
            const isBuffering = state === State.Buffering || state === State.Loading;

            try {
                const progress = await TrackPlayer.getProgress();
                this.notifyListeners({
                    isPlaying,
                    isBuffering,
                    positionMillis: Math.round((progress.position || 0) * 1000),
                    durationMillis: Math.round((progress.duration || 0) * 1000),
                    didJustFinish: false,
                });
            } catch {
                this.notifyListeners({
                    isPlaying,
                    isBuffering,
                    positionMillis: 0,
                    durationMillis: 0,
                    didJustFinish: false,
                });
            }
        });

        // Queue ended — all tracks finished playing
        TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
            this.notifyListeners({
                isPlaying: false,
                isBuffering: false,
                positionMillis: 0,
                durationMillis: 0,
                didJustFinish: true,
            });
        });

        // Playback error
        TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
            console.error('[AudioPlayer] Playback error:', event.message);
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
     * Load a full surah as a queue and start playing from a specific verse.
     * Each verse becomes a track with metadata for lock screen display.
     */
    async loadPlaylist(
        surahNum: number,
        verses: { number: number }[],
        startIndex: number,
        cdnFolder: string,
        reciterName: string,
        surahName: string,
    ): Promise<void> {
        await this.setup();

        // Reset current queue
        await TrackPlayer.reset();

        // Build tracks for the entire surah
        const tracks = verses.map((verse, idx) => ({
            id: `${surahNum}:${verse.number}`,
            url: this.buildUrl(surahNum, verse.number, cdnFolder),
            title: `Surah ${surahName} (${idx + 1}/${verses.length})`,
            artist: `Verse ${verse.number} · ${reciterName}`,
            album: 'QuranNotes',
            // Use app icon as artwork for Now Playing
            artwork: require('../../../assets/icon.png'),
        }));

        await TrackPlayer.add(tracks);

        // Skip to the starting verse and play
        if (startIndex > 0) {
            await TrackPlayer.skip(startIndex);
        }
        await TrackPlayer.play();
    }

    /**
     * Play a single verse (used when no surah context is available).
     * For full surah playback, prefer loadPlaylist().
     */
    async playVerse(
        surah: number,
        verse: number,
        cdnFolder: string,
        reciterName: string = 'Reciter',
        surahName: string = 'Quran',
    ): Promise<void> {
        await this.setup();
        await TrackPlayer.reset();

        const track = {
            id: `${surah}:${verse}`,
            url: this.buildUrl(surah, verse, cdnFolder),
            title: `${surahName} — Verse ${verse}`,
            artist: reciterName,
            album: 'QuranNotes',
            artwork: require('../../../assets/icon.png'),
        };

        await TrackPlayer.add(track);
        await TrackPlayer.play();
    }

    /** Preload is a no-op — RNTP handles buffering natively via the queue */
    async preloadVerse(): Promise<void> {
        // No-op: RNTP auto-buffers the next track in the queue
    }

    async pause(): Promise<void> {
        await TrackPlayer.pause();
    }

    async resume(): Promise<void> {
        await TrackPlayer.play();
    }

    async stop(): Promise<void> {
        await TrackPlayer.reset();
        this.notifyListeners({
            isPlaying: false,
            isBuffering: false,
            positionMillis: 0,
            durationMillis: 0,
            didJustFinish: false,
        });
    }

    /** Get current active track index in the queue */
    async getActiveTrackIndex(): Promise<number | undefined> {
        try {
            return await TrackPlayer.getActiveTrackIndex();
        } catch {
            return undefined;
        }
    }

    /** Skip to a specific track in the queue by index */
    async skipToTrack(index: number): Promise<void> {
        await TrackPlayer.skip(index);
        await TrackPlayer.play();
    }
}
