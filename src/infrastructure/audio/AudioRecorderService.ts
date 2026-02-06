import { Audio } from 'expo-av';

export class AudioRecorderService {
    private recording: Audio.Recording | null = null;

    async startRecording(): Promise<void> {
        try {
            console.log('Requesting permissions..');
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                console.warn('Audio permission denied');
                return;
            }

            console.log('Setting audio mode..');
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log('Starting recording..');
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
            );
            this.recording = recording;
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
            throw err; // Re-throw to UI
        }
    }

    async stopRecording(): Promise<string | null> {
        console.log('Stopping recording..');
        if (!this.recording) {
            console.warn('No recording to stop');
            return null;
        }

        try {
            await this.recording.stopAndUnloadAsync();
            const uri = this.recording.getURI();
            console.log('Recording stopped at', uri);
            this.recording = null;
            // Reset Audio Mode for playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });
            return uri;
        } catch (error) {
            console.error('Failed to stop recording', error);
            return null;
        }
    }
}
