import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS !== 'android') throw new Error('Android 전용 기능입니다');

  const { status } = await Notifications.requestPermissionsAsync();
  console.log('[pushToken] 권한 상태:', status);
  if (status !== 'granted') throw new Error(`알림 권한이 없습니다 (상태: ${status})`);

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  console.log('[pushToken] projectId:', projectId);
  if (!projectId) throw new Error('EAS projectId를 찾을 수 없습니다 (개발 빌드에서는 동작하지 않습니다)');

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;
  console.log('[pushToken] 토큰:', token);
  if (!token) throw new Error('푸시 토큰 발급 실패');

  const { error } = await supabase.from('user_push_tokens').upsert(
    { user_id: userId, push_token: token, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(`DB 저장 실패: ${error.message}`);
  console.log('[pushToken] 등록 완료:', token);
}
