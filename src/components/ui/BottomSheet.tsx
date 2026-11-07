import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';

interface BottomSheetProps {
  visible: boolean;
  /** Toque fora do painel e botão voltar do Android. */
  onClose: () => void;
  children: ReactNode;
  closeAccessibilityLabel?: string;
}

const SLIDE_DISTANCE = 48;

/**
 * Painel inferior baseado no Modal nativo (sem dependências extras).
 * Fundo com fade nativo, painel desliza para cima, acompanha o teclado e respeita a safe area.
 */
export function BottomSheet({ visible, onClose, children, closeAccessibilityLabel = 'Fechar' }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [translateY] = useState(() => new Animated.Value(SLIDE_DISTANCE));

  useEffect(() => {
    if (!visible) {
      translateY.setValue(SLIDE_DISTANCE);
      return;
    }
    Animated.timing(translateY, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeAccessibilityLabel}
          />

          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: spacing.lg + insets.bottom, transform: [{ translateY }] },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.handle} />
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    maxHeight: '92%',
    alignSelf: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: layout.screenPaddingHorizontal,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
});
