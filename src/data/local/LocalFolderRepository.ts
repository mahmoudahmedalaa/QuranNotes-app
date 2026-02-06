import AsyncStorage from '@react-native-async-storage/async-storage';
import { Folder, DEFAULT_FOLDER } from '../../domain/entities/Folder';

export class LocalFolderRepository {
    private readonly STORAGE_KEY = 'folders';

    async getAllFolders(): Promise<Folder[]> {
        try {
            const data = await AsyncStorage.getItem(this.STORAGE_KEY);
            let folders: Folder[] = [];
            if (data) {
                const parsed: any[] = JSON.parse(data);
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
            console.error('Failed to get folders from local storage:', error);
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

        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    }

    async saveAllFolders(folders: Folder[]): Promise<void> {
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(folders));
    }

    async deleteFolder(id: string): Promise<void> {
        const folders = await this.getAllFolders();
        const filtered = folders.filter(f => f.id !== id);
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }
}
