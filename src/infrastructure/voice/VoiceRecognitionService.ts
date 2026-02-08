/**
 * VoiceRecognitionService
 * Real-time Arabic speech recognition for Follow Along feature.
 * Uses @jamsch/expo-speech-recognition native module.
 * Gracefully degrades when native module is unavailable (e.g., Expo Go).
 */

let ExpoSpeechRecognitionModule: any = null;
let addSpeechRecognitionListener: any = null;

try {
    const mod = require('@jamsch/expo-speech-recognition');
    ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
    addSpeechRecognitionListener = mod.addSpeechRecognitionListener;
} catch {
    console.warn('[VoiceRecognition] Native module not available — voice features disabled');
}

export interface VoiceRecognitionResult {
    transcript: string;
    isFinal: boolean;
    confidence: number;
}

export type VoiceRecognitionCallback = (result: VoiceRecognitionResult) => void;
export type VoiceRecognitionErrorCallback = (error: string) => void;

class VoiceRecognitionServiceImpl {
    private isListening: boolean = false;
    private onResultCallback: VoiceRecognitionCallback | null = null;
    private onErrorCallback: VoiceRecognitionErrorCallback | null = null;
    private listeners: { remove: () => void }[] = [];

    async requestPermissions(): Promise<boolean> {
        if (!ExpoSpeechRecognitionModule) return false;
        try {
            const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            return result.granted;
        } catch (error) {
            console.error('Failed to request speech permissions:', error);
            return false;
        }
    }

    async startListening(
        onResult: VoiceRecognitionCallback,
        onError?: VoiceRecognitionErrorCallback
    ): Promise<boolean> {
        if (this.isListening) {
            console.log('Already listening');
            return true;
        }

        this.onResultCallback = onResult;
        this.onErrorCallback = onError || null;

        try {
            // Request permissions first
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                onError?.('Microphone permission denied. Please enable microphone access in Settings.');
                return false;
            }

            // Set up listeners before starting
            const resultListener = addSpeechRecognitionListener('result', (event: any) => {
                if (event.results && event.results.length > 0) {
                    const result = event.results[0];
                    this.onResultCallback?.({
                        transcript: result.transcript,
                        isFinal: event.isFinal,
                        confidence: result.confidence || 0.8,
                    });
                }
            });

            const errorListener = addSpeechRecognitionListener('error', (event: any) => {
                console.error('Speech recognition error:', event.error, event.message);
                this.onErrorCallback?.(event.message || event.error || 'Recognition error');
            });

            const endListener = addSpeechRecognitionListener('end', () => {
                // Auto-restart for continuous recognition if still active
                if (this.isListening) {
                    this.restartRecognition();
                }
            });

            this.listeners = [resultListener, errorListener, endListener];

            // Start native speech recognition with Arabic
            ExpoSpeechRecognitionModule.start({
                lang: 'ar-SA', // Arabic (Saudi Arabia) - best for Quran recitation
                interimResults: true, // Get partial results
                continuous: true, // Keep listening
                requiresOnDeviceRecognition: false, // Allow network-based for better accuracy
                addsPunctuation: false, // No punctuation needed for Quran matching
            });

            this.isListening = true;
            console.log('Voice recognition started (Arabic - ar-SA)');
            return true;
        } catch (error) {
            console.error('Failed to start listening:', error);
            onError?.(error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }

    private restartRecognition(): void {
        try {
            ExpoSpeechRecognitionModule.start({
                lang: 'ar-SA',
                interimResults: true,
                continuous: true,
                requiresOnDeviceRecognition: false,
                addsPunctuation: false,
            });
        } catch (error) {
            console.error('Failed to restart recognition:', error);
        }
    }

    async stopListening(): Promise<void> {
        if (!this.isListening) return;

        this.isListening = false;
        this.onResultCallback = null;
        this.onErrorCallback = null;

        // Remove all listeners
        for (const listener of this.listeners) {
            listener.remove();
        }
        this.listeners = [];

        try {
            ExpoSpeechRecognitionModule.stop();
        } catch (error) {
            console.error('Failed to stop listening:', error);
        }

        console.log('Voice recognition stopped');
    }

    getIsListening(): boolean {
        return this.isListening;
    }

    /**
     * Normalize Arabic text for comparison
     * Removes diacritics and normalizes characters
     */
    /**
     * Normalize Arabic text for comparison
     * Removes diacritics and normalizes characters
     */
    normalizeArabicText(text: string): string {
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
     * Calculate similarity between two Arabic texts
     * Returns a score between 0 and 1
     */
    calculateSimilarity(text1: string, text2: string): number {
        const normalized1 = this.normalizeArabicText(text1);
        const normalized2 = this.normalizeArabicText(text2);

        if (!normalized1 || !normalized2) return 0;
        if (normalized1 === normalized2) return 1.0;

        // Check if one text contains the other (partial match)
        if (normalized2.includes(normalized1)) {
            return 0.9; // High confidence for substring match
        }
        if (normalized1.includes(normalized2)) {
            return 0.8;
        }

        // Word-based similarity with ordering consideration
        const words1 = normalized1.split(' ');
        const words2 = normalized2.split(' ');

        let consecutiveMatches = 0;
        let maxConsecutive = 0;
        let totalMatches = 0;

        for (const word1 of words1) {
            const matchIndex = words2.indexOf(word1);
            if (matchIndex !== -1) {
                totalMatches++;
                consecutiveMatches++;
                maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
            } else {
                consecutiveMatches = 0;
            }
        }

        if (totalMatches === 0) return 0;

        const maxLength = Math.max(words1.length, words2.length);
        const baseScore = totalMatches / maxLength;
        const consecutiveBonus = maxConsecutive > 2 ? 0.1 : 0;

        return Math.min(baseScore + consecutiveBonus, 1.0);
    }
}

// Export singleton instance
const VoiceRecognitionService = new VoiceRecognitionServiceImpl();
export default VoiceRecognitionService;
export { VoiceRecognitionServiceImpl };
