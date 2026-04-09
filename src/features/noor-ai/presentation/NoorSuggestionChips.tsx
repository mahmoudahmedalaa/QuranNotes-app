import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '../../../core/theme/DesignSystem';

interface Props {
    questions: string[];
    onSelect: (question: string) => void;
}

const CHIP_ICONS: Array<keyof typeof MaterialCommunityIcons.glyphMap> = [
    'star-four-points-outline',
    'compass-outline',
    'lightbulb-outline',
    'book-open-page-variant-outline',
];

export default function NoorSuggestionChips({ questions, onSelect }: Props) {
    const theme = useTheme();
    const scrollViewRef = useRef<ScrollView>(null);

    if (questions.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text
                style={[
                    styles.sectionLabel,
                    { color: theme.colors.onSurfaceVariant },
                ]}
            >
                Suggestions
            </Text>
            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                decelerationRate="fast"
            >
                {questions.map((q, i) => (
                    <MotiView
                        key={q}
                        from={{ opacity: 0, translateX: 20 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        transition={{ type: 'spring', damping: 18, delay: i * 60 + 100 }}
                    >
                        <Pressable
                            onPress={() => onSelect(q)}
                            style={({ pressed }) => [
                                styles.chip,
                                {
                                    backgroundColor: theme.dark
                                        ? '#18181B'
                                        : '#FFFFFF',
                                    borderColor: theme.dark
                                        ? '#27272A'
                                        : '#E2E8F0',
                                    shadowColor: theme.dark ? '#000' : '#6246EA',
                                    shadowOpacity: theme.dark ? 0.2 : 0.05,
                                },
                                pressed && {
                                    opacity: 0.8,
                                    transform: [{ scale: 0.97 }],
                                    backgroundColor: theme.dark
                                        ? 'rgba(167, 139, 250, 0.08)'
                                        : 'rgba(98, 70, 234, 0.04)',
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={CHIP_ICONS[i % CHIP_ICONS.length]}
                                size={14}
                                color={theme.colors.primary}
                                style={styles.chipIcon}
                            />
                            <Text
                                style={[
                                    styles.chipText,
                                    { color: theme.colors.onSurface },
                                ]}
                                numberOfLines={2}
                            >
                                {q}
                            </Text>
                        </Pressable>
                    </MotiView>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 8,
        paddingHorizontal: Spacing.md,
    },
    scrollContent: {
        paddingHorizontal: Spacing.md,
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: BorderRadius.full,
        borderWidth: StyleSheet.hairlineWidth,
        height: 40,
        // Shadow
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 1,
    },
    chipIcon: {
        marginRight: 6,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '500',
    },
});
