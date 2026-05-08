import { create } from 'zustand';
import {
  type Category,
  getCategories,
  insertCategory,
  updateCategory,
  deleteCategory,
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
}));
