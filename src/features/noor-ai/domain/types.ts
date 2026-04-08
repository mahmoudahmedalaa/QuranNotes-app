/**
 * Noor AI — Shared types for the flagship AI companion feature.
 */

/** A single message in a Noor AI conversation. */
export interface NoorMessage {
    id: string;
    role: 'user' | 'noor';
    content: string;
    timestamp: number;
    /** Optional verse context this message relates to */
    verseContext?: VerseContext;
    /** Whether this response was served from cache */
    cached?: boolean;
}

/** Verse context for contextual questions */
export interface VerseContext {
    surahNumber: number;
    surahName: string;
    verseNumber: number;
    arabicText?: string;
    translation?: string;
}

/** Conversation session */
export interface NoorConversation {
    id: string;
    title: string;
    messages: NoorMessage[];
    createdAt: number;
    updatedAt: number;
    verseContext?: VerseContext;
}

/** Route params for deep-linking into Noor AI */
export interface NoorAIParams {
    surahNumber?: string;
    surahName?: string;
    verseNumber?: string;
    arabicText?: string;
    translation?: string;
    initialQuestion?: string;
    /** Resume a past conversation by ID */
    conversationId?: string;
}

/** Suggested question chip */
export interface SuggestedQuestion {
    text: string;
    icon?: string;
}
