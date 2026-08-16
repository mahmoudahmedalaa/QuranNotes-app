import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    generateReflectionPrompts,
    isAiAvailable,
    selectVersesForIntent,
    suggestIntents,
} from './TadabburAIService';
import type { ReflectionIntent } from './entities/Reflection';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

const intent: ReflectionIntent = {
    id: 'patience',
    label: 'Seeking patience',
    category: 'patience',
    icon: 'shield-heart-outline',
    isAiSuggested: false,
    isCustom: false,
};

describe('Tadabbur content service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('selects a bounded curated set without a model dependency', async () => {
        const verses = await selectVersesForIntent(intent, 2);

        expect(verses).toHaveLength(2);
        expect(verses.every((verse) => verse.surahNumber >= 1 && verse.surahNumber <= 114)).toBe(true);
        expect(verses.every((verse) => verse.endVerse >= verse.startVerse)).toBe(true);
        expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('repairs malformed cached verse data with the curated set', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([
            { surahNumber: 999, startVerse: 0, endVerse: 1, reason: '' },
        ]));

        const verses = await selectVersesForIntent(intent, 2);

        expect(verses).toHaveLength(2);
        expect(verses[0].surahNumber).toBe(2);
        expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('returns honest non-AI reflection prompts and availability', async () => {
        const prompts = await generateReflectionPrompts(2, 153, 155, 'Al-Baqarah', intent);

        expect(prompts).toHaveLength(3);
        expect(prompts.every((prompt) => prompt.aiGenerated === false)).toBe(true);
        expect(isAiAvailable()).toBe(false);
    });

    it('offers curated suggestions without presenting them as AI-generated', async () => {
        const suggestions = await suggestIntents(['Seeking patience']);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.some((suggestion) => suggestion.label === 'Seeking patience')).toBe(false);
        expect(suggestions.every((suggestion) => suggestion.isAiSuggested === false)).toBe(true);
    });
});
