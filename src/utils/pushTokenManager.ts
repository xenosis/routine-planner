import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    console.log('[pushToken] 권한 상태:', status);
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    console.log('[pushToken] projectId:', projectId);
    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('[pushToken] 토큰:', token);
    if (!token) return;

    const { error } = await supabase.from('user_push_tokens').upsert(
      { user_id: userId, push_token: token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) console.error('[pushToken] upsert 실패:', error);
    else console.log('[pushToken] 등록 완료');
  } catch (e) {
    console.error('[pushToken] 등록 실패:', e);
  }
}
