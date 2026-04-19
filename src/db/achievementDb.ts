import { getDb } from './database';

// ─────────────────────────────────────────────
// 성과 탭용 DB 조회 함수 모음
// ─────────────────────────────────────────────

/**
 * 특정 날짜 범위에서 일별 달성률 데이터를 반환한다.
 * 반환값: { date: 'YYYY-MM-DD', completedCount: number }[]
 */
export interface DailyCompletionRow {
  date: string;
  completedCount: number;
}

export async function getDailyCompletions(
  startDate: string,
  endDate: string,
): Promise<DailyCompletionRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyCompletionRow>(
    `SELECT date, COUNT(*) as completedCount
     FROM routine_completions
     WHERE date BETWEEN ? AND ?
     GROUP BY date
     ORDER BY date ASC`,
    [startDate, endDate],
  );
  return rows;
}

/**
 * 특정 달에 루틴이 완료된 날짜 목록을 반환한다.
 * 루틴 전체 수 대비 완료 비율을 계산하는 데 사용된다.
 * 반환값: { date: string, completedCount: number }[]
 */
export async function getMonthlyCompletions(
  year: number,
  month: number,
): Promise<DailyCompletionRow[]> {
  const db = await getDb();
  // YYYY-MM 형식으로 해당 월의 시작과 끝 날짜 계산
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  // 다음 달 1일 전날까지 (31일 이상인 달 포함)
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStr = String(nextMonth).padStart(2, '0');
  const endDate = `${nextYear}-${nextMonthStr}-01`;

  const rows = await db.getAllAsync<DailyCompletionRow>(
    `SELECT date, COUNT(*) as completedCount
     FROM routine_completions
     WHERE date >= ? AND date < ?
     GROUP BY date
     ORDER BY date ASC`,
    [startDate, endDate],
  );
  return rows;
}

/**
 * 루틴별 달성률을 계산하여 반환한다.
 * 각 루틴의 생성일(createdAt)부터 오늘까지 완료된 날 수 / 전체 일수를 계산한다.
 * 반환값: { routineId, title, color, completedDays, totalDays, rate, streak }[]
 */
export interface RoutineAchievementRow {
  routineId: string;
  title: string;
  color: string;
  frequency: 'daily' | 'weekly_days' | 'weekly_count';
  completedDays: number;
  totalDays: number;
  rate: number; // 0.0 ~ 1.0
  streak: number;
}

/**
 * weekly_days 루틴에서 createdAt ~ today 사이 예정된 횟수를 계산한다.
 * 루틴이 생성된 날부터 오늘까지 weekdays에 해당하는 날짜 수를 반환한다.
 */
function countScheduledOccurrences(
  createdAt: string,
  today: string,
  weekdays: number[],
): number {
  const start = new Date(createdAt);
  const end = new Date(today);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (weekdays.includes(cur.getUTCDay())) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Math.max(1, count);
}

export async function getRoutineAchievements(
  today: string,
): Promise<RoutineAchievementRow[]> {
  const db = await getDb();

  // 루틴별 완료 횟수를 한 번에 집계 (frequency, weekdays 포함)
  const rows = await db.getAllAsync<{
    routineId: string;
    title: string;
    color: string;
    createdAt: string;
    streak: number;
    frequency: string;
    weekdays: string | null;
    completedDays: number;
  }>(
    `SELECT
       r.id AS routineId,
       r.title,
       r.color,
       r.createdAt,
       r.streak,
       r.frequency,
       r.weekdays,
       COUNT(rc.id) AS completedDays
     FROM routines r
     LEFT JOIN routine_completions rc
       ON rc.routineId = r.id AND rc.date <= ?
     GROUP BY r.id
     ORDER BY r.createdAt ASC`,
    [today],
  );

  return rows.map((row) => {
    // createdAt 부터 오늘까지 경과 일수 계산 (포함)
    const created = new Date(row.createdAt);
    const todayDate = new Date(today);
    const diffMs = todayDate.getTime() - created.getTime();

    // weekly_days 루틴은 예정된 횟수 기준으로 달성률 계산
    const totalDays = (row.frequency === 'weekly_days' && row.weekdays)
      ? countScheduledOccurrences(row.createdAt, today, JSON.parse(row.weekdays) as number[])
      : Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);

    const completedDays = row.completedDays;
    const rate = Math.min(1, completedDays / totalDays);

    return {
      routineId: row.routineId,
      title: row.title,
      color: row.color,
      frequency: (row.frequency ?? 'daily') as RoutineAchievementRow['frequency'],
      completedDays,
      totalDays,
      rate,
      streak: row.streak,
    };
  });
}

/**
 * 전체 루틴 완료 횟수(누적)를 반환한다.
 */
export async function getTotalCompletionCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM routine_completions',
  );
  return row?.count ?? 0;
}

/**
 * 전체 루틴 수를 반환한다.
 */
export async function getTotalRoutineCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM routines',
  );
  return row?.count ?? 0;
}

/**
 * 오늘 완료한 루틴 수를 반환한다.
 */
export async function getTodayCompletedCount(today: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM routine_completions WHERE date = ?',
    [today],
  );
  return row?.count ?? 0;
}

/**
 * 루틴 중 가장 이른 createdAt 날짜를 반환한다.
 * 루틴이 없으면 today를 반환하여 마킹을 모두 건너뛰게 한다.
 */
export async function getEarliestRoutineCreatedAt(today: string): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ earliest: string }>(
    'SELECT MIN(createdAt) as earliest FROM routines',
  );
  return row?.earliest ?? today;
}

/**
 * 전체 루틴 중 최대 스트릭 값을 반환한다.
 * routines 테이블의 streak 컬럼을 그대로 사용한다.
 */
export async function getMaxStreak(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ maxStreak: number }>(
    'SELECT MAX(streak) as maxStreak FROM routines',
  );
  return row?.maxStreak ?? 0;
}
