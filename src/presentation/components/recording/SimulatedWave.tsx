import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Spacing, BorderRadius } from '../../theme/DesignSystem';

interface SimulatedWaveProps {
    color?: string;
    count?: number;
    active?: boolean;
}

export const SimulatedWave = ({
    color = '#FF3B30',
    count = 12,
    active = true,
}: SimulatedWaveProps) => {
    return (
        <View style={styles.container}>
            {Array.from({ length: count }).map((_, i) => (
                <MotiView
                    key={i}
                    from={{ height: 10, opacity: 0.2 }}
                    animate={{
                        height: active ? Math.random() * 40 + 10 : 10,
                        opacity: active ? 0.8 : 0.2,
                    }}
                    transition={{
                        type: 'timing',
                        duration: 200 + Math.random() * 200,
                        loop: true,
                        delay: i * 50,
                    }}
                    style={[styles.bar, { backgroundColor: color, width: 4 }]}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        gap: 4,
    },
    bar: {
        borderRadius: BorderRadius.full,
    },
});
