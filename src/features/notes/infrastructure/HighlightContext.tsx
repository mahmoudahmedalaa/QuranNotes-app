import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ReviewService } from '../../../core/services/ReviewService';
import { CloudSyncEvents } from '../../../core/application/services/CloudSyncEvents';
import { UserScopedStorage } from '../../../core/storage/UserScopedStorage';
import { useAuth } from '../../auth/infrastructure/AuthContext';

const STORAGE_KEY = '@quran_highlights';

export interface VerseHighlight {
    surahId: number;
    verseId: number;
    color: string;
    noteId?: string;
    createdAt: string;
}

// Beautiful highlight palette
export const HIGHLIGHT_COLORS = [
    { name: 'Yellow', color: '#FFF176', darkBg: '#3D3A0E' },
    { name: 'Green', color: '#A5D6A7', darkBg: '#0E3D12' },
    { name: 'Blue', color: '#90CAF9', darkBg: '#0E243D' },
    { name: 'Pink', color: '#F48FB1', darkBg: '#3D0E22' },
    { name: 'Orange', color: '#FFCC80', darkBg: '#3D2A0E' },
    { name: 'Purple', color: '#CE93D8', darkBg: '#2A0E3D' },
];

type HighlightMap = Record<string, VerseHighlight>;

interface HighlightContextType {
    highlights: HighlightMap;
    highlightVerse: (surahId: number, verseId: number, color: string, noteId?: string) => Promise<void>;
    unhighlightVerse: (surahId: number, verseId: number) => Promise<void>;
    getHighlight: (surahId: number, verseId: number) => VerseHighlight | undefined;
    getHighlightsForSurah: (surahId: number) => VerseHighlight[];
}

const HighlightContext = createContext<HighlightContextType | undefined>(undefined);

export const useHighlights = () => {
    const context = useContext(HighlightContext);
    if (!context) throw new Error('useHighlights must be used within a HighlightProvider');
    return context;
};

const makeKey = (surahId: number, verseId: number) => `${surahId}:${verseId}`;

export function HighlightProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [highlights, setHighlights] = useState<HighlightMap>({});

    const loadHighlights = useCallback(async () => {
        try {
            if (!userId) {
                setHighlights({});
                return;
            }
            const data = await UserScopedStorage.getItem(STORAGE_KEY, userId);
            if (data) {
                const parsed = JSON.parse(data) as HighlightMap;
                // Sanitise — strip entries with missing required fields
                const clean: HighlightMap = {};
                for (const [key, val] of Object.entries(parsed)) {
                    if (
                        val &&
                        typeof val.surahId === 'number' &&
                        typeof val.verseId === 'number' &&
                        typeof val.color === 'string' &&
                        typeof val.createdAt === 'string'
                    ) {
                        clean[key] = val;
                    }
                }
                setHighlights(clean);
            } else {
                setHighlights({});
            }
        } catch (e) {
            if (__DEV__) console.warn('Failed to load highlights:', e);
        }
    }, [userId]);

    // Load highlights when the signed-in account changes.
    useEffect(() => {
        setHighlights({});
        loadHighlights();
    }, [loadHighlights]);

    // Re-read when cloud sync pulls remote data
    useEffect(() => {
        return CloudSyncEvents.onPull(() => { loadHighlights(); });
    }, [loadHighlights]);

    // Persist highlights
    const persist = useCallback(async (map: HighlightMap) => {
        try {
            if (!userId) return;
            await UserScopedStorage.setItem(STORAGE_KEY, userId, JSON.stringify(map));
        } catch (e) {
            if (__DEV__) console.warn('Failed to save highlights:', e);
        }
    }, [userId]);

    const highlightVerse = useCallback(async (surahId: number, verseId: number, color: string, noteId?: string) => {
        const key = makeKey(surahId, verseId);
        const updated = {
            ...highlights,
            [key]: { surahId, verseId, color, noteId, createdAt: new Date().toISOString() },
        };
        setHighlights(updated);
        await persist(updated);

        // First-highlight delight — user discovers the feature is useful
        ReviewService.onFirstHighlight(Object.keys(updated).length);
    }, [highlights, persist]);

    const unhighlightVerse = useCallback(async (surahId: number, verseId: number) => {
        const key = makeKey(surahId, verseId);
        const updated = { ...highlights };
        delete updated[key];
        setHighlights(updated);
        await persist(updated);
    }, [highlights, persist]);

    const getHighlight = useCallback((surahId: number, verseId: number) => {
        return highlights[makeKey(surahId, verseId)];
    }, [highlights]);

    const getHighlightsForSurah = useCallback((surahId: number) => {
        return Object.values(highlights).filter(h => h.surahId === surahId);
    }, [highlights]);

    return (
        <HighlightContext.Provider value={{ highlights, highlightVerse, unhighlightVerse, getHighlight, getHighlightsForSurah }}>
            {children}
        </HighlightContext.Provider>
    );
}
