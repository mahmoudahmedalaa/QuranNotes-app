import React, { createContext, useContext, useMemo } from 'react';
import { LocalRecordingRepository } from '../../data/local/LocalRecordingRepository';
import { LocalNoteRepository } from '../../data/local/LocalNoteRepository';
import { LocalBookmarkRepository } from '../../data/local/LocalBookmarkRepository';
import { LocalFolderRepository } from '../../data/local/LocalFolderRepository';
import { LocalQuranRepository } from '../../data/local/LocalQuranRepository';
import { RemoteQuranRepository } from '../../data/remote/RemoteQuranRepository';
import { QuranRepository as CompositeQuranRepository } from '../../data/QuranRepository';

import { INoteRepository } from '../../domain/repositories/INoteRepository';
import { IBookmarkRepository } from '../../domain/repositories/IBookmarkRepository';
import { IQuranRepository } from '../../domain/repositories/IQuranRepository';
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
    // Instantiate repositories once
    const repositories = useMemo(() => {
        return {
            recordingRepo: new LocalRecordingRepository(),
            noteRepo: new LocalNoteRepository(),
            bookmarkRepo: new LocalBookmarkRepository(),
            folderRepo: new LocalFolderRepository(),
            quranRepo: new CompositeQuranRepository(
                new LocalQuranRepository(),
                new RemoteQuranRepository(),
            ),
        };
    }, []);

    return <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>;
};

export const useRepositories = () => {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useRepositories must be used within a RepositoryProvider');
    }
    return context;
};
