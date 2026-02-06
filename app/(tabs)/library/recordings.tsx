import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert, Pressable } from 'react-native';
import {
    Text,
    useTheme,
    FAB,
    Portal,
    Dialog,
    TextInput,
    Button,
    IconButton,
    ProgressBar,
    SegmentedButtons,
} from 'react-native-paper';
import { useRecordingStorage } from '../../../src/presentation/hooks/useRecordingStorage';
import { useRecordingPlayback } from '../../../src/presentation/hooks/useRecordingPlayback';
import { useAudioRecorder } from '../../../src/presentation/hooks/useAudioRecorder';
import { useFolders } from '../../../src/infrastructure/notes/FolderContext';
import { Recording } from '../../../src/domain/entities/Recording';
import { FollowAlongSession } from '../../../src/domain/entities/FollowAlongSession';
import { LocalFollowAlongRepository } from '../../../src/data/local/LocalFollowAlongRepository';
import { DEFAULT_FOLDER } from '../../../src/domain/entities/Folder';
import { Spacing, BorderRadius, Shadows } from '../../../src/presentation/theme/DesignSystem';
import { ModernDropdown } from '../../../src/presentation/components/common/ModernDropdown';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function RecordingsScreen() {
    const theme = useTheme();
    const { recordings, saveRecording, deleteRecording, refreshRecordings } = useRecordingStorage();
    const { folders } = useFolders();
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const { isPlaying, currentUri, position, duration, isLoading, playRecording, stopPlayback } =
        useRecordingPlayback();

    const [dialogVisible, setDialogVisible] = useState(false);
    const [recordingName, setRecordingName] = useState('');
    const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
    const [pendingRecordingUri, setPendingRecordingUri] = useState<string | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);

    // Edit recording state
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
    const [editName, setEditName] = useState('');
    const [editFolderId, setEditFolderId] = useState<string | undefined>();

    // View mode for toggling between recordings and follow alongs
    const [viewMode, setViewMode] = useState<'recordings' | 'follow-alongs'>('recordings'); // Default to recordings
    // const [viewMode, setViewMode] = useState<'recordings' | 'follow-alongs'>('recordings');
    const [followAlongSessions, setFollowAlongSessions] = useState<FollowAlongSession[]>([]);

    useEffect(() => {
        refreshRecordings();
        loadFollowAlongSessions();
    }, []);

    const loadFollowAlongSessions = async () => {
        try {
            const repository = new LocalFollowAlongRepository();
            const sessions = await repository.getAllSessions();
            setFollowAlongSessions(sessions);
        } catch (error) {
            console.error('Failed to load follow along sessions:', error);
        }
    };

    // Timer for recording duration
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRecording) {
            interval = setInterval(() => setRecordingDuration(d => d + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const folderOptions = folders.map(f => ({ label: f.name, value: f.id }));

    const filteredRecordings = recordings.filter(r => {
        if (selectedFolderIds.length === 0) return true;
        const folderId = r.folderId || DEFAULT_FOLDER.id;
        return selectedFolderIds.includes(folderId);
    });

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRecordPress = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Stop any playback first
        if (isPlaying) {
            await stopPlayback();
        }

        if (isRecording) {
            const uri = await stopRecording();
            if (uri) {
                setPendingRecordingUri(uri);
                setRecordingName(`Recording ${new Date().toLocaleString()}`);
                setDialogVisible(true);
            }
        } else {
            setRecordingDuration(0);
            await startRecording();
        }
    };

    const handleSaveRecording = async () => {
        if (pendingRecordingUri && recordingName.trim()) {
            await saveRecording({
                id: Date.now().toString(),
                name: recordingName.trim(),
                uri: pendingRecordingUri,
                duration: recordingDuration,
                createdAt: new Date(),
                folderId: selectedFolderId || DEFAULT_FOLDER.id,
            });
            setDialogVisible(false);
            setPendingRecordingUri(null);
            setRecordingName('');
            setSelectedFolderId(undefined);
            setRecordingDuration(0);
        }
    };

    const handleDeleteRecording = (id: string) => {
        Alert.alert('Delete', 'Delete this recording?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    // Stop playback if this recording is playing
                    const recording = recordings.find(r => r.id === id);
                    if (recording && recording.uri === currentUri) {
                        stopPlayback();
                    }
                    deleteRecording(id);
                },
            },
        ]);
    };

    const handlePlayPress = (recording: Recording) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        playRecording(recording.uri);
    };

    const handleEditRecording = (recording: Recording) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingRecording(recording);
        setEditName(recording.name);
        setEditFolderId(recording.folderId);
        setEditDialogVisible(true);
    };

    const handleSaveEdit = async () => {
        if (editingRecording && editName.trim()) {
            // Update the recording with new name and folder
            await saveRecording({
                ...editingRecording,
                name: editName.trim(),
                folderId: editFolderId,
            });
            setEditDialogVisible(false);
            setEditingRecording(null);
            setEditName('');
            setEditFolderId(undefined);
        }
    };

    const renderRecording = ({ item }: { item: Recording }) => {
        const folder = folders.find(f => f.id === item.folderId);
        const isCurrentPlaying = currentUri === item.uri;
        const isItemPlaying = isCurrentPlaying && isPlaying;
        const progress = isCurrentPlaying && duration > 0 ? position / duration : 0;

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: theme.colors.surface },
                    Shadows.sm,
                    pressed && styles.cardPressed,
                    isCurrentPlaying && {
                        borderLeftWidth: 3,
                        borderLeftColor: theme.colors.primary,
                    },
                ]}
                onPress={() => handlePlayPress(item)}>
                {/* Play/Pause Button */}
                <Pressable
                    onPress={() => handlePlayPress(item)}
                    style={[
                        styles.playButton,
                        {
                            backgroundColor: isItemPlaying
                                ? theme.colors.primary
                                : theme.colors.primaryContainer,
                        },
                    ]}>
                    {isLoading && isCurrentPlaying ? (
                        <Ionicons
                            name="hourglass"
                            size={20}
                            color={isItemPlaying ? '#FFF' : theme.colors.primary}
                        />
                    ) : (
                        <Ionicons
                            name={isItemPlaying ? 'pause' : 'play'}
                            size={20}
                            color={isItemPlaying ? '#FFF' : theme.colors.primary}
                        />
                    )}
                </Pressable>

                <View style={styles.cardContent}>
                    <Text style={[styles.recordingName, { color: theme.colors.onSurface }]}>
                        {item.name}
                    </Text>

                    {/* Progress bar when playing */}
                    {isCurrentPlaying && (
                        <ProgressBar
                            progress={progress}
                            color={theme.colors.primary}
                            style={styles.progressBar}
                        />
                    )}

                    <View style={styles.cardMeta}>
                        {folder && (
                            <View
                                style={[
                                    styles.folderBadge,
                                    { backgroundColor: folder.color + '20' },
                                ]}>
                                <Text style={[styles.folderText, { color: folder.color }]}>
                                    {folder.name}
                                </Text>
                            </View>
                        )}
                        <Text style={[styles.duration, { color: theme.colors.onSurfaceVariant }]}>
                            {isCurrentPlaying
                                ? `${formatDuration(Math.floor(position / 1000))} / ${formatDuration(Math.floor(duration / 1000))}`
                                : formatDuration(item.duration || 0)}
                        </Text>
                        <Text style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>
                            {new Date(item.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row' }}>
                    <IconButton
                        icon="pencil-outline"
                        iconColor={theme.colors.primary}
                        size={20}
                        onPress={() => handleEditRecording(item)}
                    />
                    <IconButton
                        icon="delete-outline"
                        iconColor={theme.colors.error}
                        size={20}
                        onPress={() => handleDeleteRecording(item.id)}
                    />
                </View>
            </Pressable>
        );
    };

    // Render follow-along session
    const renderFollowAlongSession = ({ item }: { item: FollowAlongSession }) => {
        const accuracyColor = item.accuracyPercentage > 70
            ? theme.colors.primary
            : item.accuracyPercentage > 40
                ? theme.colors.tertiary
                : theme.colors.error;

        const uniqueVerses = [...new Set(item.versesRecited)].length;

        return (
            <View
                style={[
                    styles.card,
                    { backgroundColor: theme.colors.surface },
                    Shadows.sm,
                ]}>
                <View style={[styles.playButton, { backgroundColor: theme.colors.tertiaryContainer }]}>
                    <MaterialCommunityIcons
                        name="access-point"
                        size={24}
                        color={theme.colors.tertiary}
                    />
                </View>

                <View style={styles.info}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: theme.colors.onSurface }]}>
                            {item.surahNameArabic}
                        </Text>
                        <View style={[styles.accuracyBadge, { backgroundColor: accuracyColor + '20' }]}>
                            <Text style={{ color: accuracyColor, fontSize: 12, fontWeight: '600' }}>
                                {item.accuracyPercentage}%
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.surahName, { color: theme.colors.onSurfaceVariant }]}>
                        {item.surahName}
                    </Text>
                    <View style={styles.meta}>
                        <Text style={[styles.duration, { color: theme.colors.onSurfaceVariant }]}>
                            {formatDuration(item.durationSeconds)} • {uniqueVerses}/{item.totalVerses} verses
                        </Text>
                        <Text style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>
                            {new Date(item.startedAt).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                <IconButton
                    icon="delete-outline"
                    iconColor={theme.colors.error}
                    size={20}
                    onPress={() => handleDeleteSession(item.id)}
                />
            </View>
        );
    };

    const handleDeleteSession = (sessionId: string) => {
        Alert.alert('Delete Session', 'Are you sure you want to delete this follow-along session?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const repository = new LocalFollowAlongRepository();
                        await repository.deleteSession(sessionId);
                        setFollowAlongSessions(prev => prev.filter(s => s.id !== sessionId));
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (error) {
                        console.error('Failed to delete session:', error);
                    }
                },
            },
        ]);
    };

    return (
        <View style={styles.container}>
            {/* Segment Control for View Mode */}
            <View style={styles.segmentContainer}>
                {/* <SegmentedButtons
                value={viewMode}
                onValueChange={value => setViewMode(value as any)}
                buttons={[
                    {
                        value: 'recordings',
                        label: 'Voice Notes',
                        icon: 'microphone',
                    },
                    {
                        value: 'follow-alongs',
                        label: 'Follow Along (Beta)',
                        icon: 'text-recognition', 
                    },
                ]}
                style={styles.segmentedButton}
            /> */}
            </View>

            {viewMode === 'recordings' ? (
                <>
                    <View style={styles.filterBar}>
                        <ModernDropdown
                            label="Filter by folder"
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
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <IconButton
                                    icon="microphone-outline"
                                    size={56}
                                    iconColor={theme.colors.onSurfaceVariant}
                                />
                                <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                                    No recordings yet
                                </Text>
                                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                    {selectedFolderIds.length > 0
                                        ? 'No recordings in selected folders.'
                                        : 'Tap the mic to start recording.'}
                                </Text>
                            </View>
                        }
                    />
                </>
            ) : (
                <FlatList
                    data={followAlongSessions}
                    renderItem={renderFollowAlongSession}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MaterialCommunityIcons
                                name="access-point"
                                size={56}
                                color={theme.colors.onSurfaceVariant}
                            />
                            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                                No follow-along sessions
                            </Text>
                            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                Open a Surah and tap the Follow Along icon to start reciting.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Recording Timer */}
            {isRecording && (
                <View
                    style={[
                        styles.recordingTimer,
                        { backgroundColor: theme.colors.errorContainer },
                    ]}>
                    <Ionicons name="radio-button-on" size={16} color={theme.colors.error} />
                    <Text style={[styles.timerText, { color: theme.colors.error }]}>
                        Recording: {formatDuration(recordingDuration)}
                    </Text>
                </View>
            )}

            <FAB
                icon={isRecording ? 'stop' : 'microphone'}
                style={[
                    styles.fab,
                    { backgroundColor: isRecording ? theme.colors.error : theme.colors.primary },
                    Shadows.lg,
                ]}
                color="#FFF"
                onPress={handleRecordPress}
            />

            <Portal>
                <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
                    <Dialog.Title>Save Recording</Dialog.Title>
                    <Dialog.Content>
                        <Text
                            style={{
                                marginBottom: Spacing.sm,
                                color: theme.colors.onSurfaceVariant,
                            }}>
                            Duration: {formatDuration(recordingDuration)}
                        </Text>
                        <TextInput
                            label="Recording Name"
                            value={recordingName}
                            onChangeText={setRecordingName}
                            mode="outlined"
                            style={{ marginBottom: Spacing.md }}
                        />
                        <View style={styles.folderSelectRow}>
                            <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                                Folder (optional)
                            </Text>
                            <View style={styles.folderChips}>
                                {folders.map(f => (
                                    <Pressable
                                        key={f.id}
                                        onPress={() => setSelectedFolderId(f.id)}
                                        style={[
                                            styles.chip,
                                            selectedFolderId === f.id && {
                                                backgroundColor: f.color + '30',
                                            },
                                        ]}>
                                        <Text
                                            style={{
                                                color:
                                                    selectedFolderId === f.id
                                                        ? f.color
                                                        : theme.colors.onSurfaceVariant,
                                            }}>
                                            {f.name}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleSaveRecording}>Save</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Edit Recording Dialog */}
                <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
                    <Dialog.Title>Edit Recording</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Recording Name"
                            value={editName}
                            onChangeText={setEditName}
                            mode="outlined"
                            style={{ marginBottom: Spacing.md }}
                        />
                        <View style={styles.folderSelectRow}>
                            <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                                Folder
                            </Text>
                            <View style={styles.folderChips}>
                                {folders.map(f => (
                                    <Pressable
                                        key={f.id}
                                        onPress={() => setEditFolderId(f.id)}
                                        style={[
                                            styles.chip,
                                            editFolderId === f.id && {
                                                backgroundColor: f.color + '30',
                                            },
                                        ]}>
                                        <Text
                                            style={{
                                                color:
                                                    editFolderId === f.id
                                                        ? f.color
                                                        : theme.colors.onSurfaceVariant,
                                            }}>
                                            {f.name}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleSaveEdit}>Save</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    filterBar: { padding: Spacing.md },
    list: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 100,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    cardPressed: {
        opacity: 0.95,
        transform: [{ scale: 0.99 }],
    },
    playButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    cardContent: { flex: 1 },
    recordingName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    progressBar: {
        height: 3,
        borderRadius: 2,
        marginBottom: 6,
    },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    folderBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    folderText: { fontSize: 11, fontWeight: '600' },
    duration: { fontSize: 11 },
    date: { fontSize: 11 },
    empty: { alignItems: 'center', paddingTop: Spacing.xxl },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: Spacing.sm },
    emptyText: { fontSize: 14, textAlign: 'center', marginTop: Spacing.xs },
    recordingTimer: {
        position: 'absolute',
        bottom: 80,
        left: Spacing.lg,
        right: Spacing.lg,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    timerText: {
        fontWeight: '600',
        fontSize: 16,
    },
    fab: {
        position: 'absolute',
        right: Spacing.lg,
        bottom: Spacing.lg,
    },
    folderSelectRow: { marginTop: Spacing.sm },
    folderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    // Segment control styles
    segmentContainer: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xs,
    },
    segmentButtons: {
        borderRadius: BorderRadius.lg,
    },
    // Follow-along session styles
    info: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
    },
    accuracyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    surahName: {
        fontSize: 13,
        marginTop: 2,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 8,
    },
});
