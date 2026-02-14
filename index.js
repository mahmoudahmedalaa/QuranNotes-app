import 'expo-router/entry';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/infrastructure/audio/PlaybackService';

// Register the RNTP playback service for lock screen / background controls.
// This must happen at the entry point, outside of any React component.
TrackPlayer.registerPlaybackService(() => PlaybackService);
