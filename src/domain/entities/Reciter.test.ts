import { RECITERS, getReciterById, DEFAULT_RECITER } from './Reciter';

describe('Reciter Entity & Constants', () => {
    describe('RECITERS Data Integrity', () => {
        it('should have unique IDs', () => {
            const ids = RECITERS.map(r => r.id);
            const uniqueIds = new Set(ids);
            expect(ids.length).toBe(uniqueIds.size);
        });

        it('should have valid CDN folders defined', () => {
            RECITERS.forEach(reciter => {
                expect(reciter.cdnFolder).toBeTruthy();
                expect(reciter.cdnFolder.length).toBeGreaterThan(0);
            });
        });

        it('should include the default reciter in the list', () => {
            const defaultInList = RECITERS.find(r => r.id === DEFAULT_RECITER.id);
            expect(defaultInList).toBeDefined();
        });
    });

    describe('getReciterById', () => {
        it('should return the correct reciter for a valid ID', () => {
            const result = getReciterById('sudais');
            expect(result.name).toContain('Sudais');
        });

        it('should return DEFAULT_RECITER for an unknown ID', () => {
            const result = getReciterById('unknown_reciter_id_123');
            expect(result).toEqual(DEFAULT_RECITER);
        });
    });
});
