import { Recording } from '../../domain/entities/Recording';
import { UserScopedStorage } from '../../storage/UserScopedStorage';

export class LocalRecordingRepository {
    private readonly STORAGE_KEY = 'recordings';
    constructor(private readonly userId: string | null = null) { }

    async getAllRecordings(): Promise<Recording[]> {
        try {
            const data = await UserScopedStorage.getItem(this.STORAGE_KEY, this.userId);
            if (data) {
                const parsed: (Omit<Recording, 'createdAt'> & { createdAt: string })[] = JSON.parse(data);
                return parsed.map(r => ({
                    ...r,
                    createdAt: new Date(r.createdAt),
                })) as Recording[];
            }
            return [];
        } catch (error) {
            if (__DEV__) console.error('Failed to get recordings from local storage:', error);
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

        await this.saveAllRecordings(updated);
    }

    async saveAllRecordings(recordings: Recording[]): Promise<void> {
        await UserScopedStorage.setItem(this.STORAGE_KEY, this.userId, JSON.stringify(recordings));
    }

    async deleteRecording(id: string): Promise<void> {
        const recordings = await this.getAllRecordings();
        const filtered = recordings.filter(r => r.id !== id);
        await this.saveAllRecordings(filtered);
    }
}
