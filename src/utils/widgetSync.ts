import { NativeModules, Platform } from 'react-native';
import type { Schedule } from '../db/scheduleDb';

interface WidgetScheduleItem {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  color: string;
  category: string;
  nameTag: string | null;
}

function toWidgetItem(s: Schedule): WidgetScheduleItem {
  return {
    id: s.id,
    title: s.title,
    date: s.date,
    endDate: s.endDate ?? null,
    startTime: s.startTime,
    endTime: s.endTime,
    color: s.color,
    category: s.category,
    nameTag: s.nameTag ?? null,
  };
}

export function syncWidgetData(year: number, month: number, schedules: Schedule[]): void {
  if (Platform.OS !== 'android') return;
  const { WidgetModule } = NativeModules;
  if (!WidgetModule?.updateData) return;

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const data: Record<string, WidgetScheduleItem[]> = {
    [monthKey]: schedules.map(toWidgetItem),
  };

  WidgetModule.updateData(JSON.stringify(data), year, month);
}

export function syncWidgetSelectedDate(date: string): void {
  if (Platform.OS !== 'android') return;
  const { WidgetModule } = NativeModules;
  if (!WidgetModule?.updateSelectedDate) return;
  WidgetModule.updateSelectedDate(date);
}
