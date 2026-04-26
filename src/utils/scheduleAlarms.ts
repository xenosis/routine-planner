import * as Notifications from 'expo-notifications';
import type { Schedule } from '../db/scheduleDb';

export function formatAlarmTime(minutes: number): string {
  if (minutes === 0) return '마감 시각';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return `${h === Math.floor(h) ? Math.floor(h) : h.toFixed(1)}시간 전`;
  }
  if (minutes < 10080) {
    const d = minutes / 1440;
    return `${d === Math.floor(d) ? Math.floor(d) : d.toFixed(1)}일 전`;
  }
  const w = minutes / 10080;
  return `${w === Math.floor(w) ? Math.floor(w) : w.toFixed(1)}주 전`;
}

// 반복 일정의 다음 발생일 계산 (오늘 이후 첫 번째 날짜, 없으면 null)
export function getNextRepeatOccurrence(schedule: Schedule): string | null {
  if (!schedule.repeat) return null;

  const now = new Date();
  const [startH, startM] = schedule.startTime.split(':').map(Number);
  const startDate = new Date(schedule.date + 'T00:00:00');
  const repeatUntil = schedule.repeatUntil
    ? new Date(schedule.repeatUntil + 'T23:59:59')
    : null;

  let next: Date;

  switch (schedule.repeat) {
    case 'daily': {
      next = new Date(Math.max(startDate.getTime(), now.getTime()));
      next.setHours(0, 0, 0, 0);
      const alarmTime = new Date(next);
      alarmTime.setHours(startH, startM, 0, 0);
      if (alarmTime <= now) next.setDate(next.getDate() + 1);
      break;
    }
    case 'weekly': {
      const targetDay = startDate.getDay();
      next = new Date(Math.max(startDate.getTime(), now.getTime()));
      next.setHours(0, 0, 0, 0);
      const daysUntil = (targetDay - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + daysUntil);
      const alarmTime = new Date(next);
      alarmTime.setHours(startH, startM, 0, 0);
      if (alarmTime <= now) next.setDate(next.getDate() + 7);
      break;
    }
    case 'monthly': {
      const targetDay = startDate.getDate();
      next = new Date(now.getFullYear(), now.getMonth(), targetDay);
      next.setHours(0, 0, 0, 0);
      if (next < startDate) next.setMonth(next.getMonth() + 1);
      const alarmTime = new Date(next);
      alarmTime.setHours(startH, startM, 0, 0);
      if (alarmTime <= now) next.setMonth(next.getMonth() + 1);
      break;
    }
    case 'yearly': {
      const targetMonth = startDate.getMonth();
      const targetDay = startDate.getDate();
      next = new Date(now.getFullYear(), targetMonth, targetDay);
      next.setHours(0, 0, 0, 0);
      if (next < startDate) next.setFullYear(next.getFullYear() + 1);
      const alarmTime = new Date(next);
      alarmTime.setHours(startH, startM, 0, 0);
      if (alarmTime <= now) next.setFullYear(next.getFullYear() + 1);
      break;
    }
    default:
      return null;
  }

  if (repeatUntil && next > repeatUntil) return null;

  const y = next.getFullYear();
  const mo = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

// 반복 알람 ID: {scheduleId}_repeat_{index}
export async function cancelRepeatAlarms(scheduleId: string, alarmCount = 5): Promise<void> {
  for (let i = 0; i < Math.max(alarmCount, 5); i++) {
    await Notifications.cancelScheduledNotificationAsync(`${scheduleId}_repeat_${i}`).catch(() => {});
  }
}

// 반복 일정의 다음 발생일에 알람 등록
export async function scheduleNextRepeatAlarm(schedule: Schedule): Promise<void> {
  if (!schedule.alarm || !schedule.alarmTimes?.length || !schedule.repeat) return;

  try {
  await cancelRepeatAlarms(schedule.id, schedule.alarmTimes.length);

  // 테스트용 분 단위 반복: 다음 발생 시각을 직접 계산
  if (schedule.repeat.startsWith('minutes:')) {
    const intervalMins = parseInt(schedule.repeat.split(':')[1], 10);
    if (!intervalMins || intervalMins <= 0) return;

    const now = new Date();
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const startBase = new Date(schedule.date + 'T00:00:00');
    startBase.setHours(startH, startM, 0, 0);

    let triggerDate: Date;
    if (startBase > now) {
      triggerDate = startBase;
    } else {
      const intervalMs = intervalMins * 60 * 1000;
      const elapsed = now.getTime() - startBase.getTime();
      triggerDate = new Date(startBase.getTime() + Math.ceil(elapsed / intervalMs) * intervalMs);
    }

    const repeatUntilDate = schedule.repeatUntil
      ? new Date(schedule.repeatUntil + 'T23:59:59')
      : null;
    if (repeatUntilDate && triggerDate > repeatUntilDate) return;

    await Notifications.scheduleNotificationAsync({
      identifier: `${schedule.id}_repeat_0`,
      content: {
        title: schedule.title,
        body: `${intervalMins}분마다 반복 알람`,
        data: { type: 'schedule' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'default',
      },
    });
    return;
  }

  // 날짜 기반 반복 (daily/weekly/monthly/yearly)
  const nextDate = getNextRepeatOccurrence(schedule);
  if (!nextDate) return;

  const [year, month, day] = nextDate.split('-').map(Number);
  const [hour, minute] = schedule.startTime.split(':').map(Number);

  for (let i = 0; i < schedule.alarmTimes.length; i++) {
    const mins = schedule.alarmTimes[i];
    const triggerDate = new Date(year, month - 1, day, hour, minute);
    triggerDate.setMinutes(triggerDate.getMinutes() - mins);

    if (triggerDate <= new Date()) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${schedule.id}_repeat_${i}`,
      content: {
        title: schedule.title,
        body: mins === 0 ? '지금 일정이 시작됩니다' : `${formatAlarmTime(mins)} 일정이 있습니다`,
        data: { type: 'schedule' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'default',
      },
    });
  }
  } catch (e) {
    console.warn('반복 알람 예약 실패:', e);
  }
}

// 비반복 일정 복수 알람 등록
export async function scheduleAlarmNotifications(schedule: Schedule): Promise<void> {
  if (!schedule.alarm || !schedule.alarmTimes?.length) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return;
    }

    const [year, month, day] = schedule.date.split('-').map(Number);
    const [hour, minute] = schedule.startTime.split(':').map(Number);

    await Notifications.cancelScheduledNotificationAsync(schedule.id).catch(() => {});
    for (let i = 0; i < 20; i++) {
      await Notifications.cancelScheduledNotificationAsync(`${schedule.id}_${i}`).catch(() => {});
    }

    for (let i = 0; i < schedule.alarmTimes.length; i++) {
      const mins = schedule.alarmTimes[i];
      const triggerDate = new Date(year, month - 1, day, hour, minute);
      triggerDate.setMinutes(triggerDate.getMinutes() - mins);

      if (triggerDate <= new Date()) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `${schedule.id}_${i}`,
        content: {
          title: schedule.title,
          body: mins === 0 ? '지금 일정이 시작됩니다' : `${formatAlarmTime(mins)} 일정이 있습니다`,
          data: { type: 'schedule' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: 'default',
        },
      });
    }
  } catch (e) {
    console.warn('알람 예약 실패:', e);
  }
}
