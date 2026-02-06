import { View, Modal, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme, Divider, RadioButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RECITERS } from '../../../domain/entities/Reciter';
import { Spacing, BorderRadius, Shadows, Colors } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';

interface ReciterPickerProps {
    visible: boolean;
    onDismiss: () => void;
    onSelect: (reciterId: string) => void;
    selectedReciter: string;
}

export function ReciterPicker({
    visible,
    onDismiss,
    onSelect,
    selectedReciter,
}: ReciterPickerProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const handleSelect = (reciterId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(reciterId);
        onDismiss();
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
                            Select Reciter
                        </Text>
                        <Pressable onPress={onDismiss}>
                            <Text
                                variant="titleMedium"
                                style={{ color: theme.colors.primary, fontWeight: '600' }}>
                                Done
                            </Text>
                        </Pressable>
                    </View>

                    <FlatList
                        data={RECITERS}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            const isSelected = selectedReciter === item.id;
                            return (
                                <>
                                    <Pressable
                                        style={[
                                            styles.item,
                                            isSelected && {
                                                backgroundColor: theme.colors.primaryContainer,
                                            },
                                        ]}
                                        onPress={() => handleSelect(item.id)}>
                                        <View style={styles.itemContent}>
                                            <Text
                                                variant="titleMedium"
                                                style={[
                                                    styles.reciterName,
                                                    {
                                                        color: isSelected
                                                            ? theme.colors.primary
                                                            : theme.colors.onSurface,
                                                    },
                                                ]}>
                                                {item.name}
                                            </Text>
                                        </View>
                                        <RadioButton
                                            value={item.id}
                                            status={isSelected ? 'checked' : 'unchecked'}
                                            onPress={() => handleSelect(item.id)}
                                            color={theme.colors.primary}
                                        />
                                    </Pressable>
                                    <Divider
                                        style={{
                                            backgroundColor: theme.colors.outline,
                                            opacity: 0.2,
                                        }}
                                    />
                                </>
                            );
                        }}
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
        maxHeight: '60%',
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
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.outline,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
    },
    itemContent: {
        flex: 1,
    },
    reciterName: {
        fontWeight: '500',
    },
});
