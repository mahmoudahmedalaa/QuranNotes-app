import { useState, useCallback } from 'react';
import { AlQuranCloudAPI } from '../../infrastructure/api/AlQuranCloudAPI';
import { Verse } from '../../domain/entities/Quran';

const api = new AlQuranCloudAPI();

export const useSearch = () => {
    const [results, setResults] = useState<Verse[]>([]);
    const [loading, setLoading] = useState(false);

    const search = useCallback(async (query: string) => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const data = await api.search(query);
            setResults(data);
        } catch (error) {
            console.error(error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    return { results, loading, search };
};
