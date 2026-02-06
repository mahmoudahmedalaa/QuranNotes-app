import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Searchbar, Card, Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSearch } from '../src/presentation/hooks/useSearch';
import { Verse } from '../src/domain/entities/Quran';

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
            style={styles.card}
            onPress={() => router.push(`/surah/${item.surahNumber}`)} // TODO: Scroll to verse? Deep linking needs complexity.
        >
            <Card.Content>
                <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
                    Surah {item.surahNumber}, Verse {item.number}
                </Text>
                <Text variant="bodyMedium" numberOfLines={3}>
                    {item.translation}
                </Text>
            </Card.Content>
        </Card>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Searchbar
                    placeholder="Search Quran (English)..."
                    onChangeText={setQuery}
                    value={query}
                    onSubmitEditing={handleSearch}
                    loading={loading}
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
                            <Text style={{ marginTop: 20 }}>
                                {results.length === 0 && query
                                    ? 'No results found'
                                    : 'Enter a keyword to search'}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
    },
    list: {
        padding: 16,
    },
    card: {
        marginBottom: 8,
        backgroundColor: 'white',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
