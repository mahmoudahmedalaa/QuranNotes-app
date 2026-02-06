import { Surah, Verse } from '../../domain/entities/Quran';

interface ApiSurahResponse {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: string;
}

interface ApiVerseResponse {
    number: number;
    text: string;
    numberInSurah: number;
    juz: number;
    manzil: number;
    page: number;
    ruku: number;
    hizbQuarter: number;
    sajda: boolean;
    surah: {
        number: number;
        name: string;
        englishName: string;
        englishNameTranslation: string;
        revelationType: string;
        numberOfAyahs: number;
    };
}

interface ApiEditionResponse {
    data: {
        surahs: {
            number: number;
            name: string;
            englishName: string;
            englishNameTranslation: string;
            revelationType: string;
            ayahs: ApiVerseResponse[];
        }[];
    };
}

export class AlQuranCloudAPI {
    private readonly BASE_URL = 'https://api.alquran.cloud/v1';

    async getSurahList(): Promise<Surah[]> {
        try {
            const response = await fetch(`${this.BASE_URL}/surah`);
            const json = await response.json();

            if (json.code !== 200) throw new Error('Failed to fetch surah list');

            return json.data.map((item: ApiSurahResponse) => ({
                number: item.number,
                name: item.name,
                englishName: item.englishName,
                englishNameTranslation: item.englishNameTranslation,
                numberOfAyahs: item.numberOfAyahs,
                revelationType: item.revelationType as 'Meccan' | 'Medinan',
                verses: [],
            }));
        } catch (error) {
            console.error('Error fetching surah list:', error);
            throw error;
        }
    }

    async getSurah(surahNumber: number): Promise<Surah> {
        try {
            const response = await fetch(
                `${this.BASE_URL}/surah/${surahNumber}/editions/quran-uthmani,en.sahih`,
            );
            const json = await response.json();

            if (json.code !== 200) throw new Error(`Failed to fetch surah ${surahNumber}`);

            const arabicData = json.data[0];
            const englishData = json.data[1];

            const verses: Verse[] = arabicData.ayahs.map(
                (ayah: ApiVerseResponse, index: number) => ({
                    number: ayah.numberInSurah,
                    text: ayah.text,
                    translation: englishData.ayahs[index].text,
                    surahNumber: surahNumber,
                    juz: ayah.juz,
                    page: ayah.page,
                }),
            );

            return {
                number: arabicData.number,
                name: arabicData.name,
                englishName: arabicData.englishName,
                englishNameTranslation: arabicData.englishNameTranslation,
                numberOfAyahs: arabicData.numberOfAyahs,
                revelationType: arabicData.revelationType,
                verses,
            };
        } catch (error) {
            console.error(`Error fetching surah ${surahNumber}:`, error);
            throw error;
        }
    }

    async search(query: string): Promise<Verse[]> {
        try {
            const url = `${this.BASE_URL}/search/${encodeURIComponent(query)}/all/en.sahih`;
            const response = await fetch(url);
            const json = await response.json();

            if (json.code !== 200) return [];

            return json.data.matches.map((match: any) => ({
                number: match.numberInSurah,
                text: match.text,
                translation: match.text,
                surahNumber: match.surah.number,
                juz: 0,
                page: 0,
            }));
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    async getRandomVerse(): Promise<Verse> {
        try {
            // Random global ID 1-6236
            const randomId = Math.floor(Math.random() * 6236) + 1;
            const response = await fetch(
                `${this.BASE_URL}/ayah/${randomId}/editions/quran-uthmani,en.sahih`,
            );
            const json = await response.json();

            if (json.code !== 200) throw new Error('Failed to fetch random verse');

            const arabic = json.data[0];
            const english = json.data[1];

            return {
                number: arabic.numberInSurah,
                text: arabic.text,
                translation: english.text,
                surahNumber: arabic.surah.number,
                juz: arabic.juz,
                page: arabic.page,
            };
        } catch (error) {
            console.error('Random verse failed:', error);
            throw error;
        }
    }
}
