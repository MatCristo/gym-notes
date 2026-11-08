import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

/** Pontos (2×3) que indicam visualmente uma alça de arraste. Apenas decorativo. */
export function GripDots() {
  return (
    <View style={styles.grip} importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.gripRow}>
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grip: {
    gap: 3,
  },
  gripRow: {
    flexDirection: 'row',
    gap: 3,
  },
  gripDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textSecondary,
  },
});
