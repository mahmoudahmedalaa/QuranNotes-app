import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import {
    Text,
    useTheme,
    IconButton,
    Card,
    Button,
    Dialog,
    TextInput,
    Portal,
    Chip,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecordingStorage } from '../../src/presentation/hooks/useRecordingStorage';
import { useAudioRecorder } from '../../src/presentation/hooks/useAudioRecorder';
import { usePro } from '../../src/infrastructure/auth/ProContext';
import { useFolders } from '../../src/infrastructure/notes/FolderContext';
import { Recording } from '../../src/domain/entities/Recording';
import { Spacing } from '../../src/presentation/theme/DesignSystem';
import { ModernDropdown } from '../../src/presentation/components/common/ModernDropdown';

import { FolderManagementDialog } from '../../src/presentation/components/common/FolderManagementDialog';

export default function RecordingsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { recordings, saveRecording, deleteRecording, refreshRecordings } = useRecordingStorage();
    const { folders, addFolder, updateFolder, deleteFolder } = useFolders();
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const { isPro } = usePro();
    const [dialogVisible, setDialogVisible] = useState(false);
    const [manageFoldersVisible, setManageFoldersVisible] = useState(false);
    const [recordingName, setRecordingName] = useState('');
    const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();

    useEffect(() => {
        refreshRecordings();
    }, []);

    const filteredRecordings = recordings.filter(r => {
        if (selectedFolderIds.length === 0) return true;
        return r.folderId && selectedFolderIds.includes(r.folderId);
    });

    const handleStartRecording = async () => {
        if (!isPro && recordings.length >= 5) {
            Alert.alert(
                'Limit Reached',
                'Free users can save up to 5 recordings. Upgrade to Pro for unlimited recordings.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Unlock Premium', onPress: () => router.push('/paywall') }
                ]
            );
            return;
        }
        await startRecording();
    };

    const handleStopRecording = async () => {
        const uri = await stopRecording();
        if (uri) {
            setDialogVisible(true);
        }
    };

    const handleSaveRecording = async () => {
        const recording: Recording = {
            id: Date.now().toString(),
            name: recordingName || `Recording ${recordings.length + 1}`,
            uri: '', // Will be set by useRecordingStorage
            folderId: selectedFolderId,
            duration: 0,
            createdAt: new Date(),
        };
        await saveRecording(recording);
        setDialogVisible(false);
        setRecordingName('');
        setSelectedFolderId(undefined);
    };

    const folderOptions = folders.map(f => ({ label: f.name, value: f.id }));

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderRecording = ({ item }: { item: Recording }) => {
        const folder = folders.find(f => f.id === item.folderId);

        return (
            <Card
                style={[styles.recordingCard, { backgroundColor: theme.colors.surface }]}
                mode="elevated">
                <Card.Content>
                    <View style={styles.recordingHeader}>
                        <View style={{ flex: 1 }}>
                            <Text
                                variant="titleMedium"
                                style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                                {item.name}
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginTop: 4,
                                }}>
                                <Text
                                    variant="labelSmall"
                                    style={{
                                        color: theme.colors.primary,
                                        fontWeight: 'bold',
                                        marginRight: 8,
                                    }}>
                                    {formatDuration(item.duration)}
                                </Text>
                                <Text
                                    variant="bodySmall"
                                    style={{ color: theme.colors.onSurfaceVariant }}>
                                    • {new Date(item.createdAt).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                        <IconButton
                            icon="play-circle"
                            size={32}
                            iconColor={theme.colors.primary}
                            onPress={() => Alert.alert('Coming Soon', 'Playback will be available in the next update.')}
                        />
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        {folder && (
                            <Chip icon="folder" compact textStyle={{ fontSize: 10 }}>
                                {folder.name}
                            </Chip>
                        )}
                        {item.surahId && (
                            <Chip
                                icon="book-open-page-variant"
                                compact
                                textStyle={{ fontSize: 10 }}>
                                Surah {item.surahId}:{item.verseId}
                            </Chip>
                        )}
                    </View>
                </Card.Content>
                <Card.Actions style={{ justifyContent: 'flex-end', paddingTop: 0 }}>
                    <IconButton
                        icon="delete-outline"
                        size={20}
                        onPress={() => deleteRecording(item.id)}
                        iconColor={theme.colors.error}
                    />
                </Card.Actions>
            </Card>
        );
    };

    return (
        <LinearGradient
            colors={
                theme.dark ? ['#121212', '#1E1E1E', '#2C2C2C'] : ['#F5F5F5', '#E8F5E9', '#C8E6C9']
            }
            style={styles.container}>
            <View style={styles.content}>
                <Text
                    variant="headlineMedium"
                    style={[styles.title, { color: theme.colors.onBackground }]}>
                    Voice Recordings
                </Text>

                <View style={styles.recordButtonContainer}>
                    <IconButton
                        icon={isRecording ? 'stop-circle' : 'microphone'}
                        size={80}
                        iconColor={theme.colors.primary}
                        style={[styles.recordButton, { backgroundColor: theme.colors.surface }]}
                        onPress={isRecording ? handleStopRecording : handleStartRecording}
                    />
                    <Text
                        variant="bodyLarge"
                        style={{ color: theme.colors.onBackground, marginTop: 16 }}>
                        {isRecording ? 'Recording...' : 'Tap to Record'}
                    </Text>
                </View>

                <View style={styles.listContainer}>
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: Spacing.sm,
                        }}>
                        <Text
                            variant="titleMedium"
                            style={[
                                styles.sectionTitle,
                                { color: theme.colors.onBackground, marginBottom: 0 },
                            ]}>
                            Saved Recordings
                        </Text>
                        <ModernDropdown
                            label="Filter Folder"
                            value={selectedFolderIds}
                            options={folderOptions}
                            onSelect={value => setSelectedFolderIds(value as string[])}
                            multiSelect
                            icon="filter-variant"
                        />
                    </View>

                    <FlatList
                        data={filteredRecordings}
                        renderItem={renderRecording}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            <Text
                                style={[
                                    styles.emptyText,
                                    { color: theme.colors.onSurfaceVariant },
                                ]}>
                                {selectedFolderIds.length > 0
                                    ? 'No recordings in selected folders'
                                    : 'No recordings yet'}
                            </Text>
                        }
                    />
                </View>
            </View>

            <Portal>
                <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
                    <Dialog.Title>Save Recording</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Recording Name"
                            value={recordingName}
                            onChangeText={setRecordingName}
                            placeholder="My Reflection"
                        />
                        <View style={{ marginTop: 16 }}>
                            <Text
                                variant="bodyMedium"
                                style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant }}>
                                Select Folder (Optional)
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {folders.map(folder => (
                                    <Chip
                                        key={folder.id}
                                        selected={selectedFolderId === folder.id}
                                        onPress={() =>
                                            setSelectedFolderId(
                                                selectedFolderId === folder.id
                                                    ? undefined
                                                    : folder.id,
                                            )
                                        }
                                        showSelectedOverlay
                                        style={{ marginBottom: 4 }}>
                                        {folder.name}
                                    </Chip>
                                ))}
                            </View>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleSaveRecording}>Save</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    title: {
        textAlign: 'center',
        marginBottom: Spacing.xl,
        fontWeight: 'bold',
    },
    recordButtonContainer: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    recordButton: {
        elevation: 8,
    },
    listContainer: {
        flex: 1,
    },
    sectionTitle: {
        marginBottom: Spacing.md,
        fontWeight: '600',
    },
    recordingCard: {
        marginBottom: Spacing.md,
        elevation: 2,
    },
    recordingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: Spacing.xl,
    },
});
