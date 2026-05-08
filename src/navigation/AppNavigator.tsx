import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import ScheduleScreen from '../screens/schedule/ScheduleScreen';
import RoutineScreen from '../screens/routine/RoutineScreen';
import AchievementScreen from '../screens/achievement/AchievementScreen';
import TodoScreen from '../screens/todo/TodoScreen';
import AccountScreen from '../screens/account/AccountScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import { useAuthStore } from '../store/authStore';
import { navigationRef, consumePendingNotifType, navigateToTab } from '../utils/navigationRef';
import { getRepeatSchedulesWithAlarm } from '../db/scheduleDb';
import { scheduleNextRepeatAlarm } from '../utils/scheduleAlarms';
import { initDatabase } from '../db/database';
import { useCategoryStore } from '../store/categoryStore';

export type RootTabParamList = {
  Schedule: undefined;
  Routine: undefined;
  Todo: undefined;
  Achievement: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TAB_ICONS: Record<keyof RootTabParamList, { focused: IconName; unfocused: IconName }> = {
  Schedule: { focused: 'calendar-month', unfocused: 'calendar-month-outline' },
  Routine: { focused: 'repeat', unfocused: 'repeat' },
  Todo: { focused: 'checkbox-marked-circle', unfocused: 'checkbox-marked-circle-outline' },
  Achievement: { focused: 'chart-bar', unfocused: 'chart-bar' },
  Account: { focused: 'account-circle', unfocused: 'account-circle-outline' },
};

const TAB_LABELS: Record<keyof RootTabParamList, string> = {
  Schedule: '일정',
  Routine: '루틴',
  Todo: '할일',
  Achievement: '성과',
  Account: '계정',
};

// 앱 시작 시 반복 알람 누락 체크 및 재등록
// 앱이 오랫동안 종료된 경우 예약된 반복 알람이 사라졌을 수 있으므로 보완 등록
async function reRegisterMissingRepeatAlarms(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set(scheduled.map((n) => n.identifier));

    const repeatSchedules = await getRepeatSchedulesWithAlarm().catch(() => []);
    for (const schedule of repeatSchedules) {
      // 이 일정의 반복 알람 식별자가 하나도 예약되어 있지 않은 경우 재등록
      const hasAlarm = schedule.alarmTimes?.some((_, i) =>
        scheduledIds.has(`${schedule.id}_repeat_${i}`),
      );
      if (!hasAlarm) {
        await scheduleNextRepeatAlarm(schedule).catch(() => {});
      }
    }
  } catch {
    // 알람 재등록 실패 시 조용히 무시
  }
}

export default function AppNavigator(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, loading, initialize } = useAuthStore();
  const [dbReady, setDbReady] = React.useState(false);
  const fetchAllCategories = useCategoryStore((s) => s.fetchAllCategories);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 세션 확인 후 SQLite DB 초기화 — 각 스크린에서 중복 초기화하지 않도록 여기서 한 번만 실행
  useEffect(() => {
    if (!loading && session) {
      initDatabase()
        .then(() => {
          setDbReady(true);
          reRegisterMissingRepeatAlarms();
          // DB 초기화 완료 후 카테고리 데이터 전체 로드
          fetchAllCategories().catch(() => {});
        })
        .catch(() => {
          // DB 초기화 실패 시에도 앱은 계속 진행 (data fetch에서 개별 에러 처리)
          setDbReady(true);
        });
    }
  }, [loading, session]);

  // 앱 killed 상태에서 알림으로 진입한 경우: auth 로딩 완료 후 탭 이동
  // loading 완료 시점에 Tab.Navigator가 아직 mount 중일 수 있으므로
  // navigationRef.isReady()가 true가 될 때까지 rAF로 대기
  useEffect(() => {
    if (!loading && dbReady) {
      const type = consumePendingNotifType();
      if (type) {
        const tryNavigate = () => {
          if (navigationRef.isReady()) {
            navigateToTab(type);
          } else {
            requestAnimationFrame(tryNavigate);
          }
        };
        requestAnimationFrame(tryNavigate);
      }
    }
  }, [loading, dbReady]);

  if (loading || (session !== null && !dbReady)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

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
      <Tab.Screen name="Todo" component={TodoScreen} />
      <Tab.Screen name="Routine" component={RoutineScreen} />
      <Tab.Screen name="Achievement" component={AchievementScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
