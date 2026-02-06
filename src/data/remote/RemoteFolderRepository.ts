import { collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { Folder } from '../../domain/entities/Folder';

export class RemoteFolderRepository {
    private readonly COLLECTION = 'folders';

    constructor(private userId: string) { }

    async saveFolder(folder: Folder): Promise<void> {
        if (!this.userId) return;
        const ref = doc(db, this.COLLECTION, folder.id);
        await setDoc(ref, {
            ...folder,
            userId: this.userId,
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt?.toISOString() || folder.createdAt.toISOString(),
        });
    }

    async deleteFolder(folderId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, 'folders', folderId));
        } catch (error) {
            // The provided snippet for the catch block was incomplete and syntactically incorrect.
            // Assuming the intent was to add a try-catch block and change the parameter name,
            // but without specific error handling, I'm re-throwing the error.
            // Also, the `if (!this.userId) return;` check was removed as per the snippet's implied change.
            throw error;
        }
    }

    async getAllFolders(): Promise<Folder[]> {
        if (!this.userId) return [];
        const q = query(collection(db, this.COLLECTION), where('userId', '==', this.userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
            } as Folder;
        });
    }
}
