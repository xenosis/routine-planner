import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;

  /** 앱 시작 시 저장된 세션 복원 */
  initialize: () => Promise<void>;
  /** 이메일/비밀번호 로그인. 실패 시 에러 메시지 반환, 성공 시 null */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** 로그아웃 */
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, loading: false });

    // 세션 변경 시 자동 갱신 (토큰 만료 등)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null });
  },
}));
