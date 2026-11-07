import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { downsampleMax, linearScale, nearestIndex, niceDomain } from '@/components/charts/scale';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export interface LineChartPoint {
  id: string;
  /** Eixo X (ex.: timestamp em ms). A distância entre pontos é proporcional ao tempo. */
  x: number;
  y: number;
}

interface LineChartProps {
  /** Pontos em ordem crescente de X. Série única (sem legenda: o título da seção nomeia a série). */
  points: readonly LineChartPoint[];
  formatYTick: (value: number) => string;
  formatXLabel: (x: number) => string;
  /** Texto do tooltip para o ponto selecionado, ex.: "05/11 · 42,5 kg × 10". */
  formatTooltip: (point: LineChartPoint) => string;
  /** Rótulo direto do último ponto, ex.: "42,5 kg". */
  formatEndLabel: (point: LineChartPoint) => string;
  accessibilityLabel: string;
  height?: number;
}

const Y_AXIS_WIDTH = 44;
const X_AXIS_HEIGHT = 24;
const TOP_SPACE = 36;
const RIGHT_SPACE = 12;
const INNER_X_PAD = 10;
const LINE_WIDTH = 2;
const DOT_SIZE = 8;
const DOT_RING = 2;
/** Acima disso a série é reduzida (mantendo os picos): cada ponto vira 2 Views, e a tela não comporta mais. */
const MAX_RENDERED_POINTS = 60;
/** Com muitos pontos, só a linha é desenhada (os marcadores se sobreporiam). */
const MAX_POINTS_WITH_DOTS = 40;

/**
 * Gráfico de linha leve, desenhado com Views (sem dependências nativas).
 * Linha de 2px, pontos de 8px com anel na cor da superfície, grade em hairline sólida.
 * Tocar no gráfico seleciona o ponto mais próximo no eixo X (linha vertical + tooltip).
 */
export function LineChart({
  points: allPoints,
  formatYTick,
  formatXLabel,
  formatTooltip,
  formatEndLabel,
  accessibilityLabel,
  height = 200,
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const points = downsampleMax(allPoints, MAX_RENDERED_POINTS);
  const showDots = points.length <= MAX_POINTS_WITH_DOTS;

  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH - RIGHT_SPACE);
  const plotHeight = Math.max(0, height - TOP_SPACE - X_AXIS_HEIGHT);

  const ys = points.map((point) => point.y);
  const xs = points.map((point) => point.x);
  const domain = niceDomain(Math.min(...ys), Math.max(...ys), 4);
  const scaleY = linearScale(domain.min, domain.max, plotHeight, 0);
  const scaleX = linearScale(Math.min(...xs), Math.max(...xs), INNER_X_PAD, plotWidth - INNER_X_PAD);
  const coords = points.map((point) => ({ x: scaleX(point.x), y: scaleY(point.y) }));

  const selectedIndex = selected !== null && selected < points.length ? selected : null;
  const lastIndex = points.length - 1;

  const handlePress = (locationX: number) => {
    const index = nearestIndex(
      coords.map((coord) => coord.x),
      locationX,
    );
    setSelected((current) => (current === index ? null : index));
  };

  // Rótulos do eixo X: primeiro, último e (se couber) o do meio — evita colisões.
  const xLabelIndexes = Array.from(
    new Set(points.length >= 3 && plotWidth > 240 ? [0, Math.floor(lastIndex / 2), lastIndex] : [0, lastIndex]),
  );

  return (
    <View style={{ height }} onLayout={handleLayout} accessible accessibilityLabel={accessibilityLabel}>
      {width > 0 && points.length > 0 ? (
        <>
          {/* Eixo Y: ticks redondos + grade hairline */}
          {domain.ticks.map((tick) => {
            const y = TOP_SPACE + scaleY(tick);
            return (
              <View key={tick} style={[styles.gridRow, { top: y }]} importantForAccessibility="no-hide-descendants">
                <Text style={styles.yTick} numberOfLines={1}>
                  {formatYTick(tick)}
                </Text>
                <View style={styles.gridLine} />
              </View>
            );
          })}

          {/* Área do gráfico */}
          <View
            style={[styles.plot, { left: Y_AXIS_WIDTH, top: TOP_SPACE, width: plotWidth, height: plotHeight }]}
            importantForAccessibility="no-hide-descendants"
          >
            {selectedIndex !== null ? (
              <View style={[styles.crosshair, { left: coords[selectedIndex]!.x - 0.5, height: plotHeight }]} />
            ) : null}

            {coords.slice(1).map((end, index) => {
              const start = coords[index]!;
              const dx = end.x - start.x;
              const dy = end.y - start.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx);
              return (
                <View
                  key={`segment-${points[index]!.id}`}
                  style={[
                    styles.segment,
                    {
                      width: length,
                      left: (start.x + end.x) / 2 - length / 2,
                      top: (start.y + end.y) / 2 - LINE_WIDTH / 2,
                      transform: [{ rotate: `${angle}rad` }],
                    },
                  ]}
                />
              );
            })}

            {coords.map((coord, index) =>
              !showDots && index !== selectedIndex && index !== lastIndex ? null : (
              <View
                key={points[index]!.id}
                style={[
                  styles.dot,
                  index === selectedIndex && styles.dotSelected,
                  { left: coord.x - (DOT_SIZE + DOT_RING * 2) / 2, top: coord.y - (DOT_SIZE + DOT_RING * 2) / 2 },
                ]}
              />
              ),
            )}

            {/* Rótulo direto seletivo: só o último ponto (quando nada está selecionado). */}
            {selectedIndex === null ? (
              <Text
                style={[
                  styles.endLabel,
                  {
                    top: coords[lastIndex]!.y - 26,
                    left: Math.min(Math.max(coords[lastIndex]!.x - 50, 0), plotWidth - 100),
                  },
                ]}
                numberOfLines={1}
              >
                {formatEndLabel(points[lastIndex]!)}
              </Text>
            ) : null}

            {/* Camada de toque: o alvo é o eixo X inteiro, não o ponto de 8px. */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={(event) => handlePress(event.nativeEvent.locationX)}
              accessibilityRole="adjustable"
              accessibilityLabel="Toque para ver o valor de uma sessão"
            />
          </View>

          {/* Tooltip do ponto selecionado */}
          {selectedIndex !== null ? (
            <View
              pointerEvents="none"
              style={[
                styles.tooltip,
                { left: Y_AXIS_WIDTH + Math.min(Math.max(coords[selectedIndex]!.x - 90, 0), Math.max(0, plotWidth - 180)) },
              ]}
            >
              <Text style={styles.tooltipText} numberOfLines={1}>
                {formatTooltip(points[selectedIndex]!)}
              </Text>
            </View>
          ) : null}

          {/* Eixo X: datas */}
          {xLabelIndexes.map((index) => (
            <Text
              key={`x-${points[index]!.id}`}
              style={[
                styles.xLabel,
                {
                  top: TOP_SPACE + plotHeight + 6,
                  left: Y_AXIS_WIDTH + Math.min(Math.max(coords[index]!.x - 28, -8), plotWidth - 48),
                },
              ]}
              numberOfLines={1}
              importantForAccessibility="no"
            >
              {formatXLabel(points[index]!.x)}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gridRow: {
    position: 'absolute',
    left: 0,
    right: RIGHT_SPACE,
    flexDirection: 'row',
    alignItems: 'center',
    height: 0,
  },
  yTick: {
    ...typography.caption,
    fontSize: 11,
    width: Y_AXIS_WIDTH - 6,
    textAlign: 'right',
    marginRight: 6,
    marginTop: -2,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  gridLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  plot: {
    position: 'absolute',
  },
  crosshair: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: colors.textSecondary,
  },
  segment: {
    position: 'absolute',
    height: LINE_WIDTH,
    borderRadius: LINE_WIDTH / 2,
    backgroundColor: colors.primary,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE + DOT_RING * 2,
    height: DOT_SIZE + DOT_RING * 2,
    borderRadius: (DOT_SIZE + DOT_RING * 2) / 2,
    borderWidth: DOT_RING,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
  },
  dotSelected: {
    transform: [{ scale: 1.35 }],
  },
  endLabel: {
    ...typography.caption,
    position: 'absolute',
    width: 100,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    width: 180,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tooltipText: {
    ...typography.caption,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
  },
  xLabel: {
    ...typography.caption,
    fontSize: 11,
    position: 'absolute',
    width: 56,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
});
