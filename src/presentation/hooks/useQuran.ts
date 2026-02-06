import { useState, useCallback, useMemo } from 'react';
import { Surah } from '../../domain/entities/Quran';
import { GetSurahUseCase } from '../../domain/usecases/quran/GetSurahUseCase';
import { GetAllSurahsUseCase } from '../../domain/usecases/quran/GetAllSurahsUseCase';
// Imports removed as they are now injected via RepositoryContext

// Initialize instances (Dependency Injection could be better, but this is simple for MVP)
import { useRepositories } from '../../infrastructure/di/RepositoryContext';

export const useQuran = () => {
    const { quranRepo } = useRepositories();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [surah, setSurah] = useState<Surah | null>(null);
    const [surahList, setSurahList] = useState<Surah[]>([]);

    // We can instantiate UseCases here or memoize them
    // Since UseCases are stateless (usually), reinstantiating is cheap, but useMemo is safer
    const getSurahUseCase = useMemo(() => new GetSurahUseCase(quranRepo), [quranRepo]);
    const getAllSurahsUseCase = useMemo(() => new GetAllSurahsUseCase(quranRepo), [quranRepo]);

    const loadSurah = useCallback(
        async (surahNumber: number) => {
            setLoading(true);
            setError(null);
            try {
                const result = await getSurahUseCase.execute(surahNumber);
                setSurah(result);
                return result;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load Surah');
                console.error(err);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [getSurahUseCase],
    );

    const loadSurahList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAllSurahsUseCase.execute();
            setSurahList(result);
            return result;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load Surah list');
            console.error(err);
            return [];
        } finally {
            setLoading(false);
        }
    }, [getAllSurahsUseCase]);

    return {
        surah,
        surahList,
        loading,
        error,
        loadSurah,
        getSurah: loadSurah,
        loadSurahList,
        refreshList: loadSurahList,
    };
};
