import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { BorderRadius, Shadows, Spacing } from '../../theme/DesignSystem';

const { width } = Dimensions.get('window');

const TOAST_ICONS: Record<string, { name: string; bg: string; color: string }> = {
    success: { name: 'checkmark-circle', bg: '#ECFDF5', color: '#059669' },
    error: { name: 'alert-circle', bg: '#FEF2F2', color: '#DC2626' },
    info: { name: 'information-circle', bg: '#EFF6FF', color: '#3B82F6' },
};

interface ToastProps {
    text1?: string;
    text2?: string;
    type?: string;
}

const CustomToast = ({ text1, text2, type = 'success' }: ToastProps) => {
    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

    return (
        <View style={[styles.container, Shadows.lg]}>
            <BlurView intensity={92} tint="light" style={styles.blur}>
                <View style={styles.content}>
                    <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
                        <Ionicons
                            name={icon.name as any}
                            size={22}
                            color={icon.color}
                        />
                    </View>
                    <View style={styles.textCol}>
                        {text1 ? (
                            <Text style={styles.title} numberOfLines={1}>
                                {text1}
                            </Text>
                        ) : null}
                        {text2 ? (
                            <Text style={styles.subtitle} numberOfLines={2}>
                                {text2}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </BlurView>
        </View>
    );
};

export const toastConfig = {
    success: (props: any) => <CustomToast {...props} type="success" />,
    error: (props: any) => <CustomToast {...props} type="error" />,
    info: (props: any) => <CustomToast {...props} type="info" />,
};

const styles = StyleSheet.create({
    container: {
        width: width - Spacing.lg * 2,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    blur: {
        overflow: 'hidden',
        borderRadius: BorderRadius.xl,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 14,
        backgroundColor: 'rgba(255,255,255,0.75)',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textCol: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1D21',
        letterSpacing: -0.2,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7C93',
        lineHeight: 18,
    },
});
