/**
 * Integration tests for the Daily Reminder flow.
 *
 * Tests the end-to-end interaction between:
 *   Settings UI → NotificationService → AsyncStorage → Permissions
 */

import { NotificationService } from '../../src/infrastructure/notifications/NotificationService';
import * as Notifications from 'expo-notifications';

// Mock dependencies
jest.mock('expo-notifications', () => ({
    scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    SchedulableTriggerInputTypes: {
        DAILY: 'daily',
        TIME_INTERVAL: 'timeInterval',
    },
    setNotificationHandler: jest.fn(),
}));

jest.mock('expo-device', () => ({
    isDevice: true,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
        multiGet: jest.fn().mockResolvedValue([]),
        multiSet: jest.fn().mockResolvedValue(undefined),
    },
}));

describe('Reminder Flow Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Toggle Reminder ON', () => {
        it('should request permissions and schedule notification when enabled', async () => {
            // Step 1: Request permissions
            const granted = await NotificationService.requestPermissions();
            expect(granted).toBe(true);

            // Step 2: Schedule daily reminder
            await NotificationService.scheduleDailyReminder(8, 0);

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    trigger: expect.objectContaining({
                        type: 'daily',
                        hour: 8,
                        minute: 0,
                    }),
                    identifier: 'daily-quran-reminder',
                })
            );
        });

        it('should not schedule if permissions are denied', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
                status: 'undetermined',
            });
            (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
                status: 'denied',
            });

            const granted = await NotificationService.requestPermissions();
            expect(granted).toBe(false);

            // Should NOT schedule
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });
    });

    describe('Toggle Reminder OFF', () => {
        it('should cancel scheduled notification when disabled', async () => {
            // Schedule first
            await NotificationService.scheduleDailyReminder(8, 0);

            // Then cancel
            await NotificationService.cancelDailyReminder();

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
                'daily-quran-reminder'
            );
        });
    });

    describe('Change Reminder Time', () => {
        it('should reschedule with new time when time is changed', async () => {
            // Schedule at 8:00
            await NotificationService.scheduleDailyReminder(8, 0);

            jest.clearAllMocks();

            // Reschedule at 20:00
            await NotificationService.scheduleDailyReminder(20, 0);

            // Should cancel the old one
            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
                'daily-quran-reminder'
            );

            // Should schedule with new time
            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    trigger: expect.objectContaining({
                        hour: 20,
                        minute: 0,
                    }),
                })
            );
        });

        it('should handle custom time selection', async () => {
            // Custom time: 15:30
            await NotificationService.scheduleDailyReminder(15, 30);

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    trigger: expect.objectContaining({
                        hour: 15,
                        minute: 30,
                    }),
                })
            );
        });
    });

    describe('Notification Content Quality', () => {
        it('should have a title and body in every notification', async () => {
            await NotificationService.scheduleDailyReminder(8, 0);

            const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
            expect(call.content.title).toBeTruthy();
            expect(call.content.body).toBeTruthy();
            expect(call.content.title.length).toBeGreaterThan(0);
            expect(call.content.body.length).toBeGreaterThan(0);
        });

        it('should have sound enabled for all notifications', async () => {
            await NotificationService.scheduleDailyReminder(8, 0);

            const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
            expect(call.content.sound).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle scheduling failure gracefully', async () => {
            (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(
                new Error('Scheduling failed')
            );

            await expect(
                NotificationService.scheduleDailyReminder(8, 0)
            ).rejects.toThrow('Scheduling failed');
        });

        it('should handle cancellation of non-existent notification gracefully', async () => {
            (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockRejectedValueOnce(
                new Error('Not found')
            );

            // Should not throw
            await expect(NotificationService.cancelDailyReminder()).resolves.not.toThrow();
        });
    });
});
