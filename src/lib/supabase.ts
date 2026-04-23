import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase Dashboard > Settings > API 에서 확인
const SUPABASE_URL = 'https://mctuibrbuhydsygbmyyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdHVpYnJidWh5ZHN5Z2JteXl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NzcxNTAsImV4cCI6MjA5MjE1MzE1MH0.Y3pF__U2k-qVUlZk_wZwRDKR7-YAr95q4CDZww4blR8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
