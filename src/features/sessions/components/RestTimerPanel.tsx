import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { REST_ADJUST_STEP_MS, getRemainingMs, isRestFinished, type RestTimerState } from '@/features/sessions/utils/rest-timer';
import { useNow } from '@/hooks/useNow';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatCountdown } from '@/utils/time-format';

interface RestTimerPanelProps {
  state: RestTimerState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onAdjust: (deltaMs: number) => void;
  onDismiss: () => void;
}

/**
 * Painel do cronômetro de descanso, fixo na parte inferior da tela.
 * O restante é recalculado a partir de timestamps a cada redesenho (`useNow`).
 */
export function RestTimerPanel({ state, onStart, onPause, onResume, onAdjust, onDismiss }: RestTimerPanelProps) {
  const now = useNow(250, state.status === 'running');
  const [pulse] = useState(() => new Animated.Value(1));

  const finished = isRestFinished(state, now);
  const remainingMs = getRemainingMs(state, now);
  const progress =
    state.status === 'idle' || state.durationMs === 0 ? 0 : Math.min(1, Math.max(0, remainingMs / state.durationMs));

  // Feedback visual ao terminar: o número pulsa até o usuário fechar.
  useEffect(() => {
    if (!finished) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [finished, pulse]);

  if (state.status === 'idle') return null;

  const overline = finished
    ? 'Descanso finalizado!'
    : state.status === 'offer'
      ? 'Série concluída'
      : state.status === 'paused'
        ? 'Descanso pausado'
        : 'Descansando';

  const canAdjust = !finished;

  return (
    <View style={[styles.panel, finished && styles.panelFinished]} accessibilityLiveRegion="polite">
      <View style={styles.titleRow}>
        <Text style={[styles.overline, finished && styles.overlineFinished]}>{overline}</Text>
        <Text style={styles.label} numberOfLines={1}>
          {finished ? 'Hora da próxima série' : state.label}
        </Text>
      </View>

      <View style={styles.clockRow}>
        {canAdjust ? (
          <PrimaryButton
            label="−15s"
            variant="secondary"
            size="compact"
            onPress={() => onAdjust(-REST_ADJUST_STEP_MS)}
            accessibilityLabel="Diminuir 15 segundos"
          />
        ) : null}
        <Animated.Text
          style={[styles.clock, finished && styles.clockFinished, { opacity: pulse }]}
          accessibilityLabel={`Descanso restante ${formatCountdown(remainingMs)}`}
        >
          {formatCountdown(remainingMs)}
        </Animated.Text>
        {canAdjust ? (
          <PrimaryButton
            label="+15s"
            variant="secondary"
            size="compact"
            onPress={() => onAdjust(REST_ADJUST_STEP_MS)}
            accessibilityLabel="Aumentar 15 segundos"
          />
        ) : null}
      </View>

      {state.status === 'running' || state.status === 'paused' ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}

      <View style={styles.actions}>
        {finished ? (
          <PrimaryButton label="Fechar" onPress={onDismiss} style={styles.action} />
        ) : state.status === 'offer' ? (
          <>
            <PrimaryButton label="Pular" variant="secondary" onPress={onDismiss} style={styles.action} />
            <PrimaryButton label="Iniciar descanso" onPress={onStart} style={styles.actionWide} />
          </>
        ) : state.status === 'running' ? (
          <>
            <PrimaryButton label="Pausar" variant="secondary" onPress={onPause} style={styles.action} />
            <PrimaryButton label="Encerrar" variant="secondary" onPress={onDismiss} style={styles.action} />
          </>
        ) : (
          <>
            <PrimaryButton label="Retomar" onPress={onResume} style={styles.action} />
            <PrimaryButton label="Encerrar" variant="secondary" onPress={onDismiss} style={styles.action} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    // Sombra para separar do conteúdo que rola por baixo.
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  panelFinished: {
    borderColor: colors.primary,
  },
  titleRow: {
    gap: spacing.xxs,
  },
  overline: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  overlineFinished: {
    color: colors.primary,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  clock: {
    ...typography.display,
    flex: 1,
    fontSize: 40,
    lineHeight: 46,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  clockFinished: {
    color: colors.primary,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  actionWide: {
    flex: 2,
    paddingHorizontal: spacing.md,
  },
});
