/**
 * SurahList - Animated Surah list with staggered entrance
 *
 * Premium features:
 * - Staggered fade + slide entrance for each card
 * - Spring press animation with haptics
 * - Smooth scale on press
 */

import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Surah } from '../../../domain/entities/Quran';
import { Spacing, BorderRadius } from '../../theme/DesignSystem';
import { AnimatedCard } from '../../components/animated/AnimatedCard';

interface Props {
    surahs: Surah[];
    onSelect: (surahNumber: number) => void;
}

export const SurahList = ({ surahs, onSelect }: Props) => {
    const theme = useTheme();

    const renderItem = useCallback(
        ({ item, index }: { item: Surah; index: number }) => (
            <AnimatedCard index={index} onPress={() => onSelect(item.number)} elevation="sm">
                {/* Number Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                        style={[
                            styles.numberBadge,
                            { backgroundColor: theme.colors.primaryContainer },
                        ]}>
                        <Text style={[styles.numberText, { color: theme.colors.primary }]}>
                            {item.number}
                        </Text>
                    </View>

                    {/* Info Section */}
                    <View style={styles.info}>
                        <Text style={[styles.englishName, { color: theme.colors.onSurface }]}>
                            {item.englishName}
                        </Text>
                        <Text
                            style={[styles.translation, { color: theme.colors.onSurfaceVariant }]}>
                            {item.englishNameTranslation}
                        </Text>
                    </View>

                    {/* Arabic Section */}
                    <View style={styles.arabicSection}>
                        <Text style={[styles.arabicName, { color: theme.colors.primary }]}>
                            {item.name}
                        </Text>
                        <View
                            style={[
                                styles.ayahBadge,
                                { backgroundColor: theme.colors.surfaceVariant },
                            ]}>
                            <Text
                                style={[styles.ayahText, { color: theme.colors.onSurfaceVariant }]}>
                                {item.numberOfAyahs} Ayahs
                            </Text>
                        </View>
                    </View>
                </View>
            </AnimatedCard>
        ),
        [onSelect, theme],
    );

    return (
        <FlatList
            style={{ flex: 1 }}
            data={surahs}
            keyExtractor={item => item.number.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
        />
    );
};

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 100,
        paddingTop: Spacing.xs,
    },
    numberBadge: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    numberText: {
        fontSize: 15,
        fontWeight: '700',
    },
    info: {
        flex: 1,
    },
    englishName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    translation: {
        fontSize: 12,
    },
    arabicSection: {
        alignItems: 'flex-end',
    },
    arabicName: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 4,
    },
    ayahBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BorderRadius.sm,
    },
    ayahText: {
        fontSize: 10,
        fontWeight: '500',
    },
});
