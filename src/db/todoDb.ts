import { getDb } from './database';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface Todo {
  id: string;
  title: string;
  deadlineDate: string;   // YYYY-MM-DD
  deadlineTime: string;   // HH:mm
  category: '업무' | '개인' | '건강' | '기타';
  color: string;          // hex color
  memo?: string;
  alarm: boolean;
  alarmTimes?: number[];  // 마감 기준 N분 전 배열
  completed: boolean;
  completedAt?: string;   // 완료 처리 시각 (ISO 문자열)
  createdAt: string;      // 생성 시각 (ISO 문자열)
}

// ─────────────────────────────────────────────
// DB 로우(row) → Todo 변환 헬퍼
// expo-sqlite는 INTEGER 컬럼을 number로 반환하므로
// alarm(0/1), completed(0/1)을 boolean으로 변환한다.
// ─────────────────────────────────────────────

interface TodoRow {
  id: string;
  title: string;
  deadlineDate: string;
  deadlineTime: string;
  category: string;
  color: string;
  memo: string | null;
  alarm: number;            // SQLite INTEGER: 0 또는 1
  alarmTimes: string | null; // JSON 배열 문자열
  completed: number;        // SQLite INTEGER: 0 또는 1
  completedAt: string | null;
  createdAt: string;
}

function rowToTodo(row: TodoRow): Todo {
  // alarmTimes: JSON 배열로 파싱, 실패 시 undefined
  let alarmTimes: number[] | undefined;
  if (row.alarmTimes) {
    try {
      alarmTimes = JSON.parse(row.alarmTimes) as number[];
    } catch {
      alarmTimes = undefined;
    }
  }

  return {
    id: row.id,
    title: row.title,
    deadlineDate: row.deadlineDate,
    deadlineTime: row.deadlineTime,
    category: row.category as Todo['category'],
    color: row.color,
    memo: row.memo ?? undefined,
    alarm: row.alarm === 1,
    alarmTimes,
    completed: row.completed === 1,
    completedAt: row.completedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

// ─────────────────────────────────────────────
// CRUD 함수
// ─────────────────────────────────────────────

/**
 * 완료 여부 필터로 할일 목록을 조회한다.
 * - active: 미완료 할일을 마감일·시간 오름차순으로 반환
 * - completed: 완료된 할일을 완료 시각 내림차순으로 반환
 */
export async function getTodos(filter: 'active' | 'completed'): Promise<Todo[]> {
  const db = await getDb();

  const query =
    filter === 'active'
      ? 'SELECT * FROM todos WHERE completed = 0 ORDER BY deadlineDate ASC, deadlineTime ASC'
      : 'SELECT * FROM todos WHERE completed = 1 ORDER BY completedAt DESC';

  const rows = await db.getAllAsync<TodoRow>(query);
  return rows.map(rowToTodo);
}

/**
 * 새 할일을 DB에 삽입한다.
 * alarmTimes 배열은 JSON 문자열로 직렬화하여 저장한다.
 */
export async function insertTodo(todo: Todo): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO todos
       (id, title, deadlineDate, deadlineTime, category, color, memo, alarm, alarmTimes,
        completed, completedAt, createdAt)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      todo.id,
      todo.title,
      todo.deadlineDate,
      todo.deadlineTime,
      todo.category,
      todo.color,
      todo.memo ?? null,
      todo.alarm ? 1 : 0,
      todo.alarmTimes ? JSON.stringify(todo.alarmTimes) : null,
      todo.completed ? 1 : 0,
      todo.completedAt ?? null,
      todo.createdAt,
    ],
  );
}

/**
 * 기존 할일을 업데이트한다. id를 기준으로 전체 컬럼을 갱신한다.
 * alarmTimes 배열은 JSON 문자열로 직렬화하여 저장한다.
 */
export async function updateTodo(todo: Todo): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE todos
     SET title = ?, deadlineDate = ?, deadlineTime = ?,
         category = ?, color = ?, memo = ?, alarm = ?, alarmTimes = ?,
         completed = ?, completedAt = ?
     WHERE id = ?`,
    [
      todo.title,
      todo.deadlineDate,
      todo.deadlineTime,
      todo.category,
      todo.color,
      todo.memo ?? null,
      todo.alarm ? 1 : 0,
      todo.alarmTimes ? JSON.stringify(todo.alarmTimes) : null,
      todo.completed ? 1 : 0,
      todo.completedAt ?? null,
      todo.id,
    ],
  );
}

/**
 * 할일을 삭제한다.
 */
export async function deleteTodo(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM todos WHERE id = ?', [id]);
}

/**
 * 할일의 완료 상태만 업데이트한다.
 * completed: true → completedAt을 현재 시각으로 설정
 * completed: false → completedAt을 null로 초기화
 */
export async function markTodoCompleted(
  id: string,
  completed: boolean,
  completedAt?: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE todos SET completed = ?, completedAt = ? WHERE id = ?',
    [completed ? 1 : 0, completedAt ?? null, id],
  );
}
