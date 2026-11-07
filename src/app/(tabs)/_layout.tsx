import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';

import { HistoryTabIcon, StatsTabIcon, WorkoutsTabIcon } from '@/components/ui/TabIcons';
import { colors } from '@/theme/colors';

/** Navegação principal: Treinos, Histórico e Estatísticas. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Treinos', tabBarIcon: ({ color }) => <WorkoutsTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Histórico', tabBarIcon: ({ color }) => <HistoryTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Estatísticas', tabBarIcon: ({ color }) => <StatsTabIcon color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
