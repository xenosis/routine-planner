/** YYYY-MM-DD 에서 하루 이전 날짜를 반환한다 (UTC 기준) */
export function getPreviousDate(dateStr: string): string {
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split('T')[0];
}

/** weekly_days 루틴에서 현재 날짜 이전 예정일을 찾는다 (최대 7일 역방향 탐색) */
export function getPrevScheduledDate(dateStr: string, weekdays: number[]): string | null {
  const date = new Date(dateStr);
  for (let i = 1; i <= 7; i++) {
    date.setUTCDate(date.getUTCDate() - 1);
    if (weekdays.includes(date.getUTCDay())) {
      return date.toISOString().split('T')[0];
    }
  }
  return null;
}

/** 날짜 문자열(YYYY-MM-DD)의 주 시작일(월요일)을 반환한다 (UTC 기준) */
export function getWeekStartUTC(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split('T')[0];
}

/** 주 시작일에서 이전 주 시작일을 반환한다 */
export function getPrevWeekStart(ws: string): string {
  const d = new Date(ws + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().split('T')[0];
}

/**
 * 완료 날짜 Set 으로부터 스트릭을 계산하는 순수 함수.
 * - weeklyCount 있으면: 주 단위 연속 quota 달성 주 수
 * - weekdays 있으면: weekly_days 예정일 기준 연속 완료 횟수
 * - 그 외: daily 연속 완료 일수
 */
export function calculateStreakFromDates(
  completedDates: Set<string>,
  today: string,
  weekdays?: number[],
  weeklyCount?: number,
): number {
  if (completedDates.size === 0) return 0;

  if (weeklyCount && weeklyCount > 0) {
    const weekCountMap: Record<string, number> = {};
    for (const d of completedDates) {
      const ws = getWeekStartUTC(d);
      weekCountMap[ws] = (weekCountMap[ws] ?? 0) + 1;
    }
    let streak = 0;
    let checkWeek = getWeekStartUTC(today);
    while ((weekCountMap[checkWeek] ?? 0) >= weeklyCount) {
      streak++;
      checkWeek = getPrevWeekStart(checkWeek);
    }
    return streak;
  }

  if (weekdays && weekdays.length > 0) {
    const todayJsDay = new Date(today + 'T00:00:00Z').getUTCDay();
    const todayIsScheduled = weekdays.includes(todayJsDay);
    const startDate = (todayIsScheduled && completedDates.has(today))
      ? today
      : getPrevScheduledDate(today, weekdays);

    if (!startDate || !completedDates.has(startDate)) return 0;

    let streak = 0;
    let currentDate: string | null = startDate;
    while (currentDate && completedDates.has(currentDate)) {
      streak++;
      currentDate = getPrevScheduledDate(currentDate, weekdays);
    }
    return streak;
  }

  // daily
  const startDate = completedDates.has(today) ? today : getPreviousDate(today);
  if (!completedDates.has(startDate)) return 0;

  let streak = 0;
  let currentDate = startDate;
  while (completedDates.has(currentDate)) {
    streak++;
    currentDate = getPreviousDate(currentDate);
  }
  return streak;
}
