import * as SQLite from 'expo-sqlite';

// DB 싱글톤 인스턴스 (모듈 레벨에서 관리)
let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * DB 싱글톤 인스턴스를 반환한다.
 * 최초 호출 시 DB를 열고, 이후 호출 시 캐시된 인스턴스를 반환한다.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance !== null) {
    return dbInstance;
  }
  dbInstance = await SQLite.openDatabaseAsync('routine_planner.db');
  return dbInstance;
}

/**
 * 앱 시작 시 호출하여 필요한 테이블을 생성한다.
 * IF NOT EXISTS 구문으로 멱등성(idempotent) 보장.
 */
export async function initDatabase(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '기타',
      color TEXT NOT NULL DEFAULT '#6366F1',
      memo TEXT,
      alarm INTEGER NOT NULL DEFAULT 0,
      alarmMinutes INTEGER,
      location TEXT
    );

    -- 날짜별 조회 성능을 위한 인덱스
    CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '기타',
      color TEXT NOT NULL DEFAULT '#94A3B8',
      targetMinutes INTEGER,
      alarm INTEGER NOT NULL DEFAULT 0,
      alarmTime TEXT,
      streak INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    -- 루틴 완료 기록 테이블: routineId + date 쌍에 UNIQUE 제약으로 중복 방지
    CREATE TABLE IF NOT EXISTS routine_completions (
      id TEXT PRIMARY KEY,
      routineId TEXT NOT NULL,
      date TEXT NOT NULL,
      UNIQUE(routineId, date)
    );

    -- 날짜별 완료 조회 성능을 위한 인덱스
    CREATE INDEX IF NOT EXISTS idx_completions_date ON routine_completions(date);
    -- 루틴별 완료 기록 조회 성능을 위한 인덱스 (스트릭 계산 시 사용)
    CREATE INDEX IF NOT EXISTS idx_completions_routine ON routine_completions(routineId);

    -- 할일(Todo) 테이블
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      deadlineDate TEXT NOT NULL,
      deadlineTime TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '기타',
      color TEXT NOT NULL DEFAULT '#6366F1',
      memo TEXT,
      alarm INTEGER NOT NULL DEFAULT 0,
      alarmTimes TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      completedAt TEXT,
      createdAt TEXT NOT NULL
    );

    -- 마감일·시간 기준 정렬 조회 성능을 위한 인덱스
    CREATE INDEX IF NOT EXISTS idx_todos_deadline ON todos(deadlineDate, deadlineTime);
    -- 완료 여부 필터링 성능을 위한 인덱스
    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
  `);

  // alarmTimes 컬럼 마이그레이션
  try {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN alarmTimes TEXT');
  } catch {
    // 컬럼이 이미 존재하면 무시
  }

  // participants 컬럼 마이그레이션
  try {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN participants TEXT');
  } catch {
    // 컬럼이 이미 존재하면 무시
  }

  // routines 테이블 마이그레이션: frequency 컬럼 추가
  try {
    await db.execAsync("ALTER TABLE routines ADD COLUMN frequency TEXT NOT NULL DEFAULT 'daily'");
  } catch {
    // 컬럼이 이미 존재하면 무시
  }
  // routines 테이블 마이그레이션: weekdays 컬럼 추가
  try {
    await db.execAsync('ALTER TABLE routines ADD COLUMN weekdays TEXT');
  } catch {
    // 컬럼이 이미 존재하면 무시
  }
  // routines 테이블 마이그레이션: weekly_count 컬럼 추가 (주 N회 빈도용)
  try {
    await db.execAsync('ALTER TABLE routines ADD COLUMN weekly_count INTEGER');
  } catch {
    // 컬럼이 이미 존재하면 무시
  }
}
