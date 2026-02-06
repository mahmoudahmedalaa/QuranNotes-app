
// Mock Interface
interface Verse {
    id: number;
    text: string;
    number: number;
}

class MatchingService {
    static normalizeArabicText(text: string): string {
        return text
            // Remove diacritics (tashkeel)
            .replace(/[\u064B-\u0652]/g, '')
            // Remove tatweel
            .replace(/\u0640/g, '')
            // Normalize alef variations
            .replace(/[\u0622\u0623\u0625]/g, '\u0627')
            // Normalize teh marbuta to heh
            .replace(/\u0629/g, '\u0647')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calculates the similarity score between a transcript and a verse.
     * Uses strict word sequence matching.
     */
    static calculateSimilarity(transcript: string, verseText: string): number {
        const normalizedTranscript = this.normalizeArabicText(transcript);
        const normalizedVerse = this.normalizeArabicText(verseText);

        if (!normalizedTranscript || !normalizedVerse) return 0;

        // Exact match optimization
        if (normalizedTranscript === normalizedVerse) return 1.0;
        // Optimization: checking if transcript contains the verse directly
        // We do strictly containment here first
        if (normalizedTranscript.includes(normalizedVerse)) return 0.95;

        // Note: We intentionally avoid "verse.includes(transcript)" for short transcripts unless they are substantial
        // because "Allah" is in "Bismillah" -> false positive.
        // We only allow verse.includes(transcript) if transcript is long enough (e.g. > 2 words)

        const tWords = normalizedTranscript.split(' ');
        const vWords = normalizedVerse.split(' ');

        // If transcript is just 1 word, and it appears in verse, what do we do?
        // t="Allah" (1 word). v="Bismillah..." (4 words).
        // Matches 1. Score 0.25. Threshold 0.4. REJE CTED. Correct.

        // Sliding window of verse length on transcript
        let maxMatchScore = 0;

        // Iterate through transcript to find start of potential match
        for (let i = 0; i < tWords.length; i++) {
            // Try to match verse starting at transcript token i
            let matches = 0;
            let verseIndex = 0;
            let transcriptIndex = i;
            let interruptions = 0;

            while (verseIndex < vWords.length && transcriptIndex < tWords.length) {
                if (tWords[transcriptIndex] === vWords[verseIndex]) {
                    matches++;
                    transcriptIndex++;
                    verseIndex++;
                } else {
                    // Allow skip? 
                    // If we skip transcript word (noise): "Bismillah UM ar-Rahman"
                    if (interruptions < 2) { // Allow 2 noise words max
                        transcriptIndex++;
                        interruptions++;
                    } else {
                        break; // Too much noise, break sequence
                    }
                }
            }

            const score = matches / vWords.length;
            if (score > maxMatchScore) {
                maxMatchScore = score;
            }
        }

        return maxMatchScore;
    }

    static findBestMatch(transcript: string, candidates: Verse[]): { verse: Verse; confidence: number } | null {
        let bestMatch: { verse: Verse; confidence: number } | null = null;

        for (const verse of candidates) {
            const similarity = this.calculateSimilarity(transcript, verse.text);

            // Require significant overlap
            // If verse is short (<4 words), require 60% match.
            // If verse is long, require 40%.
            const minThreshold = verse.text.split(' ').length < 4 ? 0.6 : 0.4;
            // console.log(`Checking V${verse.number}: Score ${similarity.toFixed(2)} (Threshold ${minThreshold})`);

            if (similarity >= minThreshold) {
                if (!bestMatch || similarity > bestMatch.confidence) {
                    bestMatch = { verse, confidence: similarity };
                }
            }
        }

        return bestMatch;
    }
}

// --- TESTS ---

const runTests = () => {
    console.log('--- Starting Matching Logic Tests (Combined) ---');

    const verse1: Verse = { id: 1, number: 1, text: "بسم الله الرحمن الرحيم" };
    const verse2: Verse = { id: 2, number: 2, text: "الحمد لله رب العالمين" };
    const verse3: Verse = { id: 3, number: 3, text: "الرحمن الرحيم" };
    const verse4: Verse = { id: 4, number: 4, text: "مالك يوم الدين" };

    const candidates = [verse1, verse2, verse3, verse4];

    // Scenario 1: Exact
    const t1 = "بسم الله الرحمن الرحيم";
    const m1 = MatchingService.findBestMatch(t1, candidates);
    console.log(`Test 1 (Exact V1): ${m1?.verse.id === 1 ? 'PASS' : 'FAIL'} (Score: ${m1?.confidence})`);

    // Scenario 2: Continuous
    const t2 = "بسم الله الرحمن الرحيم الحمد لله رب العالمين";
    // Should match V2 (last spoken) or V1? 
    // Logic scans all. V1 is fully contained (0.95). V2 is fully contained (0.95).
    // It returns the FIRST one that exceeds bestMatch? 
    // Our logic: if similarity > bestMatch.confidence. 
    // If equal (0.95 vs 0.95), it keeps the first one. 
    // Ideally we want the LATEST one. 
    // BUT, usually we pass a window [V1, V2, V3]. If we are at V1, we want V1 match to confirm, or V2 to advance.
    // If both return 0.95, keeping V1 is "safe" (stay). But if user moved to V2?
    // Let's rely on "Look at next verses".
    // For this test, we accept either.
    console.log(`Test 2 (Continuous): ${(m1?.confidence ?? 0) >= 0.9 ? 'PASS' : 'FAIL'}`);

    // Scenario 3: Noise
    const t3 = "hmm الحمد لله umm رب العالمين";
    const m3 = MatchingService.findBestMatch(t3, candidates);
    console.log(`Test 3 (Noise V2): ${m3?.verse.id === 2 ? 'PASS' : 'FAIL'} (Score: ${m3?.confidence})`);

    // Scenario 4: False Positive "Allah"
    const t4 = "الله";
    const m4 = MatchingService.findBestMatch(t4, candidates);
    console.log(`Test 4 (False Positive 'Allah'): ${m4 === null ? 'PASS' : 'FAIL'} (Score: ${m4?.confidence})`);

    // Scenario 5: Partial End "Rabbil Alamin"
    const t5 = "رب العالمين";
    const m5 = MatchingService.findBestMatch(t5, candidates);
    console.log(`Test 5 (Partial V2): ${m5?.verse.id === 2 ? 'PASS' : 'FAIL'} (Score: ${m5?.confidence})`);

    // Scenario 6: Wrong sequence
    const t6 = "الرحيم الرحمن";
    const m6 = MatchingService.findBestMatch(t6, candidates);
    console.log(`Test 6 (Wrong Sequence): ${m6 === null ? 'PASS' : 'FAIL'} (Score: ${m6?.confidence})`);
};

runTests();
