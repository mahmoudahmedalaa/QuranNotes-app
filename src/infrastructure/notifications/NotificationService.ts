import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export class NotificationService {
    // 30+ varied messages organized by category for emotional connection
    private static REMINDERS: { title: string; body: string }[] = [
        // === Daily gentle nudges ===
        { title: 'Time for Quran 📖', body: 'A few verses today can bring peace to your whole evening.' },
        { title: 'Your daily reflection ✨', body: 'Even one ayah read with thought is worth more than a hundred read without.' },
        { title: 'Quran time 🌙', body: 'The best conversations are the ones between you and Allah\'s words.' },
        { title: 'A moment of peace 🕊️', body: 'Step away from the noise. Your Quran is waiting.' },
        { title: 'Feed your soul 💚', body: 'Your body ate today — don\'t forget to nourish your heart too.' },
        { title: 'Just 5 minutes 🤲', body: 'That\'s all it takes to reconnect. Open where you left off.' },
        { title: 'Your Quran awaits 📖', body: 'Whoever reads a letter from the Book of Allah earns a reward multiplied by ten. — Tirmidhi' },
        { title: 'Make time for peace ☀️', body: 'The Quran is not just read — it\'s lived. Start with today\'s verse.' },

        // === Hadith & Quran-based ===
        { title: 'The Prophet ﷺ said…', body: 'The best among you is the one who learns the Quran and teaches it. — Sahih al-Bukhari' },
        { title: 'A promise from Allah', body: 'Verily, this Quran guides to that which is most suitable. — Quran 17:9' },
        { title: 'Hearts find rest 💚', body: 'Indeed, in the remembrance of Allah do hearts find rest. — Quran 13:28' },
        { title: 'An intercessor for you', body: 'Read the Quran, for it will come as an intercessor for its reciters on the Day of Resurrection. — Muslim' },
        { title: 'Made easy for you', body: 'And We have certainly made the Quran easy for remembrance, so is there any who will remember? — Quran 54:17' },
        { title: 'A blessed Book', body: 'This is a blessed Book which We have revealed to you, that they might reflect upon its verses. — Quran 38:29' },
        { title: 'Reflect deeply 🤔', body: 'Do they not then reflect on the Quran? Or are there locks upon their hearts? — Quran 47:24' },
        { title: 'Light upon light 🌟', body: 'Allah guides to His light whom He wills. — Quran 24:35' },

        // === Emotional reconnection (for users who haven't opened in a while) ===
        { title: 'We missed you 💛', body: 'Your Quran journey is still here, right where you left it.' },
        { title: 'It\'s been a while 🌿', body: 'No guilt, just grace. Open to any page — Allah is always ready.' },
        { title: 'Come back gently 🤲', body: 'The door is always open. Even one verse today makes a difference.' },
        { title: 'Start fresh today 🌅', body: 'Every day is a new chance to connect with the Quran.' },
        { title: 'You\'re still on track ✅', body: 'Progress isn\'t perfection. One ayah today keeps your heart close.' },

        // === Reflective / deeper ===
        { title: 'Pause and breathe 🌬️', body: 'Before the world gets loud, let the Quran speak to you first.' },
        { title: 'A conversation with Allah', body: 'When you read the Quran, Allah is speaking to you. When you make dua, you are speaking to Him.' },
        { title: 'Healing words 🩹', body: 'The Quran is a healing for what is in the hearts. — Quran 10:57' },
        { title: 'Find your gratitude 🙏', body: 'If you are grateful, I will surely increase you. — Quran 14:7' },
        { title: 'Patience and prayer', body: 'Seek help through patience and prayer. Indeed, Allah is with the patient. — Quran 2:153' },
        { title: 'Trust the plan 🌟', body: 'Perhaps you hate a thing and it is good for you. — Quran 2:216' },
        { title: 'You\'re never alone', body: 'And We are closer to him than his jugular vein. — Quran 50:16' },
        { title: 'Strength from within 💪', body: 'Allah does not burden a soul beyond that it can bear. — Quran 2:286' },
        { title: 'The Quran is proof', body: 'The Quran is a proof for you or against you. Which will it be today? — Sahih Muslim' },
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
