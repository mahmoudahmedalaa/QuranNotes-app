/**
 * NoorChatStore — In-session conversation state manager.
 *
 * Manages the current chat session:
 *  - Maintains the message array
 *  - Generates unique message IDs
 *  - Provides add/clear operations
 */

import { NoorMessage, VerseContext } from './types';

let _idCounter = 0;

/** Generate a unique message ID */
function generateId(): string {
    _idCounter += 1;
    return `noor_${Date.now()}_${_idCounter}`;
}

/**
 * Create a new user message.
 */
export function createUserMessage(content: string, verseContext?: VerseContext): NoorMessage {
    return {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
        verseContext,
    };
}

/**
 * Create a Noor response message.
 */
export function createNoorMessage(content: string, cached = false, verseContext?: VerseContext): NoorMessage {
    return {
        id: generateId(),
        role: 'noor',
        content,
        timestamp: Date.now(),
        verseContext,
        cached,
    };
}

/**
 * Create the initial greeting message based on time of day.
 */
export function createGreetingMessage(): NoorMessage {
    const hour = new Date().getHours();

    const greeting = "Assalamu Alaikum! ✨ I'm Noor. How can I help you explore the Quran today?";

    return {
        id: generateId(),
        role: 'noor',
        content: greeting,
        timestamp: Date.now(),
    };
}

/**
 * Create a contextual greeting when launched from a verse.
 */
export function createVerseGreetingMessage(verseContext: VerseContext): NoorMessage {
    const content = `Assalamu Alaikum! ✨ You're looking at **${verseContext.surahName}**, verse ${verseContext.verseNumber}. What would you like to know about it?`;

    return {
        id: generateId(),
        role: 'noor',
        content,
        timestamp: Date.now(),
        verseContext,
    };
}
