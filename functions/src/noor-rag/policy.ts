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
const STANDALONE_HADITH = /(?:(?:give|show|quote|find|tell me|share|is there|invent|fabricate|make up|create|write).{0,50}(?:a |the )?hadith|(?:is (?:this|the) hadith authentic|verify.{0,40}authenticity.{0,40}hadith|authenticate.{0,40}hadith)|(?:حديث|أعطني حديث))/i;
const PERSONAL_CIRCUMSTANCES = /\b(?:for my (?:situation|case|circumstances)|in my (?:situation|case|circumstances)|given my|because i am|because i have|while (?:pregnant|ill|taking my medication)|my (?:pregnancy|illness|medical condition|medication|contract|finances|family circumstances)|personally tailored)\b|(?:وضعي|حالي|ظروفي|حالتي الصحية|بسبب مرضي)/i;
const PERSONAL_CONDITION_CLAUSE = /\b(?:if|since|while) i(?:'m| am| have)\b|\b(?:during|due to|because of) my\b|(?:إذا كنت|بسبب|أثناء حالتي)/i;
const EXPLICIT_PERSONAL_RULING = /(?:\b(?:halal|haram|permissible|forbidden|fatwa|ruling)\b|(?:حلال|حرام|فتوى|حكم شرعي)).{0,100}(?:\b(?:for me|for my situation|for my case|for my circumstances|in my situation|in my case)\b|(?:لي|وضعي|حالي|ظروفي))/i;
const PRESCRIPTIVE_RULING_REQUEST = /\b(?:issue|give|provide|decide|determine)\b.{0,60}\b(?:personal|individual|tailored)?\s*(?:fatwa|ruling)\b|(?:أعطني|أصدر|حدد).{0,40}(?:فتوى|حكم شرعي)/i;
const PERSONAL_DECISION_REQUEST = /\b(?:(?:can|may|must|should) i|what should i|tell me whether i should|decide whether i should)\b|(?:هل أستطيع|هل يجوز لي|هل ينبغي لي|ماذا ينبغي أن أفعل|قرر لي)/i;

function isTafsirHadithContext(content: string): boolean {
    return KNOWN_TAFSIR_SOURCE.test(content)
        && HADITH_MENTION.test(content)
        && CITED_IN_VERSE_CONTEXT.test(content);
}

export function classifyPolicy(content: string): NoorPolicyCategory {
    if (PROMPT_INJECTION.test(content)) return 'prompt_injection';
    if (MEDICAL_LEGAL_CRISIS.test(content)) return 'medical_legal_crisis';
    if (EXPLICIT_PERSONAL_RULING.test(content)
        || ((PERSONAL_CIRCUMSTANCES.test(content) || PERSONAL_CONDITION_CLAUSE.test(content))
            && (PRESCRIPTIVE_RULING_REQUEST.test(content) || PERSONAL_DECISION_REQUEST.test(content)))) {
        return 'personal_ruling';
    }
    if (UNSAFE_HADITH_INTENT.test(content)) return 'standalone_hadith';
    if (isTafsirHadithContext(content)) return 'allowed';
    if (STANDALONE_HADITH.test(content)) return 'standalone_hadith';
    // Scope is established by grounded retrieval, not by a finite vocabulary or
    // brittle keyword gate. Unknown questions can safely reach retrieval and
    // receive the evidence-limit response when the corpus cannot support them.
    return 'allowed';
}

export function classifyRequestPolicy(request: NoorRequest): NoorPolicyCategory {
    if (request.mode === 'verse_summary') return 'allowed';
    return classifyPolicy(request.question);
}
