import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScheduleScreen from '../screens/schedule/ScheduleScreen';
import RoutineScreen from '../screens/routine/RoutineScreen';
import AchievementScreen from '../screens/achievement/AchievementScreen';

export type RootTabParamList = {
  Schedule: undefined;
  Routine: undefined;
  Achievement: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TAB_ICONS: Record<keyof RootTabParamList, { focused: IconName; unfocused: IconName }> = {
  Schedule: { focused: 'calendar-month', unfocused: 'calendar-month-outline' },
  Routine: { focused: 'repeat', unfocused: 'repeat' },
  Achievement: { focused: 'chart-bar', unfocused: 'chart-bar' },
};

const TAB_LABELS: Record<keyof RootTabParamList, string> = {
  Schedule: '일정',
  Routine: '루틴',
  Achievement: '성과',
};

export default function AppNavigator(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 시스템 네비게이션 바 높이 + 기본 패딩
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof RootTabParamList];
          return (
            <MaterialCommunityIcons
              name={focused ? icons.focused : icons.unfocused}
              size={size}
              color={color}
            />
          );
        },
        tabBarLabel: TAB_LABELS[route.name as keyof RootTabParamList],
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      })}
    >
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Routine" component={RoutineScreen} />
      <Tab.Screen name="Achievement" component={AchievementScreen} />
    </Tab.Navigator>
  );
}
