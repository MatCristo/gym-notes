import { StyleSheet, View, type ColorValue } from 'react-native';

/**
 * Ícones das abas desenhados com Views (o projeto não usa biblioteca de ícones).
 * Recebem a cor do estado da aba (ativa/inativa).
 */
interface IconProps {
  color: ColorValue;
}

/** Halter: anilhas + barra. */
export function WorkoutsTabIcon({ color }: IconProps) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View style={[styles.plate, { height: 14, backgroundColor: color }]} />
        <View style={[styles.plate, { height: 10, backgroundColor: color }]} />
        <View style={[styles.bar, { backgroundColor: color }]} />
        <View style={[styles.plate, { height: 10, backgroundColor: color }]} />
        <View style={[styles.plate, { height: 14, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Lista com marcadores (histórico). */
export function HistoryTabIcon({ color }: IconProps) {
  return (
    <View style={[styles.box, styles.column]}>
      {[0, 1, 2].map((line) => (
        <View key={line} style={styles.listRow}>
          <View style={[styles.listDot, { backgroundColor: color }]} />
          <View style={[styles.listLine, { backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

/** Colunas (estatísticas). */
export function StatsTabIcon({ color }: IconProps) {
  return (
    <View style={[styles.box, styles.columnsRow]}>
      {[8, 16, 12].map((height, index) => (
        <View key={index} style={[styles.column3, { height, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  plate: {
    width: 3,
    borderRadius: 1,
  },
  bar: {
    width: 8,
    height: 2.5,
  },
  column: {
    gap: 3,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  listDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
  listLine: {
    width: 14,
    height: 2.5,
    borderRadius: 1,
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    paddingBottom: 2,
  },
  column3: {
    width: 5,
    borderTopLeftRadius: 1.5,
    borderTopRightRadius: 1.5,
  },
});
