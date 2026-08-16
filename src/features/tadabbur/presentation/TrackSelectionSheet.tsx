/**
 * IntentSelectionSheet — Full-screen modal for choosing a Tadabbur intent.
 *
 * Replaces the old TrackSelectionSheet with an AI-driven intent selection flow:
 *  - Shows default spiritual intents (gratitude, patience, fear, hope, etc.)
 *  - For Pro users: shows AI-suggested intents based on time-of-day & history
 *  - Subtle brand-compliant glassmorphism and animations
 *  - Starts an AI-driven session on selection
 */
import React, { useCallback } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    ScrollView,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTadabbur } from '../infrastructure/TadabburContext';
import { usePro } from '../../auth/infrastructure/ProContext';
import { useRouter } from 'expo-router';
import type { ReflectionIntent, IntentCategory } from '../domain/entities/Reflection';

interface IntentSelectionSheetProps {
    visible: boolean;
    onDismiss: () => void;
}

/** Map intent categories to icons */
const CATEGORY_ICONS: Record<IntentCategory, string> = {
    gratitude: 'hand-heart',
    patience: 'weather-sunset',
    hope: 'white-balance-sunny',
    fear: 'shield-outline',
    repentance: 'water-outline',
    guidance: 'compass-outline',
    comfort: 'heart-outline',
    knowledge: 'book-open-page-variant-outline',
    trust: 'handshake-outline',
    remembrance: 'moon-waning-crescent',
    loneliness: 'account-heart-outline',
    general: 'star-four-points-outline',
    custom: 'pencil-outline',
};

/** Map intent categories to soft gradient colors */
const CATEGORY_COLORS: Record<IntentCategory, string> = {
    gratitude: '#C4B5FD',
    patience: '#93C5FD',
    hope: '#FCD34D',
    fear: '#A78BFA',
    repentance: '#6EE7B7',
    guidance: '#F9A8D4',
    comfort: '#FCA5A5',
    knowledge: '#67E8F9',
    trust: '#FDE68A',
    remembrance: '#A5B4FC',
    loneliness: '#818CF8',
    general: '#D8B4FE',
    custom: '#CBD5E1',
};

export const IntentSelectionSheet: React.FC<IntentSelectionSheetProps> = ({
    visible,
    onDismiss,
}) => {
    const theme = useTheme();
    const router = useRouter();
    const { isPro } = usePro();
    const {
        availableIntents,
        aiSuggestedIntents,
        startIntentSession,
        canStartSession,
        isLoadingVerses,
    } = useTadabbur();

    const handleSelectIntent = useCallback(
        async (intent: ReflectionIntent) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            if (!canStartSession) {
                onDismiss();
                setTimeout(() => router.push('/paywall'), 350);
                return;
            }

            onDismiss();
            // Navigate immediately, the session screen will show loading
            setTimeout(() => router.push('/tadabbur-session' as any), 250);
            // Fire AI session start (async — loading UI handled by session screen)
            startIntentSession(intent);
        },
        [canStartSession, startIntentSession, onDismiss, router],
    );

    const bgColor = theme.dark ? '#141218' : '#FFFFFF';
    const hasSuggestions = isPro && aiSuggestedIntents.length > 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onDismiss} />

                <MotiView
                    from={{ translateY: 400 }}
                    animate={{ translateY: 0 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 220 }}
                    style={[styles.sheet, { backgroundColor: bgColor }]}
                >
                    {/* Handle */}
                    <View style={styles.handleWrapper}>
                        <View
                            style={[
                                styles.handle,
                                { backgroundColor: theme.dark ? '#3F3F46' : '#D4D4D8' },
                            ]}
                        />
                    </View>

                    {/* Title */}
                    <Text
                        style={[
                            styles.sheetTitle,
                            { color: theme.dark ? '#FAFAFA' : '#1C1033' },
                        ]}
                    >
                        What&apos;s on your heart?
                    </Text>

                    <Text
                        style={[
                            styles.sheetSub,
                            { color: theme.dark ? '#A1A1AA' : '#64748B' },
                        ]}
                    >
                        Choose an intention and discover the perfect verses for you
                    </Text>

                    <Text
                        style={{
                            fontSize: 11,
                            color: theme.dark ? '#71717A' : '#94A3B8',
                            textAlign: 'center',
                            marginTop: 4,
                            marginBottom: 2,
                            fontStyle: 'italic',
                        }}
                    >
                        ✦ Verses thoughtfully curated to match your heart
                    </Text>

                    <ScrollView
                        style={styles.intentList}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* AI-suggested intents (Pro only) */}
                        {hasSuggestions && (
                            <>
                                <View style={styles.sectionHeader}>
                                    <MaterialCommunityIcons
                                        name="auto-fix"
                                        size={14}
                                        color={theme.dark ? '#A78BFA' : '#7C3AED'}
                                    />
                                    <Text
                                        style={[
                                            styles.sectionLabel,
                                            { color: theme.dark ? '#A78BFA' : '#7C3AED' },
                                        ]}
                                    >
                                        Curated for You
                                    </Text>
                                </View>

                                {aiSuggestedIntents.map((intent, idx) => (
                                    <IntentCard
                                        key={`suggested_${idx}`}
                                        intent={intent}
                                        index={idx}
                                        isSuggested
                                        onSelect={handleSelectIntent}
                                    />
                                ))}

                                <View style={styles.sectionHeader}>
                                    <Text
                                        style={[
                                            styles.sectionLabel,
                                            { color: theme.dark ? '#71717A' : '#94A3B8' },
                                        ]}
                                    >
                                        All Intentions
                                    </Text>
                                </View>
                            </>
                        )}

                        {/* Default intents */}
                        {availableIntents.map((intent, idx) => (
                            <IntentCard
                                key={intent.id || `default_${idx}`}
                                intent={intent}
                                index={idx}
                                isSuggested={false}
                                onSelect={handleSelectIntent}
                            />
                        ))}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </MotiView>
            </View>
        </Modal>
    );
};

// ─── Intent Card ────────────────────────────────────────────────────────────

interface IntentCardProps {
    intent: ReflectionIntent;
    index: number;
    isSuggested: boolean;
    onSelect: (intent: ReflectionIntent) => void;
}

const IntentCard: React.FC<IntentCardProps> = ({ intent, index, isSuggested, onSelect }) => {
    const theme = useTheme();
    const color = CATEGORY_COLORS[intent.category] || CATEGORY_COLORS.general;
    const icon = CATEGORY_ICONS[intent.category] || CATEGORY_ICONS.general;

    return (
        <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: index * 60 }}
        >
            <Pressable
                onPress={() => onSelect(intent)}
                style={({ pressed }) => [
                    styles.intentCard,
                    {
                        backgroundColor: theme.dark
                            ? `${color}08`
                            : `${color}0A`,
                        borderColor: theme.dark
                            ? `${color}20`
                            : `${color}18`,
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                    isSuggested && {
                        borderColor: theme.dark
                            ? `${color}35`
                            : `${color}30`,
                    },
                ]}
            >
                {/* Icon */}
                <View
                    style={[
                        styles.intentIcon,
                        { backgroundColor: `${color}18` },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={icon as any}
                        size={22}
                        color={color}
                    />
                </View>

                {/* Info */}
                <View style={styles.intentInfo}>
                    <View style={styles.intentNameRow}>
                        <Text
                            style={[
                                styles.intentLabel,
                                { color: theme.dark ? '#FAFAFA' : '#1C1033' },
                            ]}
                            numberOfLines={2}
                        >
                            {intent.label}
                        </Text>
                        {isSuggested && (
                            <Text style={{ fontSize: 12, color, opacity: 0.7, marginLeft: 4 }}>✦</Text>
                        )}
                    </View>
                    {intent.description ? (
                        <Text
                            style={[
                                styles.intentDesc,
                                { color: theme.dark ? '#A1A1AA' : '#64748B' },
                            ]}
                            numberOfLines={2}
                        >
                            {intent.description}
                        </Text>
                    ) : null}
                </View>

                {/* Chevron */}
                <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color={theme.dark ? '#52525B' : '#CBD5E1'}
                />
            </Pressable>
        </MotiView>
    );
};

// ─── Legacy export alias ────────────────────────────────────────────────────

/** @deprecated Use IntentSelectionSheet instead */
export const TrackSelectionSheet = IntentSelectionSheet;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    handleWrapper: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
    },
    sheetTitle: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        paddingHorizontal: 24,
        marginBottom: 4,
    },
    sheetSub: {
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 24,
        marginBottom: 20,
        lineHeight: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        marginTop: 4,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    intentList: {
        paddingHorizontal: 20,
    },
    intentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 10,
    },
    intentIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    intentInfo: {
        flex: 1,
    },
    intentNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    intentLabel: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    intentDesc: {
        fontSize: 13,
        lineHeight: 17,
    },
});
