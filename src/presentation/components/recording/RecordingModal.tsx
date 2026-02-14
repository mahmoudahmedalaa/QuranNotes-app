import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, Pressable } from 'react-native';
import {
    Modal,
    Portal,
    Text,
    Button,
    IconButton,
    useTheme,
    TextInput,
    Chip,
} from 'react-native-paper';
import { MotiView } from 'moti';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useRecordingStorage } from '../../hooks/useRecordingStorage';
import { usePro } from '../../../infrastructure/auth/ProContext';
import { useFolders } from '../../../infrastructure/notes/FolderContext';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';
import { WaveBackground } from '../animated/WaveBackground';
import { NoorMascot } from '../mascot/NoorMascot';
import { SimulatedWave } from './SimulatedWave';

interface RecordingModalProps {
    visible: boolean;
    onDismiss: () => void;
    surahId?: number;
    verseId?: number;
}

export const RecordingModal = ({ visible, onDismiss, surahId, verseId }: RecordingModalProps) => {
    const theme = useTheme();
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const { saveRecording, recordings } = useRecordingStorage();
    const { folders } = useFolders();
    const { isPro } = usePro();
    const router = useRouter();

    const [step, setStep] = useState<'recording' | 'saving' | 'limit'>('recording');
    const [duration, setDuration] = useState(0);
    const [name, setName] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            if (!isPro && recordings.length >= 5) {
                setStep('limit');
                return;
            }

            setStep('recording');
            setDuration(0);
            setName(
                `${surahId ? `Surah ${surahId}` : 'Recording'} ${verseId ? `: ${verseId}` : ''}`,
            );
            setSelectedFolderId(undefined);
            startRecording();
        }
        return () => {
            stopRecording();
        };
    }, [visible]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isRecording) {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const [tempUri, setTempUri] = useState<string | null>(null);

    const handleStop = async () => {
        const uri = await stopRecording();
        if (uri) setTempUri(uri);
        setStep('saving');
    };

    const handleSave = async () => {
        if (!tempUri) return;
        setIsSaving(true);
        try {
            await saveRecording({
                id: Date.now().toString(),
                name,
                uri: tempUri,
                folderId: selectedFolderId,
                duration,
                createdAt: new Date(),
                surahId,
                verseId,
            });
            onDismiss();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
                <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                    <WaveBackground
                        variant="spiritual"
                        intensity="subtle"
                        style={StyleSheet.absoluteFillObject}
                    />

                    {step === 'limit' ? (
                        <View style={styles.content}>
                            <MotiView
                                from={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring' }}
                                style={{ alignItems: 'center', marginVertical: Spacing.xl }}>
                                <NoorMascot size={120} mood="happy" />
                                <Text style={[styles.title, { color: theme.colors.onSurface, textAlign: 'center' }]}>
                                    Reflection Limit Reached
                                </Text>
                                <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: Spacing.xl }]}>
                                    You've reached 5 recordings. Upgrade to Pro for unlimited space to grow your connection with the Quran.
                                </Text>
                                <Button
                                    mode="contained"
                                    onPress={() => {
                                        onDismiss();
                                        router.push('/paywall');
                                    }}
                                    style={{ width: '100%', marginBottom: Spacing.md }}
                                >
                                    Unlock Premium
                                </Button>
                                <Button
                                    mode="text"
                                    onPress={onDismiss}
                                >
                                    Maybe Later
                                </Button>
                            </MotiView>
                        </View>
                    ) : step === 'recording' ? (
                        <View style={styles.content}>
                            <MotiView
                                from={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring' }}
                                style={{ alignItems: 'center' }}>
                                <NoorMascot size={100} mood="calm" />
                                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                                    Awaiting your voice...
                                </Text>
                            </MotiView>

                            <View style={styles.vizContainer}>
                                <SimulatedWave
                                    active={isRecording}
                                    count={20}
                                    color={theme.colors.primary}
                                />
                            </View>

                            <Text style={[styles.timer, { color: theme.colors.primary }]}>
                                {formatDuration(duration)}
                            </Text>

                            {surahId && (
                                <Text
                                    style={[
                                        styles.subtitle,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    Surah {surahId} : Verse {verseId}
                                </Text>
                            )}

                            <View style={styles.controls}>
                                <Pressable
                                    onPress={handleStop}
                                    style={({ pressed }) => [
                                        styles.stopButton,
                                        { backgroundColor: theme.colors.error },
                                        Shadows.primary,
                                        pressed && { scale: 0.95, opacity: 0.9 },
                                    ]}>
                                    <IconButton icon="stop" iconColor="#FFF" size={32} />
                                </Pressable>

                                <Button
                                    mode="text"
                                    onPress={onDismiss}
                                    textColor={theme.colors.onSurfaceVariant}
                                    style={{ marginTop: Spacing.md }}>
                                    Cancel
                                </Button>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.content}>
                            <Text
                                style={[
                                    styles.title,
                                    { color: theme.colors.onSurface, marginBottom: Spacing.xl },
                                ]}>
                                Preserve this Reflection
                            </Text>

                            <TextInput
                                label="Reflection Name"
                                value={name}
                                onChangeText={setName}
                                mode="outlined"
                                style={styles.input}
                                outlineStyle={{ borderRadius: BorderRadius.lg }}
                            />

                            <View style={styles.folderSection}>
                                <Text
                                    style={[
                                        styles.selectionLabel,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    Choose Folder
                                </Text>
                                <View style={styles.chipContainer}>
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
                                            style={styles.chip}
                                            selectedColor={theme.colors.primary}>
                                            {folder.name}
                                        </Chip>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.actions}>
                                <Button
                                    onPress={() => setStep('recording')}
                                    textColor={theme.colors.onSurfaceVariant}>
                                    Back
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={handleSave}
                                    loading={isSaving}
                                    style={styles.saveButton}>
                                    Save Reflection
                                </Button>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    container: {
        margin: 20,
        alignSelf: 'center',
        width: '90%',
        maxWidth: 400,
    },
    modalContent: {
        borderRadius: BorderRadius.xxl,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    content: {
        padding: 32,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginTop: Spacing.lg,
        textAlign: 'center',
    },
    vizContainer: {
        height: 100,
        justifyContent: 'center',
        marginVertical: Spacing.xl,
    },
    timer: {
        fontSize: 48,
        fontWeight: '800',
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 14,
        marginTop: Spacing.sm,
        fontWeight: '500',
    },
    controls: {
        marginTop: Spacing.xxl,
        alignItems: 'center',
    },
    stopButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        width: '100%',
        backgroundColor: 'transparent',
    },
    folderSection: {
        width: '100%',
        marginTop: Spacing.xl,
        marginBottom: Spacing.xl,
    },
    selectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.md,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        borderRadius: BorderRadius.md,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginTop: Spacing.md,
    },
    saveButton: {
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
    },
});
