import { LocalNoteRepository } from '../../data/local/LocalNoteRepository';
import { RemoteNoteRepository } from '../../data/remote/RemoteNoteRepository';
import { LocalRecordingRepository } from '../../data/local/LocalRecordingRepository';
import { RemoteRecordingRepository } from '../../data/remote/RemoteRecordingRepository';
import { LocalFolderRepository } from '../../data/local/LocalFolderRepository';
import { RemoteFolderRepository } from '../../data/remote/RemoteFolderRepository';

/** Minimum shape for any syncable entity */
interface SyncableEntity {
    id: string;
    createdAt: Date | string;
    updatedAt?: Date | string;
}

/** Common interface for local repository operations */
interface LocalRepository<T extends SyncableEntity> {
    getAllNotes?(): Promise<T[]>;
    getAllRecordings?(): Promise<T[]>;
    getAllFolders?(): Promise<T[]>;
    saveAllNotes?(items: T[]): Promise<void>;
    saveAllRecordings?(items: T[]): Promise<void>;
    saveAllFolders?(items: T[]): Promise<void>;
}

/** Common interface for remote repository operations */
interface RemoteRepository<T extends SyncableEntity> {
    getAllNotes?(): Promise<T[]>;
    getAllRecordings?(): Promise<T[]>;
    getAllFolders?(): Promise<T[]>;
    saveNote?(item: T): Promise<void>;
    saveRecording?(item: T): Promise<void>;
    saveFolder?(item: T): Promise<void>;
}

export class SyncService {
    constructor(private userId: string) { }

    async syncAll(): Promise<void> {
        if (!this.userId) return;

        const noteSync = new EntitySyncManager(
            new LocalNoteRepository(),
            new RemoteNoteRepository(this.userId),
        );
        const recordingSync = new EntitySyncManager(
            new LocalRecordingRepository(),
            new RemoteRecordingRepository(this.userId),
        );
        const folderSync = new EntitySyncManager(
            new LocalFolderRepository(),
            new RemoteFolderRepository(this.userId),
        );

        await Promise.all([
            noteSync.sync('notes'),
            recordingSync.sync('recordings'),
            folderSync.sync('folders'),
        ]);

    }
}

class EntitySyncManager<T extends SyncableEntity = SyncableEntity> {
    constructor(
        private localRepo: LocalRepository<T>,
        private remoteRepo: RemoteRepository<T>,
    ) { }

    async sync(label: string): Promise<void> {
        try {
            const localItems =
                (await this.localRepo.getAllNotes?.()) ||
                (await this.localRepo.getAllRecordings?.()) ||
                (await this.localRepo.getAllFolders?.());

            const remoteItems =
                (await this.remoteRepo.getAllNotes?.()) ||
                (await this.remoteRepo.getAllRecordings?.()) ||
                (await this.remoteRepo.getAllFolders?.());

            const merged = new Map<string, T>();
            remoteItems?.forEach((n: T) => merged.set(n.id, n));

            for (const local of localItems || []) {
                const remote = merged.get(local.id);
                // For recordings/notes where updatedAt might be missing, use createdAt
                const localDate = new Date(local.updatedAt || local.createdAt).getTime();
                const remoteDate = remote
                    ? new Date(remote.updatedAt || remote.createdAt).getTime()
                    : 0;

                if (!remote || localDate > remoteDate) {
                    merged.set(local.id, local);
                    await this.remoteRepo.saveNote?.(local);
                    await this.remoteRepo.saveRecording?.(local);
                    await this.remoteRepo.saveFolder?.(local);
                }
            }

            // Sync back to local
            const finalItems = Array.from(merged.values());
            await this.localRepo.saveAllNotes?.(finalItems);
            await this.localRepo.saveAllRecordings?.(finalItems);
            await this.localRepo.saveAllFolders?.(finalItems);

        } catch (e) {
            if (__DEV__) console.error(`${label} sync error:`, e);
        }
    }
}
