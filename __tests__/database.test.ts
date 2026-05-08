/**
 * initDatabase race condition 방지 테스트
 *
 * 버그: initDatabase()를 동시에 여러 번 호출하면 getDb()/initDatabase() 각각의
 * Promise 캐시가 없어서 openDatabaseAsync와 시드 INSERT가 중복 실행되었다.
 * → categories 테이블에 같은 카테고리가 2~3배 삽입되어 UI에 중복으로 표시됨.
 *
 * 수정: getDb()와 initDatabase() 모두 Promise를 캐시해 동시 호출 시 한 번만 실행.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

type DbModule = typeof import('../src/db/database');

// ─────────────────────────────────────────────
// 테스트 헬퍼
// ─────────────────────────────────────────────

function makeMockDb(overrides: {
  getFirstAsyncResult?: unknown;
  onRunAsync?: (sql: string) => void;
} = {}) {
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const runAsync = jest.fn().mockImplementation(async (sql: string) => {
    overrides.onRunAsync?.(sql);
  });
  const getFirstAsync = jest.fn().mockResolvedValue(
    overrides.getFirstAsyncResult ?? { cnt: 1 },
  );
  return { execAsync, runAsync, getFirstAsync };
}

// ─────────────────────────────────────────────
// getDb() race condition 방지
// ─────────────────────────────────────────────

describe('getDb: 동시 호출 시 openDatabaseAsync는 한 번만 실행된다', () => {
  let mockOpenDatabaseAsync: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    const mockDb = makeMockDb();
    mockOpenDatabaseAsync = jest.fn().mockResolvedValue(mockDb);
    // jest.doMock은 호이스팅되지 않으므로 스코프 밖 변수 참조 가능
    jest.doMock('expo-sqlite', () => ({ openDatabaseAsync: mockOpenDatabaseAsync }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('getDb()를 동시에 3번 호출해도 openDatabaseAsync는 1번만 실행된다', async () => {
    const { getDb } = require('../src/db/database') as DbModule;
    await Promise.all([getDb(), getDb(), getDb()]);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('getDb()를 순차적으로 여러 번 호출해도 openDatabaseAsync는 1번만 실행된다', async () => {
    const { getDb } = require('../src/db/database') as DbModule;
    await getDb();
    await getDb();
    await getDb();
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────
// initDatabase() race condition 방지
// ─────────────────────────────────────────────

describe('initDatabase: 동시 호출 시 초기화 로직은 한 번만 실행된다', () => {
  let mockOpenDatabaseAsync: jest.Mock;
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    jest.resetModules();
    mockDb = makeMockDb({ getFirstAsyncResult: { cnt: 1 } }); // cnt=1 → 시드 건너뜀
    mockOpenDatabaseAsync = jest.fn().mockResolvedValue(mockDb);
    jest.doMock('expo-sqlite', () => ({ openDatabaseAsync: mockOpenDatabaseAsync }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('initDatabase()를 동시에 3번 호출해도 openDatabaseAsync는 1번만 실행된다', async () => {
    const { initDatabase } = require('../src/db/database') as DbModule;
    await Promise.all([initDatabase(), initDatabase(), initDatabase()]);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('initDatabase()를 동시에 3번 호출해도 테이블 생성(execAsync)은 1번만 실행된다', async () => {
    const { initDatabase } = require('../src/db/database') as DbModule;
    await Promise.all([initDatabase(), initDatabase(), initDatabase()]);

    const firstRunCount = mockDb.execAsync.mock.calls.length;
    expect(firstRunCount).toBeGreaterThan(0);

    // 추가 호출해도 횟수가 늘지 않는다 (initPromise 캐시 사용)
    await initDatabase();
    expect(mockDb.execAsync).toHaveBeenCalledTimes(firstRunCount);
  });
});

// ─────────────────────────────────────────────
// 시드 데이터 중복 삽입 방지
// ─────────────────────────────────────────────

describe('initDatabase: 카테고리 시드 데이터는 한 번만 삽입된다', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('categories가 비어있을 때 동시 3회 호출해도 INSERT는 13번만 실행된다', async () => {
    jest.resetModules();
    let insertCount = 0;
    const mockDb = makeMockDb({
      getFirstAsyncResult: { cnt: 0 }, // 시드 삽입 필요
      onRunAsync: (sql) => {
        if (sql.includes('INSERT INTO categories')) insertCount++;
      },
    });
    jest.doMock('expo-sqlite', () => ({
      openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
    }));

    const { initDatabase } = require('../src/db/database') as DbModule;
    await Promise.all([initDatabase(), initDatabase(), initDatabase()]);

    // 일정(4) + 루틴(5) + 할일(4) = 13개 기본 카테고리
    expect(insertCount).toBe(13);
  });
});

// ─────────────────────────────────────────────
// 버그 재현: 캐시 없이 구현했을 때 중복 삽입 발생을 확인
// ─────────────────────────────────────────────

describe('버그 재현: Promise 캐시 없으면 시드가 중복 삽입된다', () => {
  it('캐시 없는 구현에서 동시 3회 호출 시 INSERT가 39번(13×3) 실행된다', async () => {
    let insertCount = 0;

    // 캐시 없이 매 호출마다 독립적으로 실행되는 버전을 흉내냄
    const getFirstAsync = jest.fn().mockResolvedValue({ cnt: 0 });
    const runAsync = jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO categories')) insertCount++;
    });

    const noCacheInit = async () => {
      const row = await getFirstAsync() as { cnt: number };
      if (row.cnt === 0) {
        for (let i = 0; i < 13; i++) {
          await runAsync('INSERT INTO categories (id, type, name, color, isDefault, sortOrder) VALUES (?, ?, ?, ?, ?, ?)');
        }
      }
    };

    await Promise.all([noCacheInit(), noCacheInit(), noCacheInit()]);

    // 캐시 없으면 3번 × 13 = 39번 삽입 → UI에 카테고리가 3배로 표시됨
    expect(insertCount).toBe(39);
  });
});
