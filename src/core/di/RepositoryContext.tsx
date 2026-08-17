import React, { createContext, useContext, useMemo } from 'react';
import { LocalRecordingRepository } from '../data/local/LocalRecordingRepository';
import { LocalNoteRepository } from '../../features/notes/data/LocalNoteRepository';
import { LocalBookmarkRepository } from '../data/local/LocalBookmarkRepository';
import { LocalFolderRepository } from '../data/local/LocalFolderRepository';
import { LocalQuranRepository } from '../../features/quran-reading/data/LocalQuranRepository';
import { RemoteQuranRepository } from '../data/remote/RemoteQuranRepository';
import { QuranRepository as CompositeQuranRepository } from '../../features/quran-reading/data/QuranRepository';
import { useAuth } from '../../features/auth/infrastructure/AuthContext';

import { INoteRepository } from '../../features/notes/domain/repositories/INoteRepository';
import { IBookmarkRepository } from '../domain/repositories/IBookmarkRepository';
import { IQuranRepository } from '../../features/quran-reading/domain/repositories/IQuranRepository';
// IRecordingRepository and IFolderRepository do not exist yet, using classes as types

interface RepositoryContextType {
    recordingRepo: LocalRecordingRepository;
    noteRepo: INoteRepository;
    bookmarkRepo: IBookmarkRepository;
    folderRepo: LocalFolderRepository;
    quranRepo: IQuranRepository;
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(undefined);

export const RepositoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const repositories = useMemo(() => {
        return {
            recordingRepo: new LocalRecordingRepository(userId),
            noteRepo: new LocalNoteRepository(userId),
            bookmarkRepo: new LocalBookmarkRepository(userId),
            folderRepo: new LocalFolderRepository(userId),
            quranRepo: new CompositeQuranRepository(
                new LocalQuranRepository(),
                new RemoteQuranRepository(),
            ),
        };
    }, [userId]);

    return <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>;
};

export const useRepositories = () => {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useRepositories must be used within a RepositoryProvider');
    }
    return context;
};
