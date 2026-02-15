/**
 * Premium toast notifications — Headspace-inspired minimal design.
 * Soft pill-shaped, theme-adaptive, with subtle icons and clean typography.
 */
import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const TOAST_VARIANTS: Record<string, {
    icon: string;
    iconColor: string;
    bgColor: string;
    borderColor: string;
}> = {
    success: {
        icon: 'check-circle',
        iconColor: '#22C55E',
        bgColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(34, 197, 94, 0.15)',
    },
    error: {
        icon: 'alert-circle',
        iconColor: '#EF4444',
        bgColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(239, 68, 68, 0.15)',
    },
    info: {
        icon: 'information',
        iconColor: '#6366F1',
        bgColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(99, 102, 241, 0.15)',
    },
};

interface ToastProps {
    text1?: string;
    text2?: string;
    type?: string;
}

const CustomToast = ({ text1, text2, type = 'success' }: ToastProps) => {
    const variant = TOAST_VARIANTS[type] || TOAST_VARIANTS.info;

    return (
        <View style={styles.wrapper}>
            <View style={[
                styles.container,
                {
                    backgroundColor: variant.bgColor,
                    borderColor: variant.borderColor,
                },
            ]}>
                {/* Icon — small and clean */}
                <MaterialCommunityIcons
                    name={variant.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                    size={20}
                    color={variant.iconColor}
                />

                {/* Text content */}
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
        </View>
    );
};

export const toastConfig = {
    success: (props: ToastProps) => <CustomToast {...props} type="success" />,
    error: (props: ToastProps) => <CustomToast {...props} type="error" />,
    info: (props: ToastProps) => <CustomToast {...props} type="info" />,
};

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        gap: 12,
        borderRadius: 50,
        borderWidth: 1,
        // Soft shadow — Headspace-style
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
        maxWidth: width - 48,
    },
    textCol: {
        flex: 1,
        gap: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A2E',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '400',
        color: '#6B7280',
        lineHeight: 17,
    },
});
