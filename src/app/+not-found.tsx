import { Stack, router } from 'expo-router';

import { ErrorScreen } from '@/components/ui/ErrorScreen';

/** Rota inexistente (ex.: link antigo ou digitado errado). Substitui a tela padrão, sem tema. */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Não encontrado' }} />
      <ErrorScreen
        title="Página não encontrada"
        description="O conteúdo que você tentou abrir não existe ou foi removido."
        primaryAction={{ label: 'Ir para meus treinos', onPress: () => router.dismissAll() }}
      />
    </>
  );
}
