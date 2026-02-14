/**
 * PlaybackService — Handles remote media control events
 * 
 * This runs in the background even when the app is closed.
 * It responds to lock screen, Dynamic Island, Control Center,
 * and Bluetooth headset controls.
 */
import TrackPlayer, { Event } from 'react-native-track-player';

export const PlaybackService = async function () {
    // Lock screen / Control Center play button
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());

    // Lock screen / Control Center pause button
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());

    // Lock screen / Control Center next track button
    TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());

    // Lock screen / Control Center previous track button
    TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());

    // Lock screen seek bar
    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
        TrackPlayer.seekTo(event.position);
    });

    // Stop button (headphone disconnect, etc.)
    TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());

    // Handle audio ducking (e.g., phone call interruption)
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
        if (event.paused) {
            await TrackPlayer.pause();
        } else if (event.permanent) {
            await TrackPlayer.reset();
        } else {
            await TrackPlayer.play();
        }
    });
};
