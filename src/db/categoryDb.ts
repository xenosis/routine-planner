import { getDb } from './database';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface Category {
  id: string;
  type: 'schedule' | 'routine' | 'todo';
  name: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
}

// DB 로우 → Category 변환 헬퍼
interface CategoryRow {
  id: string;
  type: string;
  name: string;
  color: string;
  isDefault: number; // SQLite INTEGER: 0 또는 1
  sortOrder: number;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    type: row.type as Category['type'],
    name: row.name,
    color: row.color,
    isDefault: row.isDefault === 1,
    sortOrder: row.sortOrder,
  };
}

// ─────────────────────────────────────────────
// CRUD 함수
// ─────────────────────────────────────────────

/**
 * 타입별 카테고리 목록을 sortOrder 오름차순으로 반환한다.
 */
export async function getCategories(type: Category['type']): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories WHERE type = ? ORDER BY sortOrder ASC',
    [type],
  );
  return rows.map(rowToCategory);
}

/**
 * 새 카테고리를 추가한다.
 * sortOrder는 현재 최대값+1로 자동 지정된다.
 */
export async function insertCategory(
  type: Category['type'],
  name: string,
  color: string,
): Promise<void> {
  const db = await getDb();

  const maxRow = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sortOrder) as maxOrder FROM categories WHERE type = ?',
    [type],
  );
  const nextOrder = (maxRow?.maxOrder ?? -1) + 1;

  // 고유 ID 생성 (기존 프로젝트 패턴 따름)
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);

  await db.runAsync(
    'INSERT INTO categories (id, type, name, color, isDefault, sortOrder) VALUES (?, ?, ?, ?, ?, ?)',
    [id, type, name, color, 0, nextOrder],
  );
}

/**
 * 카테고리 이름·색상을 수정하고, 기존 데이터도 함께 마이그레이션한다.
 * - SQLite: routines, todos 테이블의 카테고리명 업데이트
 * - Supabase: schedule 타입이면 schedules 테이블도 업데이트
 */
export async function updateCategory(
  id: string,
  name: string,
  color: string,
  oldName: string,
  type: Category['type'],
): Promise<void> {
  const db = await getDb();

  // categories 테이블 업데이트
  await db.runAsync(
    'UPDATE categories SET name = ?, color = ? WHERE id = ?',
    [name, color, id],
  );

  // 이름이 변경된 경우에만 기존 데이터 마이그레이션
  if (name !== oldName) {
    if (type === 'routine') {
      await db.runAsync(
        'UPDATE routines SET category = ? WHERE category = ?',
        [name, oldName],
      );
    } else if (type === 'todo') {
      await db.runAsync(
        'UPDATE todos SET category = ? WHERE category = ?',
        [name, oldName],
      );
    } else if (type === 'schedule') {
      // Supabase schedules 테이블 업데이트
      const { error } = await supabase
        .from('schedules')
        .update({ category: name })
        .eq('category', oldName);
      if (error) {
        console.error('[categoryDb] 일정 카테고리 이름 마이그레이션 실패:', error.message);
      }
    }
  }
}

/**
 * 카테고리를 삭제하고, 해당 카테고리에 속한 기존 데이터를 '기타'로 마이그레이션한다.
 * isDefault=1인 카테고리(기타)는 삭제하지 않는다.
 */
export async function deleteCategory(
  id: string,
  name: string,
  type: Category['type'],
): Promise<void> {
  const db = await getDb();

  // isDefault 여부 확인 (방어 코드)
  const row = await db.getFirstAsync<{ isDefault: number }>(
    'SELECT isDefault FROM categories WHERE id = ?',
    [id],
  );
  if (row?.isDefault === 1) {
    // 기본 카테고리는 삭제 불가
    return;
  }

  // 삭제 전 기존 데이터 '기타'로 마이그레이션
  if (type === 'routine') {
    await db.runAsync(
      'UPDATE routines SET category = ? WHERE category = ?',
      ['기타', name],
    );
  } else if (type === 'todo') {
    await db.runAsync(
      'UPDATE todos SET category = ? WHERE category = ?',
      ['기타', name],
    );
  } else if (type === 'schedule') {
    const { error } = await supabase
      .from('schedules')
      .update({ category: '기타' })
      .eq('category', name);
    if (error) {
      console.error('[categoryDb] 일정 카테고리 삭제 마이그레이션 실패:', error.message);
    }
  }

  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

/**
 * 두 카테고리의 sortOrder를 교환한다 (순서 이동에 사용).
 */
export async function swapCategoryOrder(
  idA: string, sortOrderA: number,
  idB: string, sortOrderB: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET sortOrder = ? WHERE id = ?', [sortOrderB, idA]);
  await db.runAsync('UPDATE categories SET sortOrder = ? WHERE id = ?', [sortOrderA, idB]);
}

/**
 * 드래그앤드롭 후 카테고리 순서를 일괄 업데이트한다.
 * items 배열 순서대로 sortOrder를 0부터 재할당한다.
 */
export async function setCategoryOrder(items: Array<{ id: string; sortOrder: number }>): Promise<void> {
  const db = await getDb();
  for (const item of items) {
    await db.runAsync('UPDATE categories SET sortOrder = ? WHERE id = ?', [item.sortOrder, item.id]);
  }
}
