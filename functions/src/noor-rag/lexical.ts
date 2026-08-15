const MAX_LEXICAL_QUERY_TOKENS = 6 as const;
const LEXICAL_TOKEN_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}'-]{1,47}$/u;
const LEXICAL_STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'can', 'does', 'do', 'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'this', 'to', 'what', 'why', 'with']);

export function tokenizeLexicalQuery(content: string): string[] {
    return [...new Set(content
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(token => LEXICAL_TOKEN_PATTERN.test(token) && !LEXICAL_STOP_WORDS.has(token)))]
        .slice(0, MAX_LEXICAL_QUERY_TOKENS);
}
