import { collection, doc, setDoc, getDocs, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { INoteRepository } from '../../domain/repositories/INoteRepository';
import { Note } from '../../domain/entities/Note';

export class RemoteNoteRepository implements INoteRepository {
    private readonly COLLECTION = 'notes';

    constructor(private userId: string) { }

    async saveNote(note: Note): Promise<void> {
        if (!this.userId) return;
        const ref = doc(db, this.COLLECTION, note.id);
        await setDoc(ref, { ...note, userId: this.userId });
    }

    async getNote(surahNumber: number, verseNumber: number): Promise<Note | null> {
        // Inefficient query for Firestore without composite index?
        // Better: Query by ID if deterministic or filtered.
        // Let's rely on syncing everything for now or exact ID match if possible.
        // For now, no-op or specific implementation.
        // Note: This repository is mainly for SyncService to pull *all* notes.
        return null;
    }

    async deleteNote(noteId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, 'notes', noteId));
        } catch (error) {
            console.error("Error deleting note:", error);
            throw error;
        }
    }

    async getAllNotes(): Promise<Note[]> {
        if (!this.userId) return [];
        const q = query(collection(db, this.COLLECTION), where('userId', '==', this.userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as Note);
    }

    async getNoteById(id: string): Promise<Note | null> {
        if (!this.userId) return null;
        const ref = doc(db, this.COLLECTION, id);
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) return null;
        return snapshot.data() as Note;
    }

    async getNotesBySurah(surahNumber: number): Promise<Note[]> {
        return []; // Not implemented for remote, we sync locally
    }
}
