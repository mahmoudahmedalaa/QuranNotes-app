export interface Recording {
    id: string;
    name: string;
    surahId?: number;
    verseId?: number;
    folderId?: string;
    uri: string;
    duration: number;
    createdAt: Date;
}
