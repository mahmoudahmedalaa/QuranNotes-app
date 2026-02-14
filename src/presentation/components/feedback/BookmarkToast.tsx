/**
 * BookmarkToast
 * Headspace-inspired toast notification that slides down from the top
 * when the user saves their reading position.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '../../theme/DesignSystem';

const ACCENT_GOLD = '#D4A853';

interface BookmarkToastProps {
    visible: boolean;
    verseNumber: number;
    onDismiss: () => void;
    /** Auto-dismiss delay in ms (default 2500) */
    duration?: number;
}

export const BookmarkToast: React.FC<BookmarkToastProps> = ({
    visible,
    verseNumber,
    onDismiss,
    duration = 2500,
}) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible) {
            const timer = setTimeout(onDismiss, duration);
            return () => clearTimeout(timer);
        }
    }, [visible, duration, onDismiss]);

    if (!visible) return null;

    return (
        <MotiView
            from={{ translateY: -80, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            style={[
                styles.container,
                {
                    top: insets.top + 8,
                    backgroundColor: theme.colors.elevation.level3,
                    shadowColor: theme.dark ? '#000' : '#5B7FFF',
                },
            ]}
        >
            {/* Bookmark icon with gold accent */}
            <View style={[styles.iconCircle, { backgroundColor: `${ACCENT_GOLD}20` }]}>
                <MaterialCommunityIcons name="bookmark-check" size={22} color={ACCENT_GOLD} />
            </View>

            {/* Text content */}
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                    Progress saved
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Bookmarked at Ayah {verseNumber}
                </Text>
            </View>

            {/* Checkmark */}
            <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={ACCENT_GOLD}
                style={styles.checkIcon}
            />
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: Spacing.md,
        right: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        elevation: 8,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        zIndex: 999,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.sm,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    checkIcon: {
        marginLeft: Spacing.sm,
    },
});
