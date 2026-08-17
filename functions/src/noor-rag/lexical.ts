const MAX_LEXICAL_QUERY_TOKENS = 6 as const;
const LEXICAL_TOKEN_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}'-]{1,47}$/u;
const LEXICAL_STOP_WORDS = new Set([
    'a', 'about', 'an', 'and', 'are', 'can', 'could', 'describe', 'does', 'do',
    'explain', 'for', 'from', 'give', 'had', 'has', 'have', 'he', 'her', 'him',
    'his', 'how', 'in', 'is', 'it', 'may', 'me', 'might', 'my', 'of', 'on',
    'or', 'our', 'please', 'say', 'she', 'should', 'tell', 'the', 'their', 'them',
    'they', 'this', 'to', 'us', 'was', 'we', 'were', 'what', 'why', 'will',
    'with', 'would', 'you', 'your',
]);

export function tokenizeLexicalQuery(content: string): string[] {
    return [...new Set(content
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(token => LEXICAL_TOKEN_PATTERN.test(token) && !LEXICAL_STOP_WORDS.has(token)))]
        .slice(0, MAX_LEXICAL_QUERY_TOKENS);
}
