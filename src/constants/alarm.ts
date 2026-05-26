export const ALARM_PRESETS = [
  { label: '마감시각', minutes: 0 },
  { label: '10분', minutes: 10 },
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '1일', minutes: 1440 },
] as const;

export const TIME_UNITS = [
  { label: '분', value: 'min' as const },
  { label: '시간', value: 'hour' as const },
  { label: '일', value: 'day' as const },
  { label: '주', value: 'week' as const },
] as const;

export type TimeUnit = 'min' | 'hour' | 'day' | 'week';
