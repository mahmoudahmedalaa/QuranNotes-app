import type { NoorRequest } from './generatedContract';

export type NoorPolicyCategory =
    | 'allowed'
    | 'personal_ruling'
    | 'standalone_hadith'
    | 'medical_legal_crisis'
    | 'prompt_injection';

const PROMPT_INJECTION = /(?:ignore|disregard|override|bypass|reveal|show|repeat).{0,100}(?:system|developer|hidden|prior).{0,40}(?:instruction|prompt|message|rule)|jailbreak|prompt\s+injection/i;
const MEDICAL_LEGAL_CRISIS = /(?:overdos|suicid|self[- ]harm|medical emergency|what medicine|diagnos|legal advice|lawyer|attorney|arrested|court case|criminal charge)/i;
const TAFSIR_HADITH_CONTEXT = /(?:hadith.{0,80}(?:ibn kathir|al-sa['’]?di).{0,80}(?:cit|mention|explain|tafsir|verse)|(?:ibn kathir|al-sa['’]?di).{0,80}(?:cit|mention|explain).{0,50}hadith)/i;
const STANDALONE_HADITH = /(?:(?:give|show|quote|find|tell me|share|is there|invent|fabricate|make up|create|write).{0,50}(?:a |the )?hadith|(?:is (?:this|the) hadith authentic|verify.{0,40}authenticity.{0,40}hadith|authenticate.{0,40}hadith)|(?:حديث|أعطني حديث))/i;
const PERSONAL_RULING = /(?:\b(?:halal|haram|permissible|forbidden|fatwa|ruling)\b|(?:حلال|حرام|فتوى|حكم شرعي)).{0,100}(?:\b(?:for me|can i|should i|must i|may i)\b|[؟?])|\b(?:can i|should i|must i|may i)\b.{0,100}\b(?:halal|haram|permissible|forbidden)\b/i;

export function classifyPolicy(content: string): NoorPolicyCategory {
    if (PROMPT_INJECTION.test(content)) return 'prompt_injection';
    if (MEDICAL_LEGAL_CRISIS.test(content)) return 'medical_legal_crisis';
    if (TAFSIR_HADITH_CONTEXT.test(content)) return 'allowed';
    if (STANDALONE_HADITH.test(content)) return 'standalone_hadith';
    if (PERSONAL_RULING.test(content)) return 'personal_ruling';
    return 'allowed';
}

export function classifyRequestPolicy(request: NoorRequest): NoorPolicyCategory {
    if (request.mode === 'verse_summary') return 'allowed';
    return classifyPolicy(request.question);
}
