/**
 * Noor AI — Barrel export for the flagship AI companion feature.
 */

// Domain
export { askNoor, getSuggestedQuestions, isNoorAvailable } from './domain/NoorAIService';
export {
    createUserMessage,
    createNoorMessage,
    createGreetingMessage,
    createVerseGreetingMessage,
} from './domain/NoorChatStore';
export {
    canSendMessage,
    recordMessageSent,
    getRemainingMessages,
    DAILY_LIMIT,
} from './domain/NoorUsageService';
export {
    saveConversation,
    loadConversations,
    loadConversation,
    deleteConversation,
    clearAllConversations,
} from './domain/NoorConversationHistory';

// Types
export type {
    NoorMessage,
    NoorConversation,
    VerseContext,
    NoorAIParams,
    SuggestedQuestion,
} from './domain/types';

// Presentation
export { default as NoorAIScreen } from './presentation/NoorAIScreen';
export { default as NoorAICard } from './presentation/NoorAICard';
