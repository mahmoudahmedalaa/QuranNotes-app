import { Folder, DEFAULT_FOLDER } from '../../domain/entities/Folder';
import { UserScopedStorage } from '../../storage/UserScopedStorage';

export class LocalFolderRepository {
    private readonly STORAGE_KEY = 'folders';
    constructor(private readonly userId: string | null = null) { }

    async getAllFolders(): Promise<Folder[]> {
        try {
            const data = await UserScopedStorage.getItem(this.STORAGE_KEY, this.userId);
            let folders: Folder[] = [];
            if (data) {
                const parsed: (Omit<Folder, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt?: string })[] = JSON.parse(data);
                folders = parsed.map(f => ({
                    ...f,
                    createdAt: new Date(f.createdAt),
                    updatedAt: f.updatedAt ? new Date(f.updatedAt) : new Date(f.createdAt),
                }));
            }

            // Deduplicate and ensure default folder
            const seenIds = new Set<string>();
            folders = folders.filter(f => {
                if (seenIds.has(f.id)) return false;
                seenIds.add(f.id);
                return true;
            });

            if (!seenIds.has(DEFAULT_FOLDER.id)) {
                folders = [DEFAULT_FOLDER, ...folders];
            }

            return folders;
        } catch (error) {
            if (__DEV__) console.error('Failed to get folders from local storage:', error);
            return [DEFAULT_FOLDER];
        }
    }

    async saveFolder(folder: Folder): Promise<void> {
        const folders = await this.getAllFolders();
        const index = folders.findIndex(f => f.id === folder.id);

        let updated: Folder[];
        if (index >= 0) {
            updated = [...folders];
            updated[index] = folder;
        } else {
            updated = [...folders, folder];
        }

        await this.saveAllFolders(updated);
    }

    async saveAllFolders(folders: Folder[]): Promise<void> {
        await UserScopedStorage.setItem(this.STORAGE_KEY, this.userId, JSON.stringify(folders));
    }

    async deleteFolder(id: string): Promise<void> {
        const folders = await this.getAllFolders();
        const filtered = folders.filter(f => f.id !== id);
        await this.saveAllFolders(filtered);
    }
}
