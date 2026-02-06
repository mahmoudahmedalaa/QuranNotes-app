
import { MatchingService, Verse } from './MatchingService';

const runTests = () => {
    console.log('--- Starting Matching Logic Tests ---');

    // Mocks
    const verse1: Verse = { id: 1, number: 1, text: "بسم الله الرحمن الرحيم" }; // Bismillah...
    const verse2: Verse = { id: 2, number: 2, text: "الحمد لله رب العالمين" }; // Alhamdu lillahi...
    const verse3: Verse = { id: 3, number: 3, text: "الرحمن الرحيم" }; // Ar-Rahman Ar-Rahim
    const verse4: Verse = { id: 4, number: 4, text: "مالك يوم الدين" }; // Maliki Yawm...

    const candidates = [verse1, verse2, verse3, verse4];

    // Scenario 1: Perfect Match Verse 1
    const t1 = "بسم الله الرحمن الرحيم";
    const m1 = MatchingService.findBestMatch(t1, candidates);
    console.log(`Test 1 (Perfect V1): ${m1?.verse.id === 1 ? 'PASS' : 'FAIL'} (Score: ${m1?.confidence})`);

    // Scenario 2: Continuous Speech (V1 + V2)
    const t2 = "بسم الله الرحمن الرحيم الحمد لله رب العالمين";
    // Should match V1 (if we look at all), but if V1 is done, we expect V2.
    // The loop finds highest confidence. Both might be 1.0. Order matters?
    // In our logic, it returns the *highest* confidence. 
    // If scores are equal, which one? The one encountered later?
    // Let's test finding V2 specifically.
    const m2 = MatchingService.findBestMatch(t2, [verse2, verse3]); // Look for V2 specifically
    console.log(`Test 2 (Continuous V1+V2 -> Check V2): ${m2?.verse.id === 2 ? 'PASS' : 'FAIL'} (Score: ${m2?.confidence})`);

    // Scenario 3: Noise + Partial V2
    const t3 = "hmm الحمد لله umm رب العالمين";
    const m3 = MatchingService.findBestMatch(t3, candidates);
    console.log(`Test 3 (Noise V2): ${m3?.verse.id === 2 ? 'PASS' : 'FAIL'} (Score: ${m3?.confidence})`);

    // Scenario 4: False Positive Check (Common Word)
    const t4 = "الله"; // "Allah" appears in V1 and V2.
    // V1 words: 4. Match 1/4 = 0.25. Threshold 0.4.
    // V2 words: 4. Match 1/4 = 0.25. Threshold 0.4.
    // Should return NULL.
    const m4 = MatchingService.findBestMatch(t4, candidates);
    console.log(`Test 4 (Common Word 'Allah'): ${m4 === null ? 'PASS' : 'FAIL'} (Match: ${m4?.verse.id}, Score: ${m4?.confidence})`);

    // Scenario 5: End of Verse (Partial)
    const t5 = "رب العالمين"; // Last part of V2
    // V2 words: 4. Matches "Rabb" "Al-Alamin" (2). Score 0.5.
    // Threshold 0.4. Should match V2.
    const m5 = MatchingService.findBestMatch(t5, candidates);
    console.log(`Test 5 (Partial End V2): ${m5?.verse.id === 2 ? 'PASS' : 'FAIL'} (Score: ${m5?.confidence})`);

    // Scenario 6: Wrong Order
    const t6 = "الرحيم الرحمن"; // Reversed V3
    // V3 words: 2. Matches: "Ar-Rahim" (found), "Ar-Rahman" (not found after).
    // Loop: 
    // i=0 "Rahim": Matches "Rahim"? No, "Rahim" is index 1. 
    // Wait, Sliding Window Logic check:
    // vWords: [Rahman, Rahim]
    // tTokens: [Rahim, Rahman]
    // i=0 (Rahim). vIndex=0 (Rahman). No match.
    // i=1 (Rahman). vIndex=0 (Rahman). MATCH. vIndex becomes 1 (Rahim).
    // End of transcript.
    // Matches: 1. Length: 2. Score 0.5.
    // Threshold (length<4 -> 0.6). 0.5 < 0.6. FAIL.
    // Result should be NULL.
    const m6 = MatchingService.findBestMatch(t6, candidates);
    console.log(`Test 6 (Reversed Order V3): ${m6 === null ? 'PASS' : 'FAIL'} (Score: ${m6?.confidence})`);
};

runTests();
