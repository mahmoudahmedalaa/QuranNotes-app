import { View, StyleSheet, Text, Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import NotesScreen from './notes';
import RecordingsScreen from './recordings';
import FoldersScreen from './folders';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
} from '../../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

// Only 3 tabs - Follow Alongs integrated into Recordings
type TabKey = 'notes' | 'recordings' | 'folders';

const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'notes', label: 'Notes', icon: 'document-text' },
    { key: 'recordings', label: 'Recordings', icon: 'mic' },
    { key: 'folders', label: 'Folders', icon: 'folder' },
];

export default function LibraryLayout() {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState<TabKey>('notes');

    const handleTabChange = (tab: TabKey) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveTab(tab);
    };

    return (
        <LinearGradient
            colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
                        Library
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Your notes, recordings & folders
                    </Text>
                </View>

                {/* Tab Bar - Now with only 3 tabs for better fit */}
                <View
                    style={[styles.tabBar, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.key;
                        return (
                            <Pressable
                                key={tab.key}
                                onPress={() => handleTabChange(tab.key)}
                                style={[
                                    styles.tab,
                                    isActive && [
                                        styles.tabActive,
                                        { backgroundColor: theme.colors.primaryContainer },
                                    ],
                                ]}>
                                <Ionicons
                                    name={isActive ? tab.icon : (`${tab.icon}-outline` as any)}
                                    size={18}
                                    color={
                                        isActive
                                            ? theme.colors.primary
                                            : theme.colors.onSurfaceVariant
                                    }
                                />
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        {
                                            color: isActive
                                                ? theme.colors.primary
                                                : theme.colors.onSurfaceVariant,
                                        },
                                    ]}>
                                    {tab.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Content */}
                <View style={[styles.content, { backgroundColor: theme.colors.background }]}>
                    {activeTab === 'notes' && <NotesScreen />}
                    {activeTab === 'recordings' && <RecordingsScreen />}
                    {activeTab === 'folders' && <FoldersScreen />}
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xs,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 2,
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        padding: 4,
        borderRadius: BorderRadius.lg,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        gap: 6,
    },
    tabActive: {
        // backgroundColor applied dynamically
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
    },
});
