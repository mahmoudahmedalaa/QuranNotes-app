import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export class NotificationService {
    // 20 curated messages: emotionally warm, concise (≤2 lines), relevant to app usage
    private static REMINDERS: { title: string; body: string }[] = [
        // === Daily gentle nudges ===
        { title: 'Time for Quran 📖', body: 'A few verses today can bring peace to your whole evening.' },
        { title: 'Your daily reflection ✨', body: 'Even one ayah read with thought is worth more than a hundred read without.' },
        { title: 'Quran time 🌙', body: 'The best conversations are the ones between you and Allah\'s words.' },
        { title: 'A moment of peace 🕊️', body: 'Step away from the noise. Your Quran is waiting.' },
        { title: 'Feed your soul 💚', body: 'Your body ate today — don\'t forget to nourish your heart too.' },
        { title: 'Just 5 minutes 🤲', body: 'That\'s all it takes to reconnect. Open where you left off.' },
        { title: 'Make time for peace ☀️', body: 'The Quran is not just read — it\'s lived. Start with today\'s verse.' },

        // === Hadith & Quran-based (concise, no verse numbers) ===
        { title: 'The Prophet ﷺ said…', body: 'The best among you is the one who learns the Quran and teaches it.' },
        { title: 'Hearts find rest 💚', body: 'Indeed, in the remembrance of Allah do hearts find rest.' },
        { title: 'An intercessor for you', body: 'The Quran will come as an intercessor for its reciters on the Day of Resurrection.' },
        { title: 'Made easy for you', body: 'Allah made the Quran easy for remembrance — will you remember?' },
        { title: 'Light upon light 🌟', body: 'Allah guides to His light whom He wills.' },

        // === Emotional reconnection ===
        { title: 'We missed you 💛', body: 'Your Quran journey is still here, right where you left it.' },
        { title: 'It\'s been a while 🌿', body: 'No guilt, just grace. Open to any page — Allah is always ready.' },
        { title: 'Come back gently 🤲', body: 'The door is always open. Even one verse today makes a difference.' },
        { title: 'Start fresh today 🌅', body: 'Every day is a new chance to connect with the Quran.' },

        // === Reflective / deeper ===
        { title: 'Pause and breathe 🌬️', body: 'Before the world gets loud, let the Quran speak to you first.' },
        { title: 'A conversation with Allah', body: 'When you read the Quran, Allah is speaking to you.' },
        { title: 'Find your gratitude 🙏', body: 'If you are grateful, I will surely increase you in favor.' },
        { title: 'You\'re never alone', body: 'Allah is closer to you than your jugular vein.' },
    ];

    static async scheduleDailyReminder(hour: number, minute: number): Promise<void> {
        // Cancel any existing daily reminder first
        await this.cancelDailyReminder();

        const reminder = this.REMINDERS[Math.floor(Math.random() * this.REMINDERS.length)];

        await Notifications.scheduleNotificationAsync({
            content: {
                title: reminder.title,
                body: reminder.body,
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

    /**
     * Send a test notification in 3 seconds so the user can preview the look & feel.
     */
    static async sendTestNotification(): Promise<void> {
        const reminder = this.REMINDERS[Math.floor(Math.random() * this.REMINDERS.length)];
        await Notifications.scheduleNotificationAsync({
            content: {
                title: reminder.title,
                body: reminder.body,
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 3,
            },
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
