import { NotificationService } from '../NotificationService';
import * as Notifications from 'expo-notifications';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
    scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    setNotificationHandler: jest.fn(),
    SchedulableTriggerInputTypes: {
        DAILY: 'daily',
        TIME_INTERVAL: 'timeInterval',
    },
}));

jest.mock('expo-device', () => ({
    isDevice: true,
}));

describe('NotificationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('scheduleDailyReminder', () => {
        it('should cancel existing reminders before scheduling new one', async () => {
            await NotificationService.scheduleDailyReminder(8, 30);

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
                'daily-quran-reminder'
            );
        });

        it('should schedule a daily notification with correct trigger', async () => {
            await NotificationService.scheduleDailyReminder(8, 30);

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        title: expect.any(String),
                        body: expect.any(String),
                        sound: true,
                    }),
                    trigger: expect.objectContaining({
                        type: 'daily',
                        hour: 8,
                        minute: 30,
                    }),
                    identifier: 'daily-quran-reminder',
                })
            );
        });

        it('should schedule at boundary hours (midnight)', async () => {
            await NotificationService.scheduleDailyReminder(0, 0);

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    trigger: expect.objectContaining({
                        hour: 0,
                        minute: 0,
                    }),
                })
            );
        });

        it('should schedule at boundary hours (23:59)', async () => {
            await NotificationService.scheduleDailyReminder(23, 59);

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    trigger: expect.objectContaining({
                        hour: 23,
                        minute: 59,
                    }),
                })
            );
        });

        it('should select a random message from the pool of 30', async () => {
            // Call multiple times and collect titles
            const titles = new Set<string>();
            for (let i = 0; i < 20; i++) {
                jest.clearAllMocks();
                await NotificationService.scheduleDailyReminder(8, 0);
                const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
                titles.add(call.content.title);
            }
            // With 30 messages and 20 calls, we should get at least 2 different titles
            expect(titles.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe('cancelDailyReminder', () => {
        it('should cancel the daily-quran-reminder notification', async () => {
            await NotificationService.cancelDailyReminder();

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
                'daily-quran-reminder'
            );
        });

        it('should not throw if no notification was scheduled', async () => {
            (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockRejectedValueOnce(
                new Error('No notification found')
            );

            await expect(NotificationService.cancelDailyReminder()).resolves.not.toThrow();
        });
    });

    describe('sendTestNotification', () => {
        it('should schedule an immediate test notification (3 seconds)', async () => {
            await NotificationService.sendTestNotification();

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        title: expect.any(String),
                        body: expect.any(String),
                        sound: true,
                    }),
                    trigger: expect.objectContaining({
                        type: 'timeInterval',
                        seconds: 3,
                    }),
                })
            );
        });
    });

    describe('requestPermissions', () => {
        it('should return true when permissions are already granted', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
                status: 'granted',
            });

            const result = await NotificationService.requestPermissions();
            expect(result).toBe(true);
            expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
        });

        it('should request permissions when not already granted', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
                status: 'undetermined',
            });
            (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
                status: 'granted',
            });

            const result = await NotificationService.requestPermissions();
            expect(result).toBe(true);
            expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
        });

        it('should return false when user denies permissions', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
                status: 'undetermined',
            });
            (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
                status: 'denied',
            });

            const result = await NotificationService.requestPermissions();
            expect(result).toBe(false);
        });
    });
});
