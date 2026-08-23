import type { NoorCitation } from './generatedContract';
import type { NoorMessage } from './types';

/** Defensive presentation boundary; the backend remains authoritative. */
export function visibleNoorCitations(message: NoorMessage): readonly NoorCitation[] {
    return message.status === 'answered' ? (message.citations ?? []) : [];
}
