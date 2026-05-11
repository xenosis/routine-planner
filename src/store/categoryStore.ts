import { create } from 'zustand';
import {
  type Category,
  getCategories,
  insertCategory,
  updateCategory,
  deleteCategory,
  swapCategoryOrder,
  setCategoryOrder,
} from '../db/categoryDb';

// ─────────────────────────────────────────────
// 상태 타입
// ─────────────────────────────────────────────

interface CategoryState {
  scheduleCategories: Category[];
  routineCategories: Category[];
  todoCategories: Category[];

  fetchCategories: (type: Category['type']) => Promise<void>;
  fetchAllCategories: () => Promise<void>;
  addCategory: (type: Category['type'], name: string, color: string) => Promise<void>;
  editCategory: (
    id: string,
    name: string,
    color: string,
    oldName: string,
    type: Category['type'],
  ) => Promise<void>;
  removeCategory: (id: string, name: string, type: Category['type']) => Promise<void>;
  moveCategory: (id: string, direction: 'up' | 'down', type: Category['type']) => Promise<void>;
  reorderCategories: (type: Category['type'], newOrder: Category[]) => Promise<void>;
}

// ─────────────────────────────────────────────
// 스토어
// ─────────────────────────────────────────────

export const useCategoryStore = create<CategoryState>((set) => ({
  scheduleCategories: [],
  routineCategories: [],
  todoCategories: [],

  fetchCategories: async (type) => {
    const categories = await getCategories(type);
    if (type === 'schedule') {
      set({ scheduleCategories: categories });
    } else if (type === 'routine') {
      set({ routineCategories: categories });
    } else {
      set({ todoCategories: categories });
    }
  },

  fetchAllCategories: async () => {
    const [schedule, routine, todo] = await Promise.all([
      getCategories('schedule'),
      getCategories('routine'),
      getCategories('todo'),
    ]);
    set({
      scheduleCategories: schedule,
      routineCategories: routine,
      todoCategories: todo,
    });
  },

  addCategory: async (type, name, color) => {
    await insertCategory(type, name, color);
    const categories = await getCategories(type);
    if (type === 'schedule') {
      set({ scheduleCategories: categories });
    } else if (type === 'routine') {
      set({ routineCategories: categories });
    } else {
      set({ todoCategories: categories });
    }
  },

  editCategory: async (id, name, color, oldName, type) => {
    await updateCategory(id, name, color, oldName, type);
    const categories = await getCategories(type);
    if (type === 'schedule') {
      set({ scheduleCategories: categories });
    } else if (type === 'routine') {
      set({ routineCategories: categories });
    } else {
      set({ todoCategories: categories });
    }
  },

  removeCategory: async (id, name, type) => {
    await deleteCategory(id, name, type);
    const categories = await getCategories(type);
    if (type === 'schedule') {
      set({ scheduleCategories: categories });
    } else if (type === 'routine') {
      set({ routineCategories: categories });
    } else {
      set({ todoCategories: categories });
    }
  },

  moveCategory: async (id, direction, type) => {
    const list = await getCategories(type);
    const idx = list.findIndex((c) => c.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return;
    await swapCategoryOrder(list[idx].id, list[idx].sortOrder, list[swapIdx].id, list[swapIdx].sortOrder);
    const updated = await getCategories(type);
    if (type === 'schedule') {
      set({ scheduleCategories: updated });
    } else if (type === 'routine') {
      set({ routineCategories: updated });
    } else {
      set({ todoCategories: updated });
    }
  },

  reorderCategories: async (type, newOrder) => {
    // 드래그앤드롭 후 새 순서를 즉시 상태에 반영 (낙관적 업데이트)
    const reordered = newOrder.map((cat, idx) => ({ ...cat, sortOrder: idx }));
    if (type === 'schedule') set({ scheduleCategories: reordered });
    else if (type === 'routine') set({ routineCategories: reordered });
    else set({ todoCategories: reordered });

    // DB에 순서 일괄 저장
    const updates = newOrder.map((cat, idx) => ({ id: cat.id, sortOrder: idx }));
    await setCategoryOrder(updates);
  },
}));
