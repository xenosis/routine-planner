/**
 * 반복 일정 패턴이 특정 날짜(targetDate)와 일치하는지 판단하는 순수 함수.
 * - 'daily': 시작일 이후 모든 날
 * - 'weekly': 시작일과 같은 요일
 * - 'monthly': 시작일과 같은 날짜
 * - 'yearly': 시작일과 같은 월+일
 * - 'minutes:N': 시작일 당일에만 표시 (테스트용)
 */
export function matchesRepeatDate(
  repeat: string,
  startDate: string,
  targetDate: string,
): boolean {
  const start = new Date(startDate + 'T00:00:00');
  const target = new Date(targetDate + 'T00:00:00');
  if (target < start) return false;

  if (repeat.startsWith('minutes:')) return start.getTime() === target.getTime();

  switch (repeat) {
    case 'daily': return true;
    case 'weekly': return start.getDay() === target.getDay();
    case 'monthly': return start.getDate() === target.getDate();
    case 'yearly':
      return start.getMonth() === target.getMonth() && start.getDate() === target.getDate();
    default: return false;
  }
}
