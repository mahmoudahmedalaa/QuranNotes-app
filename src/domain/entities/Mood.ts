/**
 * Mood types and interfaces for Quranic Reflection feature.
 */

export type MoodType =
    | 'grateful'
    | 'anxious'
    | 'sad'
    | 'hopeful'
    | 'strong'
    | 'frustrated'
    | 'lost'
    | 'heartbroken'
    | 'confused'
    | 'peaceful'
    | 'lonely'
    | 'inspired';

export interface MoodVerse {
    surah: number;
    verse: number;
    arabicSnippet: string;
    translation: string;
    theme: string;
    /** Full Arabic text fetched at runtime from Quran API */
    arabicFull?: string;
    /** Full English translation fetched at runtime from Quran API */
    translationFull?: string;
}

export interface MoodEntry {
    mood: MoodType;
    timestamp: string; // ISO date string
    versesShown: number[]; // indices into the mood's verse array (for dedup)
}

export interface MoodConfig {
    emoji: string;
    label: string;
    color: string;       // light mode background tint
    darkColor: string;   // dark mode background tint
}

export const MOOD_CONFIGS: Record<MoodType, MoodConfig> = {
    grateful: { emoji: '🤲', label: 'Grateful', color: '#FEF3C7', darkColor: '#78350F' },
    anxious: { emoji: '😰', label: 'Anxious', color: '#DBEAFE', darkColor: '#1E3A5F' },
    sad: { emoji: '😢', label: 'Sad', color: '#E0E7FF', darkColor: '#312E81' },
    hopeful: { emoji: '🌱', label: 'Hopeful', color: '#D1FAE5', darkColor: '#064E3B' },
    strong: { emoji: '💪', label: 'Strong', color: '#FCE7F3', darkColor: '#831843' },
    frustrated: { emoji: '😤', label: 'Frustrated', color: '#FEE2E2', darkColor: '#7F1D1D' },
    lost: { emoji: '🤔', label: 'Lost', color: '#F3E8FF', darkColor: '#581C87' },
    heartbroken: { emoji: '💔', label: 'Heartbroken', color: '#FFE4E6', darkColor: '#881337' },
    confused: { emoji: '🤷', label: 'Confused', color: '#CFFAFE', darkColor: '#164E63' },
    peaceful: { emoji: '😌', label: 'Peaceful', color: '#ECFDF5', darkColor: '#065F46' },
    lonely: { emoji: '😔', label: 'Lonely', color: '#EDE9FE', darkColor: '#4C1D95' },
    inspired: { emoji: '🌟', label: 'Inspired', color: '#FFF7ED', darkColor: '#7C2D12' },
};

export const MOOD_LIST: MoodType[] = [
    'grateful', 'anxious', 'sad', 'hopeful',
    'strong', 'frustrated', 'lost', 'heartbroken',
    'confused', 'peaceful', 'lonely', 'inspired',
];
