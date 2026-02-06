import { Verse } from '../../domain/entities/Quran';

export class MatchingService {
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

        // Note: We intentionally avoid "verse.includes(transcript)" for short transcripts unless they are substantial.
        // We only allow verse.includes(transcript) if transcript is long enough (e.g. > 2 words)

        const tWords = normalizedTranscript.split(' ');
        const vWords = normalizedVerse.split(' ');

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

            if (similarity >= minThreshold) {
                if (!bestMatch || similarity > bestMatch.confidence) {
                    bestMatch = { verse, confidence: similarity };
                }
            }
        }

        return bestMatch;
    }
}
