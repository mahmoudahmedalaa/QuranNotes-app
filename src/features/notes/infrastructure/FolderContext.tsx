import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Folder, DEFAULT_FOLDER } from '../../../core/domain/entities/Folder';
import { usePro } from '../../auth/infrastructure/ProContext';
import { useAuth } from '../../auth/infrastructure/AuthContext';
import { LocalFolderRepository } from '../../../core/data/local/LocalFolderRepository';



interface FolderContextType {
    folders: Folder[];
    addFolder: (name: string, color?: string) => Promise<void>;
    updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;
    loading: boolean;
}

const FolderContext = createContext<FolderContextType>({
    folders: [DEFAULT_FOLDER],
    addFolder: async () => { },
    updateFolder: async () => { },
    deleteFolder: async () => { },
    loading: false,
});

export const useFolders = () => useContext(FolderContext);


export function FolderProvider({ children }: { children: React.ReactNode }) {
    const [folders, setFolders] = useState<Folder[]>([DEFAULT_FOLDER]);
    const [loading, setLoading] = useState(true);
    const { isPro } = usePro();
    const { user } = useAuth();
    const repo = useMemo(() => new LocalFolderRepository(user?.id ?? null), [user?.id]);
    const router = useRouter();

    const loadFolders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await repo.getAllFolders();
            setFolders(data);
        } catch (error) {
            if (__DEV__) console.error('Failed to load folders:', error);
        } finally {
            setLoading(false);
        }
    }, [repo]);

    useEffect(() => {
        loadFolders();
    }, [loadFolders]);

    const addFolder = async (name: string, color?: string) => {
        // GATING LOGIC: Limit Free users to 2 folders (excluding default "None" folder)
        const customFolders = folders.filter(f => f.id !== DEFAULT_FOLDER.id);

        if (!isPro && customFolders.length >= 2) {
            Alert.alert(
                'Folder Limit Reached',
                'Free users can create up to 2 custom folders. Upgrade to Pro for unlimited folders.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Upgrade to Pro', onPress: () => router.push('/paywall?reason=folders') }
                ]
            );
            return;
        }

        const newFolder: Folder = {
            id: Date.now().toString(),
            name,
            color: color || '#2196F3',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await repo.saveFolder(newFolder);
        await loadFolders();
    };

    const updateFolder = async (id: string, updates: Partial<Folder>) => {
        const folder = folders.find(f => f.id === id);
        if (folder) {
            await repo.saveFolder({ ...folder, ...updates, updatedAt: new Date() });
            await loadFolders();
        }
    };

    const deleteFolder = async (id: string) => {
        if (id === DEFAULT_FOLDER.id) return;
        await repo.deleteFolder(id);
        await loadFolders();
    };

    return (
        <FolderContext.Provider value={{ folders, addFolder, updateFolder, deleteFolder, loading }}>
            {children}
        </FolderContext.Provider>
    );
}
