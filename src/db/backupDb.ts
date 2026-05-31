import { getDb } from './database';
import { supabase } from '../lib/supabase';

interface BackupData {
  version: number;
  backedUpAt: string;
  routines: Record<string, unknown>[];
  routine_completions: Record<string, unknown>[];
  todos: Record<string, unknown>[];
  categories: Record<string, unknown>[];
}

export async function backupToSupabase(userId: string): Promise<void> {
  const db = await getDb();

  const [routines, completions, todos, categories] = await Promise.all([
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM routines'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM routine_completions'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM todos'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM categories'),
  ]);

  const backupData: BackupData = {
    version: 1,
    backedUpAt: new Date().toISOString(),
    routines,
    routine_completions: completions,
    todos,
    categories,
  };

  const { error } = await supabase.from('user_backups').upsert({
    user_id: userId,
    backup_data: backupData,
    backed_up_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
}

export async function restoreFromSupabase(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_backups')
    .select('backup_data')
    .eq('user_id', userId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('백업 데이터가 없습니다.');

  const backup = data.backup_data as BackupData;
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM routine_completions');
    await db.runAsync('DELETE FROM routines');
    await db.runAsync('DELETE FROM todos');
    await db.runAsync('DELETE FROM categories');

    for (const cat of backup.categories ?? []) {
      await db.runAsync(
        'INSERT OR IGNORE INTO categories (id, type, name, color, isDefault, sortOrder) VALUES (?, ?, ?, ?, ?, ?)',
        [cat.id as string, cat.type as string, cat.name as string, cat.color as string, cat.isDefault as number, cat.sortOrder as number],
      );
    }

    for (const r of backup.routines ?? []) {
      await db.runAsync(
        'INSERT OR IGNORE INTO routines (id, title, category, color, targetMinutes, frequency, weekdays, weekly_count, alarm, alarmTime, streak, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [r.id as string, r.title as string, r.category as string, r.color as string, (r.targetMinutes ?? null) as number | null, r.frequency as string, r.weekdays as string | null, r.weekly_count as number | null, r.alarm as number, r.alarmTime as string | null, r.streak as number, r.createdAt as string],
      );
    }

    for (const t of backup.todos ?? []) {
      await db.runAsync(
        'INSERT OR IGNORE INTO todos (id, title, deadlineDate, deadlineTime, category, color, memo, alarm, alarmTimes, completed, completedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [t.id as string, t.title as string, t.deadlineDate as string, t.deadlineTime as string, t.category as string, t.color as string, t.memo as string | null, t.alarm as number, t.alarmTimes as string | null, t.completed as number, t.completedAt as string | null, t.createdAt as string],
      );
    }

    for (const c of backup.routine_completions ?? []) {
      await db.runAsync(
        'INSERT OR IGNORE INTO routine_completions (id, routineId, date) VALUES (?, ?, ?)',
        [c.id as string, c.routineId as string, c.date as string],
      );
    }
  });
}

export async function getLastBackupTime(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_backups')
    .select('backed_up_at')
    .eq('user_id', userId)
    .single();

  return data?.backed_up_at ?? null;
}
