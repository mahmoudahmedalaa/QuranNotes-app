import { useState } from 'react';
import { View, StyleSheet, Modal, TextInput } from 'react-native';
import { Text, Button, Menu, Divider, useTheme, Searchbar, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ModernDropdownProps {
    label: string;
    value: string | string[];
    options: { label: string; value: string }[];
    onSelect: (value: string | string[]) => void;
    multiSelect?: boolean;
    searchable?: boolean;
    icon?: string;
}

export function ModernDropdown({
    label,
    value,
    options,
    onSelect,
    multiSelect = false,
    searchable = false,
    icon,
}: ModernDropdownProps) {
    const [visible, setVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const theme = useTheme();

    const selectedValues = Array.isArray(value) ? value : [value];
    const filteredOptions = searchable
        ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : options;

    const handleSelect = (optionValue: string) => {
        if (multiSelect) {
            const newValues = selectedValues.includes(optionValue)
                ? selectedValues.filter(v => v !== optionValue)
                : [...selectedValues, optionValue];
            onSelect(newValues);
        } else {
            onSelect(optionValue);
            setVisible(false);
        }
    };

    const getDisplayText = () => {
        if (selectedValues.length === 0) return label;
        if (multiSelect) {
            return `${selectedValues.length} selected`;
        }
        return options.find(opt => opt.value === value)?.label || label;
    };

    return (
        <View style={styles.container}>
            <Button
                mode="elevated"
                onPress={() => setVisible(true)}
                style={[styles.button, { backgroundColor: theme.colors.surface }]}
                contentStyle={styles.buttonContent}
                icon={icon}
                textColor={theme.colors.onSurface}>
                {getDisplayText()}
            </Button>

            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={() => setVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text variant="titleLarge">{label}</Text>
                            <Button onPress={() => setVisible(false)}>Done</Button>
                        </View>

                        {searchable && (
                            <Searchbar
                                placeholder="Search..."
                                onChangeText={setSearchQuery}
                                value={searchQuery}
                                style={styles.searchbar}
                            />
                        )}

                        <View style={styles.optionsList}>
                            {filteredOptions.map(option => (
                                <View key={option.value}>
                                    <Menu.Item
                                        onPress={() => handleSelect(option.value)}
                                        title={option.label}
                                        leadingIcon={
                                            selectedValues.includes(option.value)
                                                ? 'check-circle'
                                                : 'circle-outline'
                                        }
                                    />
                                    <Divider />
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    button: {
        borderRadius: 12,
        elevation: 2,
    },
    buttonContent: {
        paddingVertical: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    searchbar: {
        margin: 16,
        elevation: 0,
    },
    optionsList: {
        paddingHorizontal: 8,
    },
});
