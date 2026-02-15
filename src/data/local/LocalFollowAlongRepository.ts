import AsyncStorage from '@react-native-async-storage/async-storage';
import { FollowAlongSession } from '../../domain/entities/FollowAlongSession';
import { IFollowAlongRepository } from '../../domain/repositories/IFollowAlongRepository';

const STORAGE_KEY = '@quran_notes:follow_along_sessions';

/**
 * LocalFollowAlongRepository
 * Persists Follow Along sessions to AsyncStorage
 */
export class LocalFollowAlongRepository implements IFollowAlongRepository {
    async getAllSessions(): Promise<FollowAlongSession[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (!data) return [];

            const sessions = JSON.parse(data);
            // Parse dates back to Date objects
            return sessions.map((s: Omit<FollowAlongSession, 'startedAt' | 'endedAt'> & { startedAt: string; endedAt: string }) => ({
                ...s,
                startedAt: new Date(s.startedAt),
                endedAt: new Date(s.endedAt),
            }));
        } catch (error) {
            console.error('Failed to load follow along sessions:', error);
            return [];
        }
    }

    async getSessionById(id: string): Promise<FollowAlongSession | null> {
        const sessions = await this.getAllSessions();
        return sessions.find(s => s.id === id) || null;
    }

    async saveSession(session: FollowAlongSession): Promise<void> {
        try {
            const sessions = await this.getAllSessions();
            const existingIndex = sessions.findIndex(s => s.id === session.id);

            if (existingIndex >= 0) {
                sessions[existingIndex] = session;
            } else {
                sessions.unshift(session); // Add to beginning (most recent)
            }

            // Keep only last 100 sessions to avoid storage bloat
            const trimmedSessions = sessions.slice(0, 100);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedSessions));
        } catch (error) {
            console.error('Failed to save follow along session:', error);
            throw error;
        }
    }

    async deleteSession(id: string): Promise<void> {
        try {
            const sessions = await this.getAllSessions();
            const filteredSessions = sessions.filter(s => s.id !== id);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSessions));
        } catch (error) {
            console.error('Failed to delete follow along session:', error);
            throw error;
        }
    }

    async getSessionsBySurah(surahId: number): Promise<FollowAlongSession[]> {
        const sessions = await this.getAllSessions();
        return sessions.filter(s => s.surahId === surahId);
    }

    async clearAllSessions(): Promise<void> {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Failed to clear follow along sessions:', error);
        }
    }
}
