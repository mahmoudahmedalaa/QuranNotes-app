import { IQuranRepository } from '../domain/repositories/IQuranRepository';
import { Surah } from '../domain/entities/Quran';
import { LocalQuranRepository } from './local/LocalQuranRepository';
import { RemoteQuranRepository } from './remote/RemoteQuranRepository';

export class QuranRepository implements IQuranRepository {
    constructor(
        private localRepo: LocalQuranRepository,
        private remoteRepo: RemoteQuranRepository,
    ) { }

    async getSurah(surahNumber: number): Promise<Surah> {
        // 1. Try local
        try {
            const local = await this.localRepo.getSurah(surahNumber);
            if (local) {
                return local;
            }
        } catch (e) {
            // Ignore error and fall back to remote
        }

        // 2. Fetch remote
        const remote = await this.remoteRepo.getSurah(surahNumber);

        // 3. Save local
        await this.localRepo.saveSurah(remote);

        return remote;
    }

    async getAllSurahs(): Promise<Surah[]> {
        // 1. Try local
        const local = await this.localRepo.getAllSurahs();
        if (local && local.length > 0) {
            return local;
        }

        // 2. Fetch remote
        const remote = await this.remoteRepo.getAllSurahs();

        // 3. Save local
        await this.localRepo.saveSurahsList(remote);

        return remote;
    }
}
