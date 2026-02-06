import { collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { Recording } from '../../domain/entities/Recording';

export class RemoteRecordingRepository {
    private readonly COLLECTION = 'recordings';

    constructor(private userId: string) {}

    async saveRecording(recording: Recording): Promise<void> {
        if (!this.userId) return;
        const ref = doc(db, this.COLLECTION, recording.id);
        // Note: we only sync metadata, not the actual audio file to Firestore.
        // Files remain local or move to Firebase Storage in a future phase.
        await setDoc(ref, {
            ...recording,
            userId: this.userId,
            createdAt: recording.createdAt.toISOString(), // Firestore friendly
        });
    }

    async deleteRecording(id: string): Promise<void> {
        if (!this.userId) return;
        await deleteDoc(doc(db, this.COLLECTION, id));
    }

    async getAllRecordings(): Promise<Recording[]> {
        if (!this.userId) return [];
        const q = query(collection(db, this.COLLECTION), where('userId', '==', this.userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                createdAt: new Date(data.createdAt),
            } as Recording;
        });
    }
}
