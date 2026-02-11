import { useState } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

export const useAudioRecorder = () => {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);

    const startRecording = async () => {
        try {
            // Configure audio mode for recording first
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Request permissions
            const { status } = await Audio.requestPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Please enable microphone access in your device Settings to record audio.',
                    [{ text: 'OK' }],
                );
                return;
            }
            // Start recording
            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
            );

            setRecording(newRecording);
            setIsRecording(true);
        } catch (error) {
            console.error('Failed to start recording:', error);
            Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
        }
    };

    const stopRecording = async () => {
        if (!recording) return null;

        try {
            setIsRecording(false);
            await recording.stopAndUnloadAsync();

            // Reset audio mode for playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            const uri = recording.getURI();
            setRecordingUri(uri);
            setRecording(null);
            return uri;
        } catch (error) {
            console.error('Failed to stop recording:', error);
            setRecording(null);
            return null;
        }
    };

    return {
        recording,
        isRecording,
        recordingUri,
        startRecording,
        stopRecording,
    };
};
