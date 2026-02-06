import { useNoteContext } from '../../infrastructure/notes/NoteContext';

export const useNotes = () => {
    const context = useNoteContext();

    return {
        notes: context.notes,
        loading: context.loading,
        fetchAllNotes: context.refreshNotes,
        getNoteForVerse: context.getNoteForVerse,
        getNoteById: context.getNoteById,
        saveNote: context.saveNote,
        deleteNote: context.deleteNote,
        refreshNotes: context.refreshNotes,
    };
};
