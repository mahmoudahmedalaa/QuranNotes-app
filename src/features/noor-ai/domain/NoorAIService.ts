import { noorRemoteService, NoorRemoteClient } from '../infrastructure/NoorRemoteService';
import {
    NoorAnswer,
    NoorChatRequest,
    NoorHistoryTurn,
    NoorVerseContext,
} from './generatedContract';
import { NoorMessage, VerseContext } from './types';

const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CONTENT = 1_000;

export function createRequestId(): string {
    const random = (): string => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
    return `${random()}${random()}-${random()}-4${random().slice(1)}-a${random().slice(1)}-${random()}${random()}${random()}`;
}

export function createNoorChatRequest(
    question: string,
    conversationHistory: NoorMessage[] = [],
    requestId = createRequestId(),
    verseContext?: VerseContext,
): NoorChatRequest {
    return {
        mode: 'chat',
        requestId,
        question,
        history: toHistory(conversationHistory),
        ...(verseContext ? {
            verseContext: {
                surah: verseContext.surahNumber,
                verse: verseContext.verseNumber,
            } satisfies NoorVerseContext,
        } : {}),
    };
}

export type NoorRequestLifecycleState = 'pending' | 'recovering';

interface RecoverNoorRequestOptions {
    maxAttempts?: number;
    retryDelaysMs?: number[];
    sleep?: (delayMs: number) => Promise<void>;
    onStateChange?: (state: NoorRequestLifecycleState) => void | Promise<void>;
    canAttempt?: () => boolean;
    expectedOwnerUid?: string;
}

// Covers the backend's two-minute in-progress lease without busy polling.
const DEFAULT_RECOVERY_DELAYS_MS = [
    1_000, 2_000, 4_000, 8_000,
    15_000, 15_000, 15_000, 15_000, 15_000, 15_000, 15_000,
];

export class NoorRecoveryPendingError extends Error {
    constructor() {
        super('Noor request recovery remains pending');
        this.name = 'NoorRecoveryPendingError';
    }
}

export class NoorRecoveryExpiredError extends Error {
    constructor() {
        super('Noor request recovery window expired');
        this.name = 'NoorRecoveryExpiredError';
    }
}

function defaultSleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Retry a replayable Noor request without changing its idempotency identity.
 * A request_busy response is exposed publicly as temporarily_unavailable, so
 * recovery gives the original backend invocation time to finalize before the
 * UI treats that status as a genuine failure.
 */
export async function recoverNoorRequest(
    request: NoorChatRequest,
    remote: NoorRemoteClient = noorRemoteService,
    options: RecoverNoorRequestOptions = {},
): Promise<NoorAnswer> {
    const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_RECOVERY_DELAYS_MS.length + 1));
    const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RECOVERY_DELAYS_MS;
    const sleep = options.sleep ?? defaultSleep;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (options.canAttempt && !options.canAttempt()) {
            throw new NoorRecoveryExpiredError();
        }
        await options.onStateChange?.(attempt === 0 ? 'pending' : 'recovering');
        try {
            const response = await remote.ask(request, options.expectedOwnerUid);
            if (response.status !== 'temporarily_unavailable') {
                return response;
            }
            lastError = new NoorRecoveryPendingError();
            if (attempt === maxAttempts - 1) throw lastError;
        } catch (error: unknown) {
            lastError = error;
            if (attempt === maxAttempts - 1) throw error;
        }

        await sleep(retryDelaysMs[attempt] ?? retryDelaysMs.at(-1) ?? 0);
    }

    throw lastError instanceof Error ? lastError : new Error('Noor recovery exhausted');
}

export function isNoorResumeTransition(
    previousState: string,
    nextState: string,
    hasPendingRequest: boolean,
): boolean {
    return hasPendingRequest
        && nextState === 'active'
        && (previousState === 'background' || previousState === 'inactive');
}

function toHistory(messages: NoorMessage[]): NoorHistoryTurn[] {
    return messages.slice(-MAX_HISTORY_TURNS).map((message) => ({
        role: message.role === 'noor' ? 'assistant' : 'user',
        content: message.content.slice(0, MAX_HISTORY_CONTENT),
    }));
}

export function createNoorAIService(remote: NoorRemoteClient, requestIdFactory = createRequestId) {
    return {
        async askNoor(
            question: string,
            conversationHistory: NoorMessage[] = [],
            verseContext?: VerseContext,
        ): Promise<NoorAnswer> {
            const request = createNoorChatRequest(
                question,
                conversationHistory,
                requestIdFactory(),
                verseContext,
            );
            return remote.ask(request);
        },
    };
}

const service = createNoorAIService(noorRemoteService);

export async function askNoor(
    question: string,
    conversationHistory: NoorMessage[] = [],
    _tafsirContext?: string,
    _verseContext?: VerseContext,
): Promise<NoorAnswer> {
    return service.askNoor(question, conversationHistory, _verseContext);
}

export function getSuggestedQuestions(verseContext?: VerseContext): string[] {
    if (verseContext) {
        return [
            `What does ${verseContext.surahName} ${verseContext.verseNumber} teach us?`,
            'What is the historical context of this verse?',
            'How can I apply this verse in my daily life?',
            'Are there related verses on this topic?',
        ];
    }
    return [
        'What are the main themes of Surah Al-Baqarah?',
        'How does the Quran describe patience?',
        'What is the story of Prophet Yusuf (AS)?',
        'What does the Quran say about gratitude?',
    ];
}

export function isNoorAvailable(): boolean {
    return true;
}
