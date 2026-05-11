export function matchesRepeatDate(
  repeat: string,
  startDate: string,
  targetDate: string,
): boolean {
  const start = new Date(startDate + 'T00:00:00');
  const target = new Date(targetDate + 'T00:00:00');
  if (target < start) return false;

  switch (repeat) {
    case 'daily': return true;
    case 'weekly': return start.getDay() === target.getDay();
    case 'monthly': return start.getDate() === target.getDate();
    case 'yearly':
      return start.getMonth() === target.getMonth() && start.getDate() === target.getDate();
    default: return false;
  }
}
