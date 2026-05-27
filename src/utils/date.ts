/** 로컬 시간대 기준 YYYY-MM-DD 문자열 반환 */
export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 타임스탬프 기반 고유 ID 생성 */
export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}
