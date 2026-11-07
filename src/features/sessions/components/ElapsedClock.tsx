import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useNow } from '@/hooks/useNow';
import { formatClock } from '@/utils/time-format';

interface ElapsedClockProps {
  /** ISO 8601 do início. */
  startedAt: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Tempo decorrido calculado como `agora - início` (não acumula ticks).
 * Por isso continua correto após segundo plano ou após reabrir o app.
 * Isolado em componente próprio para que só ele redesenhe a cada segundo.
 */
export function ElapsedClock({ startedAt, style }: ElapsedClockProps) {
  const now = useNow(1000);
  const elapsed = formatClock(now - Date.parse(startedAt));
  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]} accessibilityLabel={`Tempo decorrido ${elapsed}`}>
      {elapsed}
    </Text>
  );
}
