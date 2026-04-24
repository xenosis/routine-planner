import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootTabParamList } from '../navigation/AppNavigator';

export const navigationRef = createNavigationContainerRef<RootTabParamList>();

// 앱이 killed 상태에서 알림으로 실행된 경우 pending 저장
let pendingNotifType: string | undefined = undefined;

export function setPendingNotifType(type: string | undefined) {
  pendingNotifType = type;
}

export function consumePendingNotifType(): string | undefined {
  const type = pendingNotifType;
  pendingNotifType = undefined;
  return type;
}

export function navigateToTab(type: string | undefined) {
  if (!navigationRef.isReady()) return;
  if (type === 'schedule') navigationRef.navigate('Schedule');
  else if (type === 'todo') navigationRef.navigate('Todo');
  else if (type === 'routine') navigationRef.navigate('Routine');
}
