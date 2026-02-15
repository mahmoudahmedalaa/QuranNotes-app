/**
 * JuzGrid — 5×6 grid of Juz 1-30 for self-paced Khatma tracking.
 * Shows states: completed (green), in-progress (gold), not started (gray).
 *
 * Uses KhatmaReadingPosition (per-Juz) instead of ReadingPositionService (per-surah)
 * to detect "in progress" state. This avoids false positives when multiple Juz
 * share the same surah (e.g. Juz 1, 2, 3 all share Al-Baqarah).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { KhatmaReadingPosition } from '../../../infrastructure/khatma/KhatmaReadingPosition';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLUMNS = 6;
const GAP = 6;

const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62350',
    green: '#10B981',
    greenLight: '#10B98140',
    blue: '#6C8EEF',
};

interface JuzGridProps {
    completedJuz: number[];
    selectedJuz: number;
    onSelectJuz: (juz: number) => void;
    /** Increment this to force a refresh (e.g. on tab focus) */
    refreshKey?: number;
}

export const JuzGrid: React.FC<JuzGridProps> = ({
    completedJuz,
    selectedJuz,
    onSelectJuz,
    refreshKey,
}) => {
    const theme = useTheme();
    const [collapsed, setCollapsed] = useState(false);

    // Detect which Juz have a saved reading position (from KhatmaReadingPosition, NOT global)
    // This is per-Juz, so Juz 1 and Juz 2 are tracked independently even though
    // they both involve Al-Baqarah. Prevents the "3 Juz always yellow" bug.
    const [inProgressJuzSet, setInProgressJuzSet] = useState<Set<number>>(new Set());

    const checkInProgress = useCallback(async () => {
        const inProgress = new Set<number>();
        for (let j = 1; j <= 30; j++) {
            if (completedJuz.includes(j)) continue;
            const pos = await KhatmaReadingPosition.get(j);
            if (pos) inProgress.add(j);
        }
        setInProgressJuzSet(inProgress);
    }, [completedJuz]);

    useEffect(() => {
        checkInProgress();
    }, [checkInProgress, refreshKey]);

    type CellState = 'completed' | 'in-progress' | 'not-started';

    const getCellState = (juzNumber: number): CellState => {
        if (completedJuz.includes(juzNumber)) return 'completed';
        if (inProgressJuzSet.has(juzNumber)) return 'in-progress';
        return 'not-started';
    };

    const renderCell = (juzNumber: number) => {
        const state = getCellState(juzNumber);
        const isSelected = juzNumber === selectedJuz;

        let bgColor: string;
        let textColor: string;

        switch (state) {
            case 'completed':
                bgColor = ACCENT.greenLight;
                textColor = ACCENT.green;
                break;
            case 'in-progress':
                bgColor = ACCENT.goldLight;
                textColor = ACCENT.gold;
                break;
            default:
                bgColor = theme.colors.surfaceVariant;
                textColor = theme.colors.onSurfaceVariant;
        }

        return (
            <Pressable
                accessibilityLabel={`Juz ${juzNumber}, ${state}`}
                key={juzNumber}
                onPress={() => {
                    Haptics.selectionAsync();
                    onSelectJuz(juzNumber);
                }}
                style={({ pressed }) => [
                    styles.cell,
                    {
                        backgroundColor: bgColor,
                        borderColor: isSelected ? ACCENT.blue : 'transparent',
                        borderWidth: isSelected ? 2.5 : 0,
                    },
                    pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
                ]}
            >
                {state === 'completed' ? (
                    <MaterialCommunityIcons name="check" size={16} color={ACCENT.green} />
                ) : (
                    <Text style={[styles.cellText, { color: textColor }]}>
                        {juzNumber}
                    </Text>
                )}
            </Pressable>
        );
    };

    // Build rows of 6
    const rows: number[][] = [];
    for (let i = 0; i < 30; i += COLUMNS) {
        rows.push(Array.from({ length: COLUMNS }, (_, j) => i + j + 1));
    }

    return (
        <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, delay: 150 }}
        >
            <View style={[styles.container, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
                {/* Header — tappable to collapse/expand */}
                <Pressable
                    style={styles.headerRow}
                    onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setCollapsed(c => !c);
                    }}
                >
                    <Text style={[styles.headerText, { color: theme.colors.onSurface }]}>
                        Select a Juz
                    </Text>
                    <View style={styles.headerRight}>
                        <Text style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                            {completedJuz.length} of 30
                        </Text>
                        <Ionicons
                            name={collapsed ? 'chevron-down' : 'chevron-up'}
                            size={18}
                            color={theme.colors.onSurfaceVariant}
                        />
                    </View>
                </Pressable>

                {/* Grid — collapsible */}
                {!collapsed && (
                    <View style={styles.grid}>
                        {rows.map((row, rowIndex) => (
                            <View key={rowIndex} style={styles.row}>
                                {row.map(juz => renderCell(juz))}
                            </View>
                        ))}
                    </View>
                )}

                {/* Legend */}
                {!collapsed && (
                    <View style={styles.legend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: ACCENT.greenLight }]} />
                            <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                                Completed
                            </Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: ACCENT.gold }]} />
                            <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                                In Progress
                            </Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 2, borderColor: ACCENT.blue }]} />
                            <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                                Selected
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginHorizontal: Spacing.xs,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '700',
    },
    progressText: {
        fontSize: 13,
        fontWeight: '600',
    },
    grid: {
        gap: GAP,
    },
    row: {
        flexDirection: 'row',
        gap: GAP,
    },
    cell: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cellText: {
        fontSize: 14,
        fontWeight: '700',
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: Spacing.sm,
        paddingTop: Spacing.xs,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        fontSize: 11,
        fontWeight: '500',
    },
});
