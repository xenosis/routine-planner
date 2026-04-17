import { getDb } from './database';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface Schedule {
  id: string;
  title: string;
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
  category: '업무' | '개인' | '건강' | '기타';
  color: string;        // hex color
  memo?: string;
  alarm: boolean;
  alarmTimes?: number[];  // 알람 시간 배열 (분 단위). 기존 alarmMinutes를 대체한다.
  location?: string;
  participants?: string;  // 참석자 (쉼표 구분 자유 텍스트)
}

// ─────────────────────────────────────────────
// DB 로우(row) → Schedule 변환 헬퍼
// expo-sqlite는 INTEGER 컬럼을 number로 반환하므로
// alarm(0/1)을 boolean으로, undefined 가능한 컬럼을 명시적으로 처리한다.
// ─────────────────────────────────────────────

interface ScheduleRow {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  category: string;
  color: string;
  memo: string | null;
  alarm: number;           // SQLite INTEGER: 0 또는 1
  alarmMinutes: number | null;  // 하위 호환용 (구형 데이터)
  alarmTimes: string | null;    // JSON 배열 문자열 (신형)
  location: string | null;
  participants: string | null;
}

function rowToSchedule(row: ScheduleRow): Schedule {
  // alarmTimes(신형) → alarmMinutes(구형) 순서로 하위 호환 처리
  let alarmTimes: number[] | undefined;
  if (row.alarmTimes) {
    // 신형: JSON 배열로 파싱
    try {
      alarmTimes = JSON.parse(row.alarmTimes) as number[];
    } catch {
      alarmTimes = undefined;
    }
  } else if (row.alarmMinutes !== null) {
    // 구형: 단일 값을 배열로 변환 (하위 호환)
    alarmTimes = [row.alarmMinutes];
  } else {
    alarmTimes = undefined;
  }

  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    category: row.category as Schedule['category'],
    color: row.color,
    memo: row.memo ?? undefined,
    alarm: row.alarm === 1,
    alarmTimes,
    location: row.location ?? undefined,
    participants: row.participants ?? undefined,
  };
}

// ─────────────────────────────────────────────
// CRUD 함수
// ─────────────────────────────────────────────

/**
 * 특정 날짜의 일정 목록을 startTime 오름차순으로 조회한다.
 */
export async function getSchedulesByDate(date: string): Promise<Schedule[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ScheduleRow>(
    'SELECT * FROM schedules WHERE date = ? ORDER BY startTime ASC',
    [date],
  );
  return rows.map(rowToSchedule);
}

/**
 * 특정 년/월에 일정이 하나라도 존재하는 날짜 목록을 반환한다.
 * 캘린더 dot 표시용. 반환값: YYYY-MM-DD 배열.
 */
export async function getMarkedDates(
  year: number,
  month: number,
): Promise<{ date: string; count: number }[]> {
  const db = await getDb();

  // month는 1~12 기준. LIKE 패턴으로 해당 월 전체를 필터링한다.
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const rows = await db.getAllAsync<{ date: string; count: number }>(
    'SELECT date, COUNT(*) as count FROM schedules WHERE date LIKE ? GROUP BY date ORDER BY date ASC',
    [`${prefix}-%`],
  );

  return rows;
}

/**
 * 새 일정을 DB에 삽입한다.
 * alarmTimes를 JSON 문자열로 저장하고, 구형 alarmMinutes도 하위 호환을 위해 유지한다.
 */
export async function insertSchedule(schedule: Schedule): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO schedules
       (id, title, date, startTime, endTime, category, color, memo, alarm, alarmMinutes, alarmTimes, location, participants)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      schedule.id,
      schedule.title,
      schedule.date,
      schedule.startTime,
      schedule.endTime,
      schedule.category,
      schedule.color,
      schedule.memo ?? null,
      schedule.alarm ? 1 : 0,
      schedule.alarmTimes?.[0] ?? null,
      schedule.alarmTimes ? JSON.stringify(schedule.alarmTimes) : null,
      schedule.location ?? null,
      schedule.participants ?? null,
    ],
  );
}

/**
 * 기존 일정을 업데이트한다. id를 기준으로 전체 컬럼을 갱신한다.
 * alarmTimes를 JSON 문자열로 저장하고, 구형 alarmMinutes도 하위 호환을 위해 유지한다.
 */
export async function updateSchedule(schedule: Schedule): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE schedules
     SET title = ?, date = ?, startTime = ?, endTime = ?,
         category = ?, color = ?, memo = ?, alarm = ?, alarmMinutes = ?, alarmTimes = ?, location = ?, participants = ?
     WHERE id = ?`,
    [
      schedule.title,
      schedule.date,
      schedule.startTime,
      schedule.endTime,
      schedule.category,
      schedule.color,
      schedule.memo ?? null,
      schedule.alarm ? 1 : 0,
      schedule.alarmTimes?.[0] ?? null,
      schedule.alarmTimes ? JSON.stringify(schedule.alarmTimes) : null,
      schedule.location ?? null,
      schedule.participants ?? null,
      schedule.id,
    ],
  );
}

/**
 * 특정 년/월의 전체 일정을 날짜·시간 오름차순으로 조회한다.
 * 달력 월 전체 보기에서 사용한다 (과거 일정 포함, UI에서 스크롤로 접근).
 */
export async function getSchedulesByMonth(
  year: number,
  month: number,
): Promise<Schedule[]> {
  const db = await getDb();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const rows = await db.getAllAsync<ScheduleRow>(
    'SELECT * FROM schedules WHERE date LIKE ? ORDER BY date ASC, startTime ASC',
    [`${prefix}-%`],
  );
  return rows.map(rowToSchedule);
}

/**
 * 일정을 삭제한다.
 */
export async function deleteSchedule(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM schedules WHERE id = ?', [id]);
}

// 타입을 명시적으로 재export하여 다른 모듈에서 쉽게 import할 수 있도록 한다.
export type { Schedule as ScheduleType };
