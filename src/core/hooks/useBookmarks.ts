import { useCallback, useMemo } from 'react';
import { LocalBookmarkRepository } from '../data/local/LocalBookmarkRepository';
import { useAuth } from '../../features/auth/infrastructure/AuthContext';

export const useBookmarks = () => {
    const { user } = useAuth();
    const repo = useMemo(() => new LocalBookmarkRepository(user?.id ?? null), [user?.id]);
    // const [loading, setLoading] = useState(false);

    const isBookmarked = useCallback(async (surah: number, verse: number) => {
        return await repo.isBookmarked(surah, verse);
    }, [repo]);

    const toggleBookmark = useCallback(async (surah: number, verse: number) => {
        return await repo.toggleBookmark(surah, verse);
    }, [repo]);

    const getBookmarks = useCallback(async () => {
        return await repo.getBookmarks();
    }, [repo]);

    return { isBookmarked, toggleBookmark, getBookmarks };
};
