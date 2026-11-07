import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { linearScale, niceDomain } from '@/components/charts/scale';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export interface BarDatum {
  key: string;
  /** Rótulo curto abaixo da coluna (ex.: "nov", "02/11"). */
  label: string;
  /** Descrição completa para o destaque e leitores de tela (ex.: "Semana de 02/11"). */
  description: string;
  value: number;
}

interface BarChartProps {
  data: readonly BarDatum[];
  /** Ex.: 3 → "3 treinos". */
  formatValue: (value: number) => string;
  /** Mostrar rótulo do eixo X a cada N colunas (evita colisão em telas estreitas). */
  labelEvery?: number;
  height?: number;
}

const Y_AXIS_WIDTH = 28;
const X_AXIS_HEIGHT = 22;
const TOP_SPACE = 20;
const MAX_BAR_WIDTH = 24;
const BAR_RADIUS = 4;

/**
 * Colunas de série única, desenhadas com Views. Colunas finas (≤ 24px), topo arredondado,
 * base reta. Toque em uma coluna para destacá-la: o valor aparece no topo dela e na legenda acima.
 * Por padrão, o período mais recente (último) fica destacado.
 */
export function BarChart({ data, formatValue, labelEvery = 1, height = 160 }: BarChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const selectedIndex = selected !== null && selected < data.length ? selected : data.length - 1;
  const selectedDatum = data[selectedIndex];

  const chartHeight = height;
  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH);
  const plotHeight = Math.max(0, chartHeight - TOP_SPACE - X_AXIS_HEIGHT);
  const maxValue = Math.max(0, ...data.map((datum) => datum.value));
  // Contagens são inteiras: ticks inteiros, a partir de zero (colunas sempre partem da base).
  const domain = niceDomain(0, Math.max(maxValue, 2), 2, { includeZero: true });
  const scaleY = linearScale(domain.min, domain.max, plotHeight, 0);
  const slot = data.length > 0 ? plotWidth / data.length : 0;
  const barWidth = Math.min(MAX_BAR_WIDTH, slot * 0.6);

  return (
    <View>
      <Text style={styles.caption} accessibilityLiveRegion="polite">
        {selectedDatum ? (
          <>
            {selectedDatum.description}: <Text style={styles.captionValue}>{formatValue(selectedDatum.value)}</Text>
          </>
        ) : (
          ' '
        )}
      </Text>

      <View style={{ height: chartHeight }} onLayout={handleLayout}>
        {width > 0 ? (
          <>
            {domain.ticks
              .filter((tick) => Number.isInteger(tick))
              .map((tick) => (
                <View key={tick} style={[styles.gridRow, { top: TOP_SPACE + scaleY(tick) }]}>
                  <Text style={styles.yTick}>{tick}</Text>
                  <View style={styles.gridLine} />
                </View>
              ))}

            {data.map((datum, index) => {
              const barHeight = plotHeight - scaleY(datum.value);
              const isSelected = index === selectedIndex;
              const left = Y_AXIS_WIDTH + slot * index;
              return (
                <Pressable
                  key={datum.key}
                  onPress={() => setSelected(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`${datum.description}: ${formatValue(datum.value)}`}
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.slot, { left, width: slot, height: chartHeight }]}
                >
                  {datum.value > 0 ? (
                    <>
                      {isSelected ? (
                        <Text style={[styles.capLabel, { bottom: X_AXIS_HEIGHT + barHeight + 2, width: slot }]}>
                          {datum.value}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.bar,
                          !isSelected && styles.barMuted,
                          { width: barWidth, height: barHeight, bottom: X_AXIS_HEIGHT, left: (slot - barWidth) / 2 },
                        ]}
                      />
                    </>
                  ) : null}
                  {index % labelEvery === (data.length - 1) % labelEvery ? (
                    <Text
                      style={[styles.xLabel, isSelected && styles.xLabelSelected, { width: slot + 16, left: -8 }]}
                      numberOfLines={1}
                    >
                      {datum.label}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  captionValue: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  yTick: {
    ...typography.caption,
    fontSize: 11,
    width: Y_AXIS_WIDTH - 6,
    marginRight: 6,
    marginTop: -2,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  gridLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  slot: {
    position: 'absolute',
    top: 0,
  },
  bar: {
    position: 'absolute',
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
    backgroundColor: colors.primary,
  },
  barMuted: {
    opacity: 0.45,
  },
  capLabel: {
    ...typography.caption,
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  xLabel: {
    ...typography.caption,
    fontSize: 11,
    position: 'absolute',
    bottom: 2,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  xLabelSelected: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
