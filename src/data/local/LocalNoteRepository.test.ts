import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalNoteRepository } from './LocalNoteRepository';
import { Note } from '../../domain/entities/Note';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

const mockNote: Note = {
    id: 'note_1',
    surahId: 2,
    verseId: 255,
    content: 'Ayatul Kursi',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
};

describe('LocalNoteRepository', () => {
    let repository: LocalNoteRepository;
    const STORAGE_KEY = 'user_notes';

    beforeEach(() => {
        repository = new LocalNoteRepository();
        jest.clearAllMocks();
    });

    describe('saveNote', () => {
        it('should save a new note to storage', async () => {
            // Mock empty existing notes
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

            await repository.saveNote(mockNote);

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEY,
                expect.stringContaining('"id":"note_1"'),
            );
        });

        it('should update an existing note map', async () => {
            const existingMap = {
                'note_0': { ...mockNote, id: 'note_0' }
            };
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingMap));

            await repository.saveNote(mockNote);

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEY,
                expect.anything() // We verify structure via string check above usually, here we assume success if called
            );

            // Get the arg passed to setItem to verify it contains both notes
            const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
            const savedMap = JSON.parse(callArgs[1]);
            expect(savedMap['note_0']).toBeDefined();
            expect(savedMap['note_1']).toBeDefined();
        });
    });

    describe('getAllNotes', () => {
        it('should return notes sorted by date desc', async () => {
            const noteOld = { ...mockNote, id: 'old', updatedAt: new Date('2023-01-01') };
            const noteNew = { ...mockNote, id: 'new', updatedAt: new Date('2024-01-01') };

            const map = {
                [noteOld.id]: noteOld,
                [noteNew.id]: noteNew
            };

            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(map));

            const result = await repository.getAllNotes();
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('new'); // Newest first
            expect(result[1].id).toBe('old');
        });
    });

    describe('deleteNote', () => {
        it('should remove note from storage', async () => {
            const map = {
                [mockNote.id]: mockNote
            };
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(map));

            await repository.deleteNote(mockNote.id);

            const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
            const savedMap = JSON.parse(callArgs[1]);
            expect(savedMap[mockNote.id]).toBeUndefined();
        });
    });
});
