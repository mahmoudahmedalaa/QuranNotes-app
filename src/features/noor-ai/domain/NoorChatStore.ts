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

    let greeting: string;
    if (hour >= 5 && hour < 12) {
        greeting = 'Assalamu Alaikum! ☀️ Good morning! I\'m Noor, your Quran companion. Ask me anything about the Quran — I can explain verses, share scholarly insights, or help you reflect on its teachings.';
    } else if (hour >= 12 && hour < 17) {
        greeting = 'Assalamu Alaikum! 🌤️ Good afternoon! I\'m Noor, your Quran companion. Whether you want to understand a verse, explore a theme, or reflect on the Quran\'s guidance — I\'m here to help.';
    } else if (hour >= 17 && hour < 21) {
        greeting = 'Assalamu Alaikum! 🌅 Good evening! I\'m Noor, your Quran companion. Let me help you explore the beautiful teachings of the Quran tonight.';
    } else {
        greeting = 'Assalamu Alaikum! 🌙 I\'m Noor, your Quran companion. Even at this hour, the Quran\'s guidance is a light. Ask me anything about its verses and teachings.';
    }

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
    const content = `Assalamu Alaikum! ✨ I see you're reading **${verseContext.surahName}**, verse ${verseContext.verseNumber}. I'd love to help you understand this verse better. Ask me anything, or I can start with a summary of what the scholars say about it.`;

    return {
        id: generateId(),
        role: 'noor',
        content,
        timestamp: Date.now(),
        verseContext,
    };
}
