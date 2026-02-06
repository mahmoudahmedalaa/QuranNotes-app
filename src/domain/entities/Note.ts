export interface Note {
    id: string;
    surahId: number;
    verseId?: number;
    content: string;
    folderId?: string;
    createdAt: Date;
    updatedAt: Date;
}
