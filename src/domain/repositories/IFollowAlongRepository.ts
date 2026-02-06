import { FollowAlongSession } from '../../domain/entities/FollowAlongSession';

/**
 * Interface for Follow Along Session Repository
 */
export interface IFollowAlongRepository {
    getAllSessions(): Promise<FollowAlongSession[]>;
    getSessionById(id: string): Promise<FollowAlongSession | null>;
    saveSession(session: FollowAlongSession): Promise<void>;
    deleteSession(id: string): Promise<void>;
    getSessionsBySurah(surahId: number): Promise<FollowAlongSession[]>;
}
