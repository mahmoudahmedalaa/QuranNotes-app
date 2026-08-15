import type { NoorRequest } from './generatedContract';

export type NoorPolicyCategory =
    | 'allowed'
    | 'personal_ruling'
    | 'standalone_hadith'
    | 'medical_legal_crisis'
    | 'prompt_injection'
    | 'out_of_scope';

const PROMPT_INJECTION = /(?:ignore|disregard|override|bypass|reveal|show|repeat).{0,100}(?:system|developer|hidden|prior).{0,40}(?:instruction|prompt|message|rule)|jailbreak|prompt\s+injection/i;
const MEDICAL_LEGAL_CRISIS = /(?:overdos|suicid|self[- ]harm|medical emergency|what medicine|diagnos|legal advice|lawyer|attorney|arrested|court case|criminal charge)/i;
const UNSAFE_HADITH_INTENT = /(?:(?:write|create|generate|compose|author|produce|invent|fabricate|make up).{0,60}hadith|(?:authenticate|verify.{0,40}authenticity).{0,40}hadith|is (?:this|the) hadith authentic|(?:اكتب|أنشئ|انشئ|ألّف|الف|صغ|ابتكر|اخترع|اختلق|افتر).{0,40}حديث|(?:هل.{0,20}الحديث صحيح|تحقق.{0,30}صحة.{0,30}الحديث))/i;
const KNOWN_TAFSIR_SOURCE = /(?:ibn kathir|al-sa['’]?di|ابن كثير|السعدي)/i;
const HADITH_MENTION = /(?:hadith|حديث)/i;
const CITED_IN_VERSE_CONTEXT = /(?:(?:cit|mention|explain).{0,70}(?:this|the) verse|(?:ذكر|أورد|استشهد|شرح).{0,70}(?:تفسير )?(?:هذه|تلك) الآية|تفسير (?:هذه|تلك) الآية)/i;
const EXPLICIT_ISLAMIC_CONTEXT = /(?:qur['’]?an|verse|ayah|surah|tafsir|ibn kathir|al-sa['’]?di|allah|islam|muslim|رحمة|قرآن|آية|سورة|تفسير|الله|إيمان)/i;
const STANDALONE_HADITH = /(?:(?:give|show|quote|find|tell me|share|is there|invent|fabricate|make up|create|write).{0,50}(?:a |the )?hadith|(?:is (?:this|the) hadith authentic|verify.{0,40}authenticity.{0,40}hadith|authenticate.{0,40}hadith)|(?:حديث|أعطني حديث))/i;
const PERSONAL_CONTEXT = /\b(?:for me|for my situation|for my case|for my circumstances|in my situation|in my case|personally|my personal|what should i do|should i|can i|must i|may i)\b|(?:لي|وضعي|حالي|ظروفي|شخصيًا|ماذا أفعل)/i;
const PERSONAL_RULING = /(?:\b(?:halal|haram|permissible|forbidden|fatwa|ruling)\b|(?:حلال|حرام|فتوى|حكم شرعي)).{0,100}(?:\b(?:for me|can i|should i|must i|may i)\b|(?:لي|وضعي|حالي|ظروفي))|\b(?:can i|should i|must i|may i)\b.{0,120}\b(?:halal|haram|permissible|forbidden)\b/i;
const GENERAL_DOCTRINAL_QUESTION = /\b(?:is|are|does|do|what(?:\s+does)?|why)\b.{0,120}\b(?:halal|haram|permissible|forbidden|islamic|islam)\b/i;
const SINGLE_CONCEPT_QUESTION = /^\s*(?:what(?:\s+(?:is|does))?|define|explain|tell me about)\s+(?:the\s+meaning\s+of\s+)?[^\s?!.]+[?!.]?\s*$/i;
const EXPLANATORY_REQUEST = /^\s*(?:explain|define|tell me about)\b/i;
const STRUCTURAL_FOLLOW_UP = /(?:\b(?:alternative|alternatives|what about|what happened next|tell me more|him|her|it|they|this)\b|^\s*(?:why|how)\s*[?!.]?\s*$)/i;

function isTafsirHadithContext(content: string): boolean {
    return KNOWN_TAFSIR_SOURCE.test(content)
        && HADITH_MENTION.test(content)
        && CITED_IN_VERSE_CONTEXT.test(content);
}

export function classifyPolicy(content: string): NoorPolicyCategory {
    if (PROMPT_INJECTION.test(content)) return 'prompt_injection';
    if (MEDICAL_LEGAL_CRISIS.test(content)) return 'medical_legal_crisis';
    if (PERSONAL_RULING.test(content) || PERSONAL_CONTEXT.test(content)) return 'personal_ruling';
    if (UNSAFE_HADITH_INTENT.test(content)) return 'standalone_hadith';
    if (isTafsirHadithContext(content)) return 'allowed';
    if (STANDALONE_HADITH.test(content)) return 'standalone_hadith';
    if (STRUCTURAL_FOLLOW_UP.test(content)) return 'allowed';
    if (GENERAL_DOCTRINAL_QUESTION.test(content)) return 'allowed';
    if (SINGLE_CONCEPT_QUESTION.test(content) || EXPLANATORY_REQUEST.test(content) || EXPLICIT_ISLAMIC_CONTEXT.test(content)) return 'allowed';
    return 'out_of_scope';
}

export function classifyRequestPolicy(request: NoorRequest): NoorPolicyCategory {
    if (request.mode === 'verse_summary') return 'allowed';
    return classifyPolicy(request.question);
}
