import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export class NotificationService {
    private static REMINDER_TEXTS = [
        'The best among you is the one who learns the Quran and teaches it. — Sahih al-Bukhari',
        'Read the Quran, for it will come as an intercessor for its reciters on the Day of Resurrection. — Sahih Muslim',
        'The one who is proficient in the recitation of the Quran will be with the honourable and obedient scribes (angels). — Sahih al-Bukhari',
        'Whoever reads a letter from the Book of Allah will earn a reward, and each reward is multiplied by ten. — Jami at-Tirmidhi',
        'The Quran is a proof for you or against you. — Sahih Muslim',
        'Verily, this Quran guides to that which is most suitable. — Quran 17:9',
        'Do they not then reflect on the Quran? Or are there locks upon their hearts? — Quran 47:24',
        'And We have certainly made the Quran easy for remembrance, so is there any who will remember? — Quran 54:17',
        'This is a blessed Book which We have revealed to you, that they might reflect upon its verses. — Quran 38:29',
        'Indeed, in the remembrance of Allah do hearts find rest. — Quran 13:28',
    ];

    static async scheduleDailyReminder(hour: number, minute: number): Promise<void> {
        // Cancel any existing daily reminder first
        await this.cancelDailyReminder();

        const randomText = this.REMINDER_TEXTS[Math.floor(Math.random() * this.REMINDER_TEXTS.length)];

        await Notifications.scheduleNotificationAsync({
            content: {
                title: 'Time for Quran 📖',
                body: randomText,
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            },
            identifier: 'daily-quran-reminder',
        });
    }

    static async cancelDailyReminder(): Promise<void> {
        await Notifications.cancelScheduledNotificationAsync('daily-quran-reminder').catch(() => {
            // Ignore error if no notification was scheduled
        });
    }

    static async requestPermissions(): Promise<boolean> {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus === 'granted') return true;

        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    }

    static async registerForPushNotificationsAsync(): Promise<string | undefined> {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }

            token = (await Notifications.getExpoPushTokenAsync({
                projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID // Using projectId as fallback if specific ID not set
            })).data;

            console.log(token);
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    }

    static addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
        return Notifications.addNotificationReceivedListener(callback);
    }

    static addNotificationResponseReceivedListener(callback: (response: Notifications.NotificationResponse) => void) {
        return Notifications.addNotificationResponseReceivedListener(callback);
    }
}

// Default handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});
