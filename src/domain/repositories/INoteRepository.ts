import { Note } from '../entities/Note';

export interface INoteRepository {
    saveNote(note: Note): Promise<void>;
    getNote(surahNumber: number, verseNumber: number): Promise<Note | null>;
    getNoteById(id: string): Promise<Note | null>;
    deleteNote(id: string): Promise<void>;
    getAllNotes(): Promise<Note[]>;
    getNotesBySurah(surahNumber: number): Promise<Note[]>;
}
