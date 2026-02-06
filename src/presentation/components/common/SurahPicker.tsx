import { useState } from 'react';
import { View, Modal, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text, Searchbar, useTheme, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, BorderRadius, Shadows, Colors } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';

interface SurahPickerProps {
    visible: boolean;
    onDismiss: () => void;
    onSelect: (surahNumber: number) => void;
    surahs: Array<{ number: number; name: string; englishName: string }>;
}

export function SurahPicker({ visible, onDismiss, onSelect, surahs }: SurahPickerProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSurahs = surahs.filter(
        s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.number.toString().includes(searchQuery),
    );

    const handleSelect = (surahNumber: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(surahNumber);
        onDismiss();
        setSearchQuery('');
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
            <Pressable style={styles.modalOverlay} onPress={onDismiss}>
                <Pressable
                    style={[
                        styles.modalContent,
                        {
                            backgroundColor: theme.colors.surface,
                            paddingBottom: Math.max(insets.bottom, 20) + 20, // Safe area + padding
                        },
                    ]}
                    onPress={e => e.stopPropagation()}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <Text
                            variant="titleLarge"
                            style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                            Select Surah
                        </Text>
                        <Pressable onPress={onDismiss}>
                            <Text
                                variant="titleMedium"
                                style={{ color: theme.colors.primary, fontWeight: '600' }}>
                                Done
                            </Text>
                        </Pressable>
                    </View>

                    <Searchbar
                        placeholder="Search Surah..."
                        onChangeText={setSearchQuery}
                        value={searchQuery}
                        style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
                        iconColor={theme.colors.onSurfaceVariant}
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                    />

                    <FlatList
                        data={filteredSurahs}
                        keyExtractor={item => item.number.toString()}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <>
                                <Pressable
                                    style={[styles.item, { backgroundColor: theme.colors.surface }]}
                                    onPress={() => handleSelect(item.number)}>
                                    <View
                                        style={[
                                            styles.numberBadge,
                                            { backgroundColor: theme.colors.primaryContainer },
                                        ]}>
                                        <Text
                                            style={[
                                                styles.numberText,
                                                { color: theme.colors.primary },
                                            ]}>
                                            {item.number}
                                        </Text>
                                    </View>
                                    <View style={styles.textContainer}>
                                        <Text
                                            variant="titleMedium"
                                            style={{
                                                color: theme.colors.onSurface,
                                                fontWeight: '600',
                                            }}>
                                            {item.englishName}
                                        </Text>
                                        <Text
                                            variant="bodySmall"
                                            style={{ color: theme.colors.onSurfaceVariant }}>
                                            {item.name}
                                        </Text>
                                    </View>
                                </Pressable>
                                <Divider
                                    style={{ backgroundColor: theme.colors.outline, opacity: 0.2 }}
                                />
                            </>
                        )}
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        maxHeight: '80%',
        ...Shadows.lg,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.outline,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.outline,
    },
    searchbar: {
        margin: Spacing.md,
        elevation: 0,
        borderRadius: BorderRadius.lg,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
    },
    numberBadge: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    numberText: {
        fontWeight: '700',
        fontSize: 14,
    },
    textContainer: {
        flex: 1,
    },
});
