import { Note } from './Note';

describe('Note Entity', () => {
    it('should be structured correctly (type check)', () => {
        // Since Note is an interface, we are verifying that objects can be assigned to it correctly
        // This is more of a compile-time check in TS, but good to have a runtime example
        const validNote: Note = {
            id: 'note_123',
            surahId: 18,
            verseId: 10,
            content: 'Reflection on the Cave',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
        };

        expect(validNote.id).toBe('note_123');
        expect(validNote.surahId).toBe(18);
    });

    it('should allow optional fields to be undefined', () => {
        const minimalNote: Note = {
            id: 'note_456',
            surahId: 1,
            content: 'Basmalah',
            createdAt: new Date(),
            updatedAt: new Date(),
            // verseId and folderId are missing
        };

        expect(minimalNote.verseId).toBeUndefined();
        expect(minimalNote.folderId).toBeUndefined();
    });
});
