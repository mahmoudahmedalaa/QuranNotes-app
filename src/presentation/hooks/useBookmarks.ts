import { useState, useCallback } from 'react';
import { LocalBookmarkRepository } from '../../data/local/LocalBookmarkRepository';

const repo = new LocalBookmarkRepository();

export const useBookmarks = () => {
    // const [loading, setLoading] = useState(false);

    const isBookmarked = useCallback(async (surah: number, verse: number) => {
        return await repo.isBookmarked(surah, verse);
    }, []);

    const toggleBookmark = useCallback(async (surah: number, verse: number) => {
        return await repo.toggleBookmark(surah, verse);
    }, []);

    const getBookmarks = useCallback(async () => {
        return await repo.getBookmarks();
    }, []);

    return { isBookmarked, toggleBookmark, getBookmarks };
};
