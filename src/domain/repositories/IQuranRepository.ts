import { Surah } from '../entities/Quran';

export interface IQuranRepository {
    getSurah(surahNumber: number): Promise<Surah>;
    getAllSurahs(): Promise<Surah[]>; // For the surah list
}
