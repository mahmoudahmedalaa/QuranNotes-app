import { Surah } from '../../entities/Quran';
import { IQuranRepository } from '../../repositories/IQuranRepository';

export class GetAllSurahsUseCase {
    constructor(private quranRepo: IQuranRepository) {}

    async execute(): Promise<Surah[]> {
        return await this.quranRepo.getAllSurahs();
    }
}
