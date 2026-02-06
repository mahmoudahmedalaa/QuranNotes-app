import { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TextInput as RNTextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Pressable,
} from 'react-native';
import {
    useTheme,
    ActivityIndicator,
    IconButton,
    Text,
    Portal,
    Modal,
    Button,
} from 'react-native-paper';
import { useNoteContext } from '../../src/infrastructure/notes/NoteContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNotes } from '../../src/presentation/hooks/useNotes';
import { useFolders } from '../../src/infrastructure/notes/FolderContext';
import { Note } from '../../src/domain/entities/Note';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
} from '../../src/presentation/theme/DesignSystem';
import { FolderPicker } from '../../src/presentation/components/common/FolderPicker';
import * as Haptics from 'expo-haptics';

export default function NoteEditorScreen() {
    const router = useRouter();
    const theme = useTheme();
    const params = useLocalSearchParams();
    const { surah, verse, id, verseText, standalone } = params;
    const isStandalone = standalone === 'true';

    const { getNoteForVerse, getNoteById, saveNote, deleteNote } = useNotes();
    const { folders } = useFolders();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [existingNoteId, setExistingNoteId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
    const [pickerVisible, setPickerVisible] = useState(false);

    useEffect(() => {
        loadNote();
    }, [surah, verse, id]);

    const loadNote = async () => {
        if (id && typeof id === 'string') {
            const note = await getNoteById(id);
            if (note) {
                setText(note.content);
                setExistingNoteId(note.id);
                setSelectedFolderId(note.folderId);
                setLoading(false);
                return;
            }
        }
        if (surah && verse) {
            const note = await getNoteForVerse(Number(surah), Number(verse));
            if (note) {
                setText(note.content);
                setExistingNoteId(note.id);
                setSelectedFolderId(note.folderId);
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!text.trim()) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Generate note ID - for standalone notes use timestamp, for verse notes use surah_verse
        const noteId =
            existingNoteId ||
            (isStandalone ? `standalone_${Date.now()}` : `${surah}_${verse}_${Date.now()}`);

        const newNote: Note = {
            id: noteId,
            surahId: isStandalone ? 0 : Number(surah), // 0 for standalone notes
            verseId: verse ? Number(verse) : undefined,
            content: text,
            folderId: selectedFolderId,
            createdAt: existingNoteId ? new Date() : new Date(),
            updatedAt: new Date(),
        };

        await saveNote(newNote);
        router.back();
    };

    const handleDelete = async () => {
        if (existingNoteId) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await deleteNote(existingNoteId);
            router.back();
        }
    };

    const handleFolderSelect = (folderId: string | undefined) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedFolderId(folderId);
    };

    if (loading) {
        return (
            <View
                style={[
                    styles.container,
                    styles.centered,
                    { backgroundColor: theme.colors.background },
                ]}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <LinearGradient
            colors={theme.dark ? ['#0F1419', '#1A1F26'] : (Gradients.sereneSky as any)}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    {/* Premium Header */}
                    <View style={styles.header}>
                        <Pressable
                            onPress={() => router.back()}
                            style={({ pressed }) => [
                                styles.backButton,
                                pressed && { opacity: 0.7 },
                            ]}>
                            <Ionicons
                                name="arrow-back"
                                size={24}
                                color={theme.colors.onBackground}
                            />
                        </Pressable>
                        <View style={styles.headerTitle}>
                            <Text style={[styles.titleText, { color: theme.colors.onBackground }]}>
                                {isStandalone
                                    ? 'New Note'
                                    : verse
                                      ? `Surah ${surah}:${verse}`
                                      : `Surah ${surah}`}
                            </Text>
                        </View>
                        <View style={styles.headerActions}>
                            {existingNoteId && (
                                <IconButton
                                    icon="delete-outline"
                                    onPress={handleDelete}
                                    iconColor={theme.colors.error}
                                    size={22}
                                />
                            )}
                            <Pressable
                                onPress={handleSave}
                                style={({ pressed }) => [
                                    styles.saveButton,
                                    { backgroundColor: theme.colors.primary },
                                    Shadows.primary,
                                    pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
                                ]}>
                                <Ionicons name="checkmark" size={20} color="#FFF" />
                            </Pressable>
                        </View>
                    </View>

                    {/* Content */}
                    <ScrollView
                        style={[styles.content, { backgroundColor: theme.colors.background }]}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}>
                        {/* Verse Quote */}
                        {verseText && (
                            <View
                                style={[
                                    styles.verseCard,
                                    { backgroundColor: theme.colors.surfaceVariant },
                                    Shadows.sm,
                                ]}>
                                <Text
                                    style={[
                                        styles.verseText,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    {verseText}
                                </Text>
                            </View>
                        )}

                        {/* Folder Selection */}
                        <Text
                            style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                            FOLDER
                        </Text>
                        <Button
                            mode="outlined"
                            onPress={() => setPickerVisible(true)}
                            icon="folder-outline"
                            style={styles.pickerButton}
                            contentStyle={styles.pickerButtonContent}
                            labelStyle={{ color: theme.colors.onSurface }}>
                            {folders.find(f => f.id === selectedFolderId)?.name || 'None'}
                        </Button>

                        <FolderPicker
                            visible={pickerVisible}
                            onDismiss={() => setPickerVisible(false)}
                            onSelect={setSelectedFolderId}
                            selectedFolderId={selectedFolderId}
                            folders={folders}
                        />

                        {/* Text Input */}
                        <Text
                            style={[
                                styles.sectionLabel,
                                { color: theme.colors.onSurfaceVariant, marginTop: Spacing.lg },
                            ]}>
                            YOUR REFLECTION
                        </Text>
                        <View
                            style={[
                                styles.inputCard,
                                { backgroundColor: theme.colors.surface },
                                Shadows.sm,
                            ]}>
                            <RNTextInput
                                style={[styles.textInput, { color: theme.colors.onSurface }]}
                                placeholder="Write your reflection..."
                                placeholderTextColor={theme.colors.onSurfaceVariant}
                                value={text}
                                onChangeText={setText}
                                multiline
                                autoFocus
                            />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
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
    keyboardView: {
        flex: 1,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    backButton: {
        padding: Spacing.sm,
    },
    headerTitle: {
        flex: 1,
        marginLeft: Spacing.sm,
    },
    titleText: {
        fontSize: 18,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    saveButton: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
    },
    scrollContent: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    verseCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
    },
    verseText: {
        fontSize: 15,
        lineHeight: 22,
        fontStyle: 'italic',
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: Spacing.sm,
    },
    pickerButton: {
        borderRadius: BorderRadius.lg,
        borderColor: 'rgba(0,0,0,0.1)',
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    pickerButtonContent: {
        height: 50,
        justifyContent: 'flex-start',
    },
    inputCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        minHeight: 200,
    },
    textInput: {
        fontSize: 16,
        lineHeight: 26,
        textAlignVertical: 'top',
        minHeight: 180,
    },
});
