/**
 * NoorUsageService — Free/Pro usage gating for Noor AI.
 *
 * Free users: 5 messages per day (resets at midnight).
 * Pro users:  Unlimited.
 *
 * Uses AsyncStorage for persistence (same pattern as TafsirUsageService).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'noor_ai_usage_v1';
const FREE_DAILY_LIMIT = 5;

interface UsageData {
    /** ISO date string (YYYY-MM-DD) for the last usage day */
    date: string;
    /** Number of messages sent on that date */
    count: number;
}

function todayString(): string {
    return new Date().toISOString().split('T')[0];
}

async function getUsage(): Promise<UsageData> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return { date: todayString(), count: 0 };
        const data: UsageData = JSON.parse(raw);

        // Reset if it's a new day
        if (data.date !== todayString()) {
            return { date: todayString(), count: 0 };
        }
        return data;
    } catch {
        return { date: todayString(), count: 0 };
    }
}

async function setUsage(data: UsageData): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        /* silent */
    }
}

/**
 * Check if a free user can send a message.
 * Pro users bypass this entirely at the call site.
 */
export async function canSendMessage(): Promise<boolean> {
    const usage = await getUsage();
    return usage.count < FREE_DAILY_LIMIT;
}

/**
 * Record that a message was sent. Call after a successful AI response.
 */
export async function recordMessageSent(): Promise<void> {
    const usage = await getUsage();
    usage.count += 1;
    await setUsage(usage);
}

/**
 * Get the remaining free messages for today.
 */
export async function getRemainingMessages(): Promise<number> {
    const usage = await getUsage();
    return Math.max(0, FREE_DAILY_LIMIT - usage.count);
}

/** The daily free limit constant */
export const DAILY_LIMIT = FREE_DAILY_LIMIT;
