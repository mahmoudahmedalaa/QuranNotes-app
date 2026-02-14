import { useState } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Searchbar, Card, Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../src/presentation/hooks/useSearch';
import { Verse } from '../src/domain/entities/Quran';
import { Spacing, BorderRadius, Shadows } from '../src/presentation/theme/DesignSystem';

export default function SearchScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { results, loading, search } = useSearch();
    const [query, setQuery] = useState('');

    const handleSearch = () => {
        search(query);
    };

    const renderItem = ({ item }: { item: Verse }) => (
        <Card
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
            onPress={() => router.push(`/surah/${item.surahNumber}?verse=${item.number}`)}
        >
            <Card.Content>
                <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
                    Surah {item.surahNumber}, Verse {item.number}
                </Text>
                <Text variant="bodyMedium" numberOfLines={3} style={{ color: theme.colors.onSurface }}>
                    {item.translation}
                </Text>
            </Card.Content>
        </Card>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => [
                        styles.backButton,
                        { backgroundColor: theme.colors.surfaceVariant },
                        pressed && { opacity: 0.7 },
                    ]}
                >
                    <Ionicons name="arrow-back" size={20} color={theme.colors.onSurface} />
                </Pressable>
                <Searchbar
                    placeholder="Search Quran (English)..."
                    onChangeText={setQuery}
                    value={query}
                    onSubmitEditing={handleSearch}
                    loading={loading}
                    style={[styles.searchBar, { backgroundColor: theme.colors.surface }]}
                />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={results}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `${item.surahNumber}:${item.number}:${index}`}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={{ marginTop: 20, color: theme.colors.onSurfaceVariant }}>
                                {results.length === 0 && query
                                    ? 'No results found'
                                    : 'Enter a keyword to search'}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBar: {
        flex: 1,
        borderRadius: BorderRadius.lg,
    },
    list: {
        padding: Spacing.md,
    },
    card: {
        marginBottom: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

