import { useState, useCallback, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';

interface PlaybackState {
    isPlaying: boolean;
    currentUri: string | null;
    duration: number;
    position: number;
    isLoading: boolean;
}

export const useRecordingPlayback = () => {
    const soundRef = useRef<Audio.Sound | null>(null);
    const [playbackState, setPlaybackState] = useState<PlaybackState>({
        isPlaying: false,
        currentUri: null,
        duration: 0,
        position: 0,
        isLoading: false,
    });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const playRecording = useCallback(
        async (uri: string) => {
            try {
                // If playing same recording, toggle pause/resume
                if (playbackState.currentUri === uri && soundRef.current) {
                    if (playbackState.isPlaying) {
                        await soundRef.current.pauseAsync();
                        setPlaybackState(prev => ({ ...prev, isPlaying: false }));
                    } else {
                        await soundRef.current.playAsync();
                        setPlaybackState(prev => ({ ...prev, isPlaying: true }));
                    }
                    return;
                }

                // Stop current playback if different recording
                if (soundRef.current) {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                    soundRef.current = null;
                }

                setPlaybackState(prev => ({ ...prev, isLoading: true, currentUri: uri }));

                // Configure audio mode for playback
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                });

                // Load and play the recording
                const { sound } = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: true },
                    status => {
                        if (status.isLoaded) {
                            setPlaybackState(prev => ({
                                ...prev,
                                isPlaying: status.isPlaying,
                                duration: status.durationMillis || 0,
                                position: status.positionMillis || 0,
                                isLoading: false,
                            }));

                            // Handle playback finished
                            if (status.didJustFinish) {
                                setPlaybackState(prev => ({
                                    ...prev,
                                    isPlaying: false,
                                    position: 0,
                                }));
                            }
                        }
                    },
                );

                soundRef.current = sound;
                setPlaybackState(prev => ({ ...prev, isPlaying: true, isLoading: false }));
            } catch (error) {
                console.error('Failed to play recording:', error);
                setPlaybackState(prev => ({ ...prev, isLoading: false, isPlaying: false }));
            }
        },
        [playbackState.currentUri, playbackState.isPlaying],
    );

    const stopPlayback = useCallback(async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
        setPlaybackState({
            isPlaying: false,
            currentUri: null,
            duration: 0,
            position: 0,
            isLoading: false,
        });
    }, []);

    const seekTo = useCallback(async (positionMs: number) => {
        if (soundRef.current) {
            await soundRef.current.setPositionAsync(positionMs);
        }
    }, []);

    return {
        ...playbackState,
        playRecording,
        stopPlayback,
        seekTo,
    };
};
