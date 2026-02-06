export interface Folder {
    id: string;
    name: string;
    color?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const DEFAULT_FOLDER: Folder = {
    id: 'uncategorized',
    name: 'None', // Changed from 'Uncategorized' to match user feedback
    color: '#9E9E9E',
    createdAt: new Date(),
    updatedAt: new Date(),
};
