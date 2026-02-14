import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, IconButton, ProgressBar, Menu, Divider, useTheme } from 'react-native-paper';
import { Colors, Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';
import { useSettings } from '../../../infrastructure/settings/SettingsContext';
import { RECITERS } from '../../../domain/entities/Reciter';
import { MotiView } from 'moti';

interface Props {
    isPlaying: boolean;
    currentVerse: { surah: number; verse: number } | null;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    verseText?: string;
}

export const StickyAudioPlayer = ({
    isPlaying,
    currentVerse,
    onPause,
    onResume,
    onStop,
    verseText,
}: Props) => {
    const { settings, updateSettings } = useSettings();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);

    const openMenu = () => setVisible(true);
    const closeMenu = () => setVisible(false);

    const currentReciter = RECITERS.find(r => r.id === settings.reciterId);

    if (!currentVerse) return null;

    return (
        <MotiView
            from={{ translateY: 100, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.elevation.level5,
                    borderBottomColor: theme.colors.outlineVariant,
                },
            ]}>
            <View style={[styles.content, { paddingBottom: Math.max(Spacing.md, insets.bottom) }]}>
                <View style={styles.info}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text
                            variant="labelMedium"
                            style={[styles.playingLabel, { color: theme.colors.primary }]}>
                            Now Reciting
                        </Text>
                        <Menu
                            visible={visible}
                            onDismiss={closeMenu}
                            anchor={
                                <TouchableOpacity onPress={openMenu}>
                                    <View
                                        style={[
                                            styles.reciterBadge,
                                            { backgroundColor: theme.colors.primaryContainer },
                                        ]}>
                                        <Text
                                            style={[
                                                styles.reciterText,
                                                { color: theme.colors.onPrimaryContainer },
                                            ]}>
                                            {currentReciter?.name.split(' ')[0]}
                                        </Text>
                                        <IconButton
                                            icon="chevron-down"
                                            size={14}
                                            iconColor={theme.colors.onPrimaryContainer}
                                            style={{ margin: 0, height: 14, width: 14 }}
                                        />
                                    </View>
                                </TouchableOpacity>
                            }>
                            <Text
                                style={{
                                    padding: 12,
                                    fontWeight: 'bold',
                                    color: theme.colors.primary,
                                }}>
                                Select Reciter
                            </Text>
                            <Divider />
                            {RECITERS.map(r => (
                                <Menu.Item
                                    key={r.id}
                                    onPress={() => {
                                        updateSettings({ reciterId: r.id });
                                        closeMenu();
                                    }}
                                    title={r.name}
                                    leadingIcon={r.id === settings.reciterId ? 'check' : undefined}
                                />
                            ))}
                        </Menu>
                    </View>

                    <Text
                        variant="titleMedium"
                        style={[styles.verseLabel, { color: theme.colors.onSurface }]}>
                        Verse {currentVerse.verse}
                    </Text>
                    {verseText && (
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.arabicPreview,
                                { color: theme.colors.onSurfaceVariant },
                            ]}>
                            {verseText}
                        </Text>
                    )}
                </View>

                <View style={styles.controls}>
                    {isPlaying ? (
                        <IconButton
                            icon="pause-circle"
                            iconColor={theme.colors.primary}
                            size={44}
                            onPress={onPause}
                        />
                    ) : (
                        <IconButton
                            icon="play-circle"
                            iconColor={theme.colors.primary}
                            size={44}
                            onPress={onResume}
                        />
                    )}
                    <IconButton
                        icon="close"
                        iconColor={theme.colors.onSurfaceVariant}
                        size={24}
                        onPress={onStop}
                    />
                </View>
            </View>
            <ProgressBar indeterminate color={theme.colors.primary} style={{ height: 3 }} />
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        overflow: 'hidden',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        justifyContent: 'space-between',
    },
    info: {
        flex: 1,
        marginRight: Spacing.md,
    },
    playingLabel: {
        fontWeight: 'bold',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginRight: 8,
    },
    reciterBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: BorderRadius.sm,
    },
    reciterText: {
        fontSize: 13,
        fontWeight: '700',
    },
    verseLabel: {
        fontWeight: '800',
    },
    arabicPreview: {
        fontSize: 13,
        marginTop: 2,
        fontStyle: 'italic',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
