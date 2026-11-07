import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type ToastType = 'success' | 'error';

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  /** Mensagem curta de confirmação (verde) ou erro (vermelho), exibida no topo da tela. */
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS: Record<ToastType, number> = { success: 2500, error: 4000 };

/** Provedor de mensagens de feedback. Uma mensagem por vez; a nova substitui a anterior. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message, type }));
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), DURATION_MS[toast.type]);
    return () => clearTimeout(timeout);
  }, [toast]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
        {toast ? (
          <Animated.View key={toast.id} entering={FadeInUp.duration(200)} exiting={FadeOutUp.duration(150)}>
            <Pressable
              onPress={dismiss}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityHint="Toque para fechar"
              style={[styles.toast, toast.type === 'error' && styles.toastError]}
            >
              <View style={[styles.dot, toast.type === 'error' && styles.dotError]} />
              <Text style={styles.message}>{toast.message}</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  return context;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  toastError: {
    borderColor: colors.error,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dotError: {
    backgroundColor: colors.error,
  },
  message: {
    ...typography.bodyStrong,
    flex: 1,
    color: colors.textPrimary,
  },
});
