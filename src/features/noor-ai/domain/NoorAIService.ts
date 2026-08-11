import { noorRemoteService, NoorRemoteClient } from '../infrastructure/NoorRemoteService';
import { NoorAnswer, NoorHistoryTurn } from './generatedContract';
import { NoorMessage, VerseContext } from './types';

const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CONTENT = 1_000;

function createRequestId(): string {
    const random = (): string => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
    return `${random()}${random()}-${random()}-4${random().slice(1)}-a${random().slice(1)}-${random()}${random()}${random()}`;
}

function toHistory(messages: NoorMessage[]): NoorHistoryTurn[] {
    return messages.slice(-MAX_HISTORY_TURNS).map((message) => ({
        role: message.role === 'noor' ? 'assistant' : 'user',
        content: message.content.slice(0, MAX_HISTORY_CONTENT),
    }));
}

export function createNoorAIService(remote: NoorRemoteClient, requestIdFactory = createRequestId) {
    return {
        async askNoor(question: string, conversationHistory: NoorMessage[] = []): Promise<NoorAnswer> {
            return remote.ask({
                mode: 'chat',
                requestId: requestIdFactory(),
                question,
                history: toHistory(conversationHistory),
            });
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
    return service.askNoor(question, conversationHistory);
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
