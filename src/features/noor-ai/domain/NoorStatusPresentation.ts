import { NoorStatus } from './generatedContract';

export type NoorStatusAction = 'none' | 'paywall' | 'retry';

interface NoorStatusInput {
    status: NoorStatus;
    nextResetAt?: string;
}

export interface NoorStatusPresentation {
    message: string;
    action: NoorStatusAction;
}

function formatUtcReset(timestamp?: string): string | null {
    if (!timestamp || !timestamp.endsWith('Z')) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
    const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    return `${day} ${month} ${date.getUTCFullYear()} at ${time} UTC`;
}

export function getNoorStatusPresentation(input: NoorStatusInput): NoorStatusPresentation {
    switch (input.status) {
        case 'answered':
            return { message: '', action: 'none' };
        case 'not_entitled':
            return { message: 'Noor AI is available with Pro access.', action: 'paywall' };
        case 'quota_exceeded': {
            const reset = formatUtcReset(input.nextResetAt);
            return {
                message: reset
                    ? `Your daily Noor allowance is used. It resets on ${reset}.`
                    : 'Your daily Noor allowance is used. It resets at the next UTC day.',
                action: 'none',
            };
        }
        case 'policy_refusal':
            return { message: "I can't help with that request.", action: 'none' };
        case 'insufficient_evidence':
            return { message: "I couldn't find enough reliable tafsir evidence to answer that safely.", action: 'none' };
        case 'invalid_request':
            return { message: 'Please revise your question and try again.', action: 'none' };
        case 'temporarily_unavailable':
            return { message: 'Noor is temporarily unavailable. Please try again.', action: 'retry' };
    }
}
