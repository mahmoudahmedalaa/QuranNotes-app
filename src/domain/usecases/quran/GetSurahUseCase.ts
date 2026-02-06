import { Surah } from '../../entities/Quran';
import { IQuranRepository } from '../../repositories/IQuranRepository';

export class GetSurahUseCase {
    constructor(private quranRepo: IQuranRepository) {}

    async execute(surahNumber: number): Promise<Surah> {
        return await this.quranRepo.getSurah(surahNumber);
    }
}
