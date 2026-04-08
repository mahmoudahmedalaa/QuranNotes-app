/**
 * NoorSuggestionChips — Horizontal scrollable chips for suggested questions.
 *
 * Displayed as the empty-state prompt and after Noor's responses to
 * encourage follow-up conversation.
 */

import React from 'react';
import { ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { Spacing, BorderRadius } from '../../../core/theme/DesignSystem';

interface Props {
    questions: string[];
    onSelect: (question: string) => void;
}

export default function NoorSuggestionChips({ questions, onSelect }: Props) {
    const theme = useTheme();

    if (questions.length === 0) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {questions.map((q, i) => (
                <MotiView
                    key={q}
                    from={{ opacity: 0, translateX: 12 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'spring', damping: 18, delay: i * 80 }}
                >
                    <Pressable
                        onPress={() => onSelect(q)}
                        style={({ pressed }) => [
                            styles.chip,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(167, 139, 250, 0.12)'
                                    : 'rgba(98, 70, 234, 0.08)',
                                borderColor: theme.dark
                                    ? 'rgba(167, 139, 250, 0.2)'
                                    : 'rgba(98, 70, 234, 0.15)',
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <Text
                            style={[styles.chipText, { color: theme.colors.primary }]}
                            numberOfLines={2}
                        >
                            {q}
                        </Text>
                    </Pressable>
                </MotiView>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: Spacing.sm,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        maxWidth: 220,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
    },
});
