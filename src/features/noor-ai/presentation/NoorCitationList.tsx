import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { NoorCitation } from '../domain/generatedContract';

interface Props {
    citations: NoorCitation[];
}

export default function NoorCitationList({ citations }: Props) {
    const theme = useTheme();
    const router = useRouter();
    if (citations.length === 0) return null;
    return (
        <View style={styles.list} accessibilityLabel="Sources">
            {citations.map((citation) => {
                const range = citation.verseStart === citation.verseEnd
                    ? `${citation.surah}:${citation.verseStart}`
                    : `${citation.surah}:${citation.verseStart}–${citation.verseEnd}`;
                const label = `${citation.sourceTitle.replace(/^Tafsir\s+/i, '')} · ${range}`;
                return (
                    <Pressable
                        key={citation.chunkId}
                        accessibilityRole="button"
                        accessibilityLabel={`Open source ${label}`}
                        onPress={() => router.push(`/surah/${citation.surah}?verse=${citation.verseStart}` as never)}
                        style={({ pressed }) => [
                            styles.citation,
                            { borderColor: theme.colors.outlineVariant },
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text style={[styles.label, { color: theme.colors.primary }]}>{label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    list: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    citation: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10 },
    label: { fontSize: 12, fontWeight: '600' },
    pressed: { opacity: 0.7 },
});
