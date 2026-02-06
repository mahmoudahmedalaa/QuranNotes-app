import { INoteRepository } from '../../repositories/INoteRepository';
import { Note } from '../../entities/Note';

export class SaveNoteUseCase {
    constructor(private repo: INoteRepository) {}
    async execute(note: Note): Promise<void> {
        return this.repo.saveNote(note);
    }
}

export class GetNoteUseCase {
    constructor(private repo: INoteRepository) {}
    async execute(surah: number, verse: number): Promise<Note | null> {
        return this.repo.getNote(surah, verse);
    }
}

export class GetAllNotesUseCase {
    constructor(private repo: INoteRepository) {}
    async execute(): Promise<Note[]> {
        return this.repo.getAllNotes();
    }
}

export class DeleteNoteUseCase {
    constructor(private repo: INoteRepository) {}
    async execute(id: string): Promise<void> {
        return this.repo.deleteNote(id);
    }
}

export class GetNoteByIdUseCase {
    constructor(private repo: INoteRepository) {}
    async execute(id: string): Promise<Note | null> {
        return this.repo.getNoteById(id);
    }
}
