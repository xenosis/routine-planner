import * as SQLite from 'expo-sqlite';

// DB 싱글톤 인스턴스 (모듈 레벨에서 관리)
let dbInstance: SQLite.SQLiteDatabase | null = null;
// 동시 다중 호출 시 openDatabaseAsync를 한 번만 실행하기 위한 Promise 캐시
let dbOpenPromise: Promise<SQLite.SQLiteDatabase> | null = null;
// initDatabase도 한 번만 실행하기 위한 Promise 캐시
let initPromise: Promise<void> | null = null;

/**
 * DB 싱글톤 인스턴스를 반환한다.
 * 최초 호출 시 DB를 열고, 이후 호출 시 캐시된 인스턴스를 반환한다.
 * Promise를 캐시해 동시 호출이 발생해도 openDatabaseAsync는 한 번만 실행된다.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance !== null) {
    return dbInstance;
  }
  if (dbOpenPromise === null) {
    dbOpenPromise = SQLite.openDatabaseAsync('routine_planner.db').then((db) => {
      dbInstance = db;
      return db;
    });
  }
  return dbOpenPromise;
}

/**
 * 앱 시작 시 호출하여 필요한 테이블을 생성한다.
 * IF NOT EXISTS 구문으로 멱등성(idempotent) 보장.
 * Promise를 캐시해 동시 호출이 발생해도 실제 초기화는 한 번만 실행된다.
 */
export async function initDatabase(): Promise<void> {
  if (initPromise === null) {
    initPromise = _initDatabase();
  }
  return initPromise;
}

async function _initDatabase(): Promise<void> {
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

  // categories 테이블 생성 (카테고리 커스터마이징)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type, sortOrder);
  `);

  // race condition으로 중복 삽입된 카테고리 제거 (type+name 기준으로 첫 번째만 남김)
  await db.execAsync(`
    DELETE FROM categories WHERE id NOT IN (
      SELECT MIN(id) FROM categories GROUP BY type, name
    )
  `);

  // 기본 카테고리 시드 데이터 삽입 (없을 때만)
  const existingCount = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM categories',
  );
  if (!existingCount || existingCount.cnt === 0) {
    const now = Date.now();
    const seed = [
      { name: '업무', color: '#6366F1', isDefault: 0, sortOrder: 0 },
      { name: '개인', color: '#10B981', isDefault: 0, sortOrder: 1 },
      { name: '건강', color: '#F59E0B', isDefault: 0, sortOrder: 2 },
      { name: '학습', color: '#3B82F6', isDefault: 0, sortOrder: 3 },
      { name: '가족', color: '#EC4899', isDefault: 0, sortOrder: 4 },
      { name: '기타', color: '#94A3B8', isDefault: 1, sortOrder: 5 },
    ];
    for (const type of ['schedule', 'routine', 'todo']) {
      for (const cat of seed) {
        await db.runAsync(
          'INSERT INTO categories (id, type, name, color, isDefault, sortOrder) VALUES (?, ?, ?, ?, ?, ?)',
          [`${now.toString(36)}_${type}_${cat.sortOrder}`, type, cat.name, cat.color, cat.isDefault, cat.sortOrder],
        );
      }
    }
  }

  // 카테고리 통일 마이그레이션: 모든 탭에 공통 카테고리 추가, 루틴 구 카테고리 정리
  const commonCategories = [
    { name: '업무', color: '#6366F1', sortOrder: 0 },
    { name: '개인', color: '#10B981', sortOrder: 1 },
    { name: '건강', color: '#F59E0B', sortOrder: 2 },
    { name: '학습', color: '#3B82F6', sortOrder: 3 },
    { name: '가족', color: '#EC4899', sortOrder: 4 },
  ];
  for (const type of ['schedule', 'routine', 'todo']) {
    for (const cat of commonCategories) {
      const exists = await db.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM categories WHERE type = ? AND name = ?',
        [type, cat.name],
      );
      if (!exists || exists.cnt === 0) {
        await db.runAsync(
          'INSERT INTO categories (id, type, name, color, isDefault, sortOrder) VALUES (?, ?, ?, ?, 0, ?)',
          [`${Date.now().toString(36)}_${type}_${cat.name}`, type, cat.name, cat.color, cat.sortOrder],
        );
      }
    }
  }
  // 공통 카테고리 색상·순서 통일 마이그레이션: 이미 있는 카테고리도 기준값으로 업데이트
  const unifiedCategories = [
    { name: '업무', color: '#6366F1', sortOrder: 0 },
    { name: '개인', color: '#10B981', sortOrder: 1 },
    { name: '건강', color: '#F59E0B', sortOrder: 2 },
    { name: '학습', color: '#3B82F6', sortOrder: 3 },
    { name: '가족', color: '#EC4899', sortOrder: 4 },
    { name: '기타', color: '#94A3B8', sortOrder: 5 },
  ];
  for (const type of ['schedule', 'routine', 'todo']) {
    for (const cat of unifiedCategories) {
      await db.runAsync(
        'UPDATE categories SET color = ?, sortOrder = ? WHERE type = ? AND name = ?',
        [cat.color, cat.sortOrder, type, cat.name],
      );
    }
  }

  // 루틴 탭 구 카테고리(운동/공부/청소/관리) 삭제 — 연관 루틴은 기타로 변경
  const routineDefault = await db.getFirstAsync<{ color: string }>(
    "SELECT color FROM categories WHERE type = 'routine' AND isDefault = 1",
  );
  const fallbackColor = routineDefault?.color ?? '#94A3B8';
  for (const oldName of ['운동', '공부', '청소', '관리']) {
    const old = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM categories WHERE type = ? AND name = ? AND isDefault = 0',
      ['routine', oldName],
    );
    if (old) {
      await db.runAsync(
        "UPDATE routines SET category = '기타', color = ? WHERE category = ?",
        [fallbackColor, oldName],
      );
      await db.runAsync('DELETE FROM categories WHERE id = ?', [old.id]);
    }
  }

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
