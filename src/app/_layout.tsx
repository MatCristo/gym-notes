import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { ToastProvider } from '@/components/ui/Toast';
import { colors } from '@/theme/colors';

/**
 * Captura erros inesperados de renderização em qualquer tela e mostra uma mensagem amigável
 * (sem detalhes técnicos) em vez da tela vermelha/branca. Os dados ficam salvos no SQLite.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <ErrorScreen
        title="Algo deu errado"
        description="Ocorreu um erro inesperado nesta tela. Seus treinos e registros continuam salvos."
        primaryAction={{ label: 'Tentar novamente', onPress: () => void retry() }}
      />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    // Necessário para os gestos de arrastar (reordenação de exercícios).
    <GestureHandlerRootView style={styles.root}>
      <ToastProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { color: colors.textPrimary },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {/* Navegação principal (abas): Treinos, Histórico e Estatísticas. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Início' }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Treino' }} />
          <Stack.Screen name="session/[id]" options={{ title: 'Treino em andamento' }} />
          <Stack.Screen name="session/summary/[id]" options={{ title: 'Resumo', animation: 'fade' }} />
          <Stack.Screen name="history/[id]" options={{ title: 'Histórico' }} />
          <Stack.Screen name="exercise-progress" options={{ title: 'Evolução' }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
