import React, { useEffect } from 'react';
import { Alert, Linking, Platform, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppNavigator from './src/navigation/AppNavigator';
import { lightTheme, darkTheme } from './src/theme';
import { navigationRef, navigateToTab, setPendingNotifType } from './src/utils/navigationRef';
import { getScheduleById } from './src/db/scheduleDb';
import { scheduleNextRepeatAlarm } from './src/utils/scheduleAlarms';

// 포그라운드 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function setupNotifications(): Promise<void> {
  // 1. 알림 권한 요청
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }

  // 2. Android 알림 채널 생성
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
      sound: 'default',
    });
  }

  // 3. 정확한 알람 권한 확인 (Android)
  // SCHEDULE_EXACT_ALARM은 시스템이 자동으로 취소할 수 있는 특수 권한.
  // 취소 상태에서 scheduleNotificationAsync()가 SecurityException을 던지므로
  // 앱 시작 시 probe 스케줄로 확인하고 취소된 경우 즉시 사용자에게 안내한다.
  if (Platform.OS === 'android') {
    try {
      const probeId = await Notifications.scheduleNotificationAsync({
        content: { title: '알람 확인', body: '이 알림은 자동으로 취소됩니다.' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          channelId: 'default',
        },
      });
      await Notifications.cancelScheduledNotificationAsync(probeId);
    } catch {
      // SCHEDULE_EXACT_ALARM 권한이 취소된 상태 → 사용자에게 안내
      Alert.alert(
        '알람 권한이 필요합니다',
        '설정에서 "알람 및 리마인더" 권한을 허용해야 정확한 시각에 알람을 받을 수 있습니다.\n\n설정 > 앱 > Doro > 알람 및 리마인더',
        [
          { text: '나중에', style: 'cancel' },
          {
            text: '설정 열기',
            onPress: () => {
              Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', [
                { key: 'android.provider.extra.APP_PACKAGE', value: 'com.sewoong.routineplanner' },
              ]).catch(() => Linking.openSettings());
            },
          },
        ],
      );
    }
  }

  // 4. 개발 빌드 스테일 알람 일회성 초기화
  const alreadyReset = await AsyncStorage.getItem('alarm_reset_v1');
  if (!alreadyReset) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem('alarm_reset_v1', 'true');
  }
}

export default function App(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    setupNotifications();

    // 앱이 종료된 상태에서 알림 탭으로 실행된 경우
    // navigationRef와 탭이 아직 준비 안 됐을 수 있으므로 pending으로 저장 → AppNavigator에서 처리
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const type = response.notification.request.content.data?.type as string | undefined;
        setPendingNotifType(type);
      }
    });

    // 앱이 실행 중이거나 백그라운드일 때 알림 탭 (이미 준비됐으므로 바로 navigate)
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type as string | undefined;
      navigateToTab(type);

      // 반복 일정 알람이면 다음 발생일에 알람을 즉시 재등록
      // 알람 ID 패턴: {scheduleId}_repeat_{index}
      const identifier = response.notification.request.identifier;
      if (identifier.includes('_repeat_')) {
        const scheduleId = identifier.split('_repeat_')[0];
        getScheduleById(scheduleId).then((schedule) => {
          if (schedule) scheduleNextRepeatAlarm(schedule).catch(() => {});
        });
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
