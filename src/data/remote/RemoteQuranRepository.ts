import { Surah } from '../../domain/entities/Quran';
import { QuranMapper } from '../models/QuranMapper';

export class RemoteQuranRepository {
    private readonly API_BASE = 'https://api.alquran.cloud/v1';

    async getSurah(surahNumber: number): Promise<Surah> {
        const response = await fetch(
            `${this.API_BASE}/surah/${surahNumber}/editions/quran-uthmani,en.sahih`,
        );
        if (!response.ok) {
            throw new Error(`Failed to fetch Surah ${surahNumber}`);
        }
        const data = await response.json();
        return QuranMapper.toDomain(data);
    }

    async getAllSurahs(): Promise<Surah[]> {
        const response = await fetch(`${this.API_BASE}/surah`);
        if (!response.ok) {
            throw new Error('Failed to fetch surah list');
        }
        const data = await response.json();
        return QuranMapper.toDomainList(data);
    }
}
