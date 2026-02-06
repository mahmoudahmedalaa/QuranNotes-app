import { Bookmark } from '../entities/Bookmark';

export interface IBookmarkRepository {
    toggleBookmark(surah: number, verse: number): Promise<boolean>; // returns isBookmarked
    isBookmarked(surah: number, verse: number): Promise<boolean>;
    getBookmarks(): Promise<Bookmark[]>;
}
