import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SessionHistoryCard } from '@/features/history/components/SessionHistoryCard';
import { useSessionHistory } from '@/features/history/hooks/useSessionHistory';
import type { SessionHistoryItem } from '@/features/history/types/history.types';
import { InProgressSessionBanner } from '@/features/sessions/components/InProgressSessionBanner';
import { useInProgressSessions } from '@/features/sessions/hooks/useInProgressSessions';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatMonthYear } from '@/utils/date-format';

interface MonthSection {
  key: string;
  title: string;
  data: SessionHistoryItem[];
}

/** Agrupa por mês, mantendo a ordem decrescente recebida. */
function groupByMonth(items: readonly SessionHistoryItem[]): MonthSection[] {
  const sections: MonthSection[] = [];
  for (const item of items) {
    const date = new Date(item.startedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.data.push(item);
    else sections.push({ key, title: formatMonthYear(item.startedAt), data: [item] });
  }
  return sections;
}

export default function HistoryScreen() {
  const { items, status, load, retry } = useSessionHistory();
  const { sessions: inProgress, refresh: refreshInProgress } = useInProgressSessions();

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshInProgress();
    }, [load, refreshInProgress]),
  );

  const openSession = (session: SessionHistoryItem) =>
    router.push({ pathname: '/history/[id]', params: { id: session.id } });

  const header = (
    <View style={styles.header}>
      <Text style={styles.overline}>Gym Notes</Text>
      <Text style={styles.title} accessibilityRole="header">
        Histórico
      </Text>
      {status === 'ready' ? (
        <Text style={styles.subtitle}>
          {items.length === 1 ? '1 treino concluído' : `${items.length} treinos concluídos`}
        </Text>
      ) : null}

      {/* Sessões em andamento aparecem à parte, nunca como concluídas. */}
      {inProgress.length > 0 ? (
        <View style={styles.inProgress}>
          {inProgress.map((session) => (
            <InProgressSessionBanner
              key={session.id}
              session={session}
              onPress={(target) => router.push({ pathname: '/session/[id]', params: { id: target.id } })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  const empty =
    status === 'loading' ? (
      <View style={styles.state}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando histórico" />
      </View>
    ) : status === 'error' ? (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>Não foi possível carregar</Text>
        <Text style={styles.stateDescription}>Ocorreu um erro ao ler o histórico. Tente novamente.</Text>
        <PrimaryButton label="Tentar novamente" variant="secondary" onPress={retry} />
      </View>
    ) : (
      <View style={styles.state}>
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <Text style={styles.badgeText}>0</Text>
        </View>
        <Text style={styles.stateTitle} accessibilityRole="header">
          Nenhum treino concluído
        </Text>
        <Text style={styles.stateDescription}>
          Inicie um treino e finalize a sessão para vê-la aqui, com cargas e repetições realizadas.
        </Text>
      </View>
    );

  const sections = status === 'ready' ? groupByMonth(items) : [];

  return (
    <ScreenContainer>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SessionHistoryCard session={item} onPress={openSession} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, sections.length === 0 && styles.contentEmpty]}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  overline: {
    ...typography.overline,
    color: colors.primary,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  inProgress: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    ...typography.overline,
    color: colors.textSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.display,
    color: colors.primary,
  },
  stateTitle: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  stateDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
});
