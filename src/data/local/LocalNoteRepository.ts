import AsyncStorage from '@react-native-async-storage/async-storage';
import { INoteRepository } from '../../domain/repositories/INoteRepository';
import { Note } from '../../domain/entities/Note';

export class LocalNoteRepository implements INoteRepository {
    private readonly STORAGE_KEY = 'user_notes';

    private async getNotesMap(): Promise<Record<string, Note>> {
        try {
            const data = await AsyncStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    private async saveNotesMap(map: Record<string, Note>): Promise<void> {
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(map));
    }

    // Key format: "s{surah}_v{verse}" - implies one note per verse for MVP simplicity
    // or use ID-based map if creating multiple.
    // PRD says "Verse-Level Note Taking", usually implies one note block per verse.
    // Let's support one note per verse for the "Note Taking" feature to keep it clean.
    private getLocationKey(surah: number, verse: number): string {
        return `s${surah}_v${verse}`;
    }

    async saveNote(note: Note): Promise<void> {
        const map = await this.getNotesMap();
        map[note.id] = note;
        await this.saveNotesMap(map);
    }

    async getNote(surahNumber: number, verseNumber: number): Promise<Note | null> {
        const all = await this.getAllNotes();
        return all.find(n => n.surahId === surahNumber && n.verseId === verseNumber) || null;
    }

    async getNoteById(id: string): Promise<Note | null> {
        const map = await this.getNotesMap();
        return map[id] || null;
    }

    async deleteNote(id: string): Promise<void> {
        const map = await this.getNotesMap();
        delete map[id];
        await this.saveNotesMap(map);
    }

    async getAllNotes(): Promise<Note[]> {
        const map = await this.getNotesMap();
        return Object.values(map).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
    }

    async getNotesBySurah(surahNumber: number): Promise<Note[]> {
        const all = await this.getAllNotes();
        return all.filter(n => n.surahId === surahNumber);
    }
}
