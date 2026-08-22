/**
 * NoorConversationHistory — Persistent conversation storage for Noor AI.
 *
 * Uses AsyncStorage to save/load/delete chat conversations.
 * Max 20 conversations with FIFO eviction.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserScopedStorage } from '../../../core/storage/UserScopedStorage';
import { NoorChatRequest } from './generatedContract';
import { NoorMessage, NoorConversation, VerseContext } from './types';

// ── Constants ──
const STORAGE_KEY = '@noor_conversations_v1';
const PENDING_REQUEST_STORAGE_KEY = '@noor_pending_request_v1';
const MAX_CONVERSATIONS = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PENDING_RECOVERY_AGE_MS = 9 * 60_000;

export interface PendingNoorRequest {
    version: 1;
    status: 'pending' | 'recovering';
    ownerUid: string;
    conversationId: string;
    userMessageId: string;
    createdAt: number;
    request: NoorChatRequest;
}

// ── Simple Async Mutex ──
let _lockPromise: Promise<void> = Promise.resolve();
async function runWithLock<T>(fn: () => Promise<T>): Promise<T> {
    const prevLock = _lockPromise;
    let releaseLock: () => void;
    _lockPromise = new Promise((resolve) => {
        releaseLock = resolve;
    });

    try {
        await prevLock;
        return await fn();
    } finally {
        releaseLock!();
    }
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

/**
 * Strip common markdown formatting for plain-text preview.
 * Removes: **bold**, *italic*, __underline__, ~~strikethrough~~,
 * `code`, [links](url), headers (#), bullet points, emoji shortcodes.
 */
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
        .replace(/__(.+?)__/g, '$1')         // __underline__
        .replace(/\*(.+?)\*/g, '$1')         // *italic*
        .replace(/_(.+?)_/g, '$1')           // _italic_
        .replace(/~~(.+?)~~/g, '$1')         // ~~strikethrough~~
        .replace(/`(.+?)`/g, '$1')           // `code`
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url)
        .replace(/^#{1,6}\s+/gm, '')         // # headers
        .replace(/^[-*+]\s+/gm, '')          // bullet points
        .replace(/\n{2,}/g, ' ')             // collapse newlines
        .replace(/\n/g, ' ')                 // single newlines → space
        .trim();
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPendingNoorRequest(value: unknown): value is PendingNoorRequest {
    if (!isRecord(value)
        || value.version !== 1
        || (value.status !== 'pending' && value.status !== 'recovering')
        || typeof value.ownerUid !== 'string'
        || value.ownerUid.trim() === ''
        || typeof value.conversationId !== 'string'
        || value.conversationId.trim() === ''
        || typeof value.userMessageId !== 'string'
        || value.userMessageId.trim() === ''
        || typeof value.createdAt !== 'number'
        || !Number.isFinite(value.createdAt)
        || value.createdAt <= 0
        || !isRecord(value.request)) return false;

    const request = value.request;
    if (request.mode !== 'chat'
        || typeof request.requestId !== 'string'
        || !UUID_PATTERN.test(request.requestId)
        || typeof request.question !== 'string'
        || request.question.trim() === ''
        || !Array.isArray(request.history)
        || request.history.length > 6
        || !request.history.every((turn) => isRecord(turn)
            && (turn.role === 'user' || turn.role === 'assistant')
            && typeof turn.content === 'string')) return false;

    if (request.verseContext !== undefined) {
        if (!isRecord(request.verseContext)
            || !Number.isInteger(request.verseContext.surah)
            || !Number.isInteger(request.verseContext.verse)
            || (request.verseContext.surah as number) < 1
            || (request.verseContext.verse as number) < 1) return false;
    }

    return true;
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
    return runWithLock(async () => {
        const conversations = await loadAllRaw();
        const now = Date.now();
        const title = generateTitle(messages, verseContext);

        if (conversationId) {
            // Update existing
            const idx = conversations.findIndex(c => c.id === conversationId);
            if (idx >= 0) {
                conversations[idx].messages = messages;
                conversations[idx].updatedAt = now;
                // keep title the same to avoid weird UX jumps, or update it if needed.
                // Currently, we'll just keep the original title.
                await saveAllRaw(conversations);
                return conversationId;
            }
        }

        // Create new
        const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
        const newConv: NoorConversation = {
            id,
            title,
            messages,
            createdAt: now,
            updatedAt: now,
            verseContext,
        };

        conversations.unshift(newConv);

        // Evict older ones if we exceed max
        if (conversations.length > MAX_CONVERSATIONS) {
            conversations.splice(MAX_CONVERSATIONS);
        }

        await saveAllRaw(conversations);
        return id;
    });
}

/**
 * Load all conversations (newest first).
 * Returns metadata only (messages are truncated to save memory).
 */
export async function loadConversations(): Promise<{
    id: string;
    title: string;
    messageCount: number;
    lastMessage: string;
    updatedAt: number;
    verseContext?: VerseContext;
}[]> {
    const conversations = await loadAllRaw();
    return conversations.map(c => {
        const lastMsg = c.messages[c.messages.length - 1];
        const rawContent = lastMsg?.content ?? '';
        const plainText = stripMarkdown(rawContent);
        return {
            id: c.id,
            title: c.title,
            messageCount: c.messages.length,
            lastMessage: plainText.length > 80
                ? plainText.slice(0, 77) + '...'
                : plainText,
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
 * Delete a conversation.
 */
export async function deleteConversation(id: string): Promise<void> {
    return runWithLock(async () => {
        const conversations = await loadAllRaw();
        const filtered = conversations.filter(c => c.id !== id);
        await saveAllRaw(filtered);
    });
}

/**
 * Clear all conversation history.
 */
export async function clearAllConversations(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Persist only the replayable request payload and local conversation identity. */
export async function savePendingNoorRequest(pending: PendingNoorRequest): Promise<void> {
    await UserScopedStorage.setItem(
        PENDING_REQUEST_STORAGE_KEY,
        pending.ownerUid,
        JSON.stringify(pending),
    );
}

export async function loadPendingNoorRequest(ownerUid: string): Promise<PendingNoorRequest | null> {
    try {
        const raw = await UserScopedStorage.getItem(PENDING_REQUEST_STORAGE_KEY, ownerUid, false);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (isPendingNoorRequest(parsed) && parsed.ownerUid === ownerUid) return parsed;
    } catch {
        // Invalid local state is removed below and never replayed.
    }
    await UserScopedStorage.removeItem(PENDING_REQUEST_STORAGE_KEY, ownerUid);
    return null;
}

export async function clearPendingNoorRequest(requestId: string, ownerUid: string): Promise<void> {
    const pending = await loadPendingNoorRequest(ownerUid);
    if (pending?.request.requestId === requestId) {
        await UserScopedStorage.removeItem(PENDING_REQUEST_STORAGE_KEY, ownerUid);
    }
}

export function isPendingNoorRequestRecoverable(
    pending: PendingNoorRequest,
    nowMs = Date.now(),
): boolean {
    const ageMs = nowMs - pending.createdAt;
    return ageMs >= 0 && ageMs < MAX_PENDING_RECOVERY_AGE_MS;
}
