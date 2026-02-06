import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recording } from '../../domain/entities/Recording';

export class LocalRecordingRepository {
    private readonly STORAGE_KEY = 'recordings';

    async getAllRecordings(): Promise<Recording[]> {
        try {
            const data = await AsyncStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const parsed: Record<string, any>[] = JSON.parse(data);
                return parsed.map(r => ({
                    ...r,
                    createdAt: new Date(r.createdAt),
                })) as Recording[];
            }
            return [];
        } catch (error) {
            console.error('Failed to get recordings from local storage:', error);
            return [];
        }
    }

    async saveRecording(recording: Recording): Promise<void> {
        const recordings = await this.getAllRecordings();
        const index = recordings.findIndex(r => r.id === recording.id);

        let updated: Recording[];
        if (index >= 0) {
            updated = [...recordings];
            updated[index] = recording;
        } else {
            updated = [...recordings, recording];
        }

        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    }

    async saveAllRecordings(recordings: Recording[]): Promise<void> {
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(recordings));
    }

    async deleteRecording(id: string): Promise<void> {
        const recordings = await this.getAllRecordings();
        const filtered = recordings.filter(r => r.id !== id);
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }
}
