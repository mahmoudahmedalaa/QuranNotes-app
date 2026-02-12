/**
 * EidCelebrationOverlay — One-time greeting shown after Ramadan ends
 * Shows "Eid Mubarak" with Ramadan achievement summary.
 * Only shown once per year (tracked in AsyncStorage).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62320',
    green: '#10B981',
    greenLight: '#10B98120',
};

const EID_KEY = (year: number) => `eid_greeting_shown_${year}`;

interface EidCelebrationOverlayProps {
    isComplete: boolean;
    completedJuzCount: number;
    year?: number;
}

export const EidCelebrationOverlay: React.FC<EidCelebrationOverlayProps> = ({
    isComplete,
    completedJuzCount,
    year = new Date().getFullYear(),
}) => {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        checkAndShow();
    }, []);

    const checkAndShow = async () => {
        try {
            const shown = await AsyncStorage.getItem(EID_KEY(year));
            if (!shown) {
                setVisible(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch { }
    };

    const dismiss = async () => {
        setVisible(false);
        try {
            await AsyncStorage.setItem(EID_KEY(year), 'true');
        } catch { }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={dismiss}
        >
            <View style={styles.backdrop}>
                <MotiView
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 14 }}
                    style={[styles.card, { backgroundColor: theme.colors.surface }]}
                >
                    {/* Crescent + Star */}
                    <MotiView
                        from={{ rotate: '-20deg', scale: 0 }}
                        animate={{ rotate: '0deg', scale: 1 }}
                        transition={{ type: 'spring', damping: 12, delay: 200 }}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: ACCENT.goldLight }]}>
                            <MaterialCommunityIcons
                                name="star-crescent"
                                size={44}
                                color={ACCENT.gold}
                            />
                        </View>
                    </MotiView>

                    {/* Arabic Greeting */}
                    <MotiView
                        from={{ opacity: 0, translateY: 10 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 500, delay: 300 }}
                    >
                        <Text style={[styles.arabicTitle, { color: theme.colors.onBackground }]}>
                            عيد مبارك
                        </Text>
                    </MotiView>

                    {/* English */}
                    <MotiView
                        from={{ opacity: 0, translateY: 10 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 500, delay: 400 }}
                    >
                        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
                            Eid Mubarak! 🌙✨
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            {isComplete
                                ? `Alhamdulillah! You completed the entire Quran this Ramadan.`
                                : `You read ${completedJuzCount} of 30 Juz this Ramadan. Every verse is a blessing.`}
                        </Text>
                    </MotiView>

                    {/* Achievement badge (if complete) */}
                    {isComplete && (
                        <MotiView
                            from={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', damping: 14, delay: 500 }}
                        >
                            <View style={[styles.achievementBadge, { backgroundColor: ACCENT.greenLight }]}>
                                <MaterialCommunityIcons name="trophy" size={18} color={ACCENT.green} />
                                <Text style={[styles.achievementText, { color: ACCENT.green }]}>
                                    Khatma Achieved ✔
                                </Text>
                            </View>
                        </MotiView>
                    )}

                    {/* Dismiss */}
                    <Pressable
                        onPress={dismiss}
                        style={({ pressed }) => [
                            styles.dismissButton,
                            { backgroundColor: theme.colors.primary },
                            Shadows.primary,
                            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                        ]}
                    >
                        <Text style={styles.dismissText}>JazakAllahu Khairan 🤲</Text>
                    </Pressable>
                </MotiView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    card: {
        width: SCREEN_WIDTH - Spacing.lg * 2,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
        gap: Spacing.md,
    },
    iconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arabicTitle: {
        fontSize: 40,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 56,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 22,
    },
    achievementBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: BorderRadius.full,
    },
    achievementText: {
        fontSize: 14,
        fontWeight: '700',
    },
    dismissButton: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: BorderRadius.full,
        marginTop: Spacing.sm,
    },
    dismissText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
    },
});
