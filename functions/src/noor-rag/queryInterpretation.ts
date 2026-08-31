const MIN_CORRECTABLE_TOKEN_LENGTH = 4;

// Generic question operators only. Domain subjects and evidence vocabulary do
// not belong here: correction is limited to interpreting the user's request.
const STRUCTURAL_QUERY_VOCABULARY = [
    'after',
    'before',
    'because',
    'between',
    'compare',
    'different',
    'happened',
    'later',
    'permitted',
    'prohibited',
    'required',
    'similar',
    'without',
] as const;

function isSingleOmission(token: string, candidate: string): boolean {
    if (candidate.length !== token.length + 1) return false;
    for (let index = 0; index < candidate.length; index += 1) {
        if (`${candidate.slice(0, index)}${candidate.slice(index + 1)}` === token) return true;
    }
    return false;
}

function isAdjacentTransposition(token: string, candidate: string): boolean {
    if (candidate.length !== token.length) return false;
    for (let index = 0; index < token.length - 1; index += 1) {
        if (token[index] === token[index + 1]) continue;
        const swapped = `${token.slice(0, index)}${token[index + 1]}${token[index]}${token.slice(index + 2)}`;
        if (swapped === candidate) return true;
    }
    return false;
}

function uniqueStructuralCorrection(token: string): string | null {
    if (token.length < MIN_CORRECTABLE_TOKEN_LENGTH) return null;
    const matches = STRUCTURAL_QUERY_VOCABULARY.filter(candidate => (
        isSingleOmission(token, candidate) || isAdjacentTransposition(token, candidate)
    ));
    return matches.length === 1 ? matches[0] : null;
}

export function normalizeQueryInterpretation(value: string): string {
    return value.normalize('NFKC').replace(/[\p{L}]+/gu, rawToken => {
        const correction = uniqueStructuralCorrection(rawToken.toLocaleLowerCase());
        return correction ?? rawToken;
    });
}
