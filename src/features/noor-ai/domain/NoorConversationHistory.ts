/**
 * NoorConversationHistory — Persistent conversation storage for Noor AI.
 *
 * Uses AsyncStorage to save/load/delete chat conversations.
 * Max 20 conversations with FIFO eviction.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NoorMessage, NoorConversation, VerseContext } from './types';

// ── Constants ──
const STORAGE_KEY = 'noor_conversations_v1';
const MAX_CONVERSATIONS = 20;

/**
 * Generate a unique conversation ID.
 */
function generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Auto-generate a title from the first user message.
 */
function generateTitle(messages: NoorMessage[], verseContext?: VerseContext): string {
    if (verseContext) {
        return `${verseContext.surahName} ${verseContext.verseNumber}`;
    }

    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
        const text = firstUserMsg.content;
        return text.length > 50 ? text.slice(0, 47) + '...' : text;
    }

    return 'New Conversation';
}

// ── Internal helpers ──

async function loadAllRaw(): Promise<NoorConversation[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as NoorConversation[];
    } catch {
        return [];
    }
}

async function saveAllRaw(conversations: NoorConversation[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

// ── Public API ──

/**
 * Save or update a conversation.
 * If the conversation doesn't exist yet, creates a new one.
 * Enforces MAX_CONVERSATIONS limit with FIFO eviction.
 */
export async function saveConversation(
    conversationId: string | null,
    messages: NoorMessage[],
    verseContext?: VerseContext,
): Promise<string> {
    const conversations = await loadAllRaw();
    const now = Date.now();
    const title = generateTitle(messages, verseContext);

    if (conversationId) {
        // Update existing
        const idx = conversations.findIndex(c => c.id === conversationId);
        if (idx >= 0) {
            conversations[idx].messages = messages;
            conversations[idx].updatedAt = now;
            conversations[idx].title = title;
            await saveAllRaw(conversations);
            return conversationId;
        }
    }

    // Create new conversation
    const id = conversationId || generateId();
    const newConv: NoorConversation = {
        id,
        title,
        messages,
        createdAt: now,
        updatedAt: now,
        verseContext,
    };

    // Add at the beginning (newest first)
    conversations.unshift(newConv);

    // Enforce max limit — remove oldest
    if (conversations.length > MAX_CONVERSATIONS) {
        conversations.splice(MAX_CONVERSATIONS);
    }

    await saveAllRaw(conversations);
    return id;
}

/**
 * Load all conversations (newest first).
 * Returns metadata only (messages are truncated to save memory).
 */
export async function loadConversations(): Promise<Array<{
    id: string;
    title: string;
    messageCount: number;
    lastMessage: string;
    updatedAt: number;
    verseContext?: VerseContext;
}>> {
    const conversations = await loadAllRaw();
    return conversations.map(c => {
        const lastMsg = c.messages[c.messages.length - 1];
        return {
            id: c.id,
            title: c.title,
            messageCount: c.messages.length,
            lastMessage: lastMsg
                ? lastMsg.content.slice(0, 80) + (lastMsg.content.length > 80 ? '...' : '')
                : '',
            updatedAt: c.updatedAt,
            verseContext: c.verseContext,
        };
    });
}

/**
 * Load a specific conversation by ID.
 */
export async function loadConversation(id: string): Promise<NoorConversation | null> {
    const conversations = await loadAllRaw();
    return conversations.find(c => c.id === id) || null;
}

/**
 * Delete a single conversation.
 */
export async function deleteConversation(id: string): Promise<void> {
    const conversations = await loadAllRaw();
    const filtered = conversations.filter(c => c.id !== id);
    await saveAllRaw(filtered);
}

/**
 * Clear all conversation history.
 */
export async function clearAllConversations(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}
