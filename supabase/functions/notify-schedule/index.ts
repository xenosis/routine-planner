import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Schedule {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  category?: string;
}

interface RequestBody {
  schedule: Schedule;
  sender_id: string;
  sender_name?: string;
  action: 'add' | 'update' | 'delete';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { schedule, sender_id, sender_name, action }: RequestBody = await req.json();
    console.log('[notify-schedule] 요청:', { sender_id, action, title: schedule.title });

    // 발신자 제외한 모든 유저의 push token 조회
    const { data: tokens, error } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .neq('user_id', sender_id);

    if (error) {
      console.error('[notify-schedule] 토큰 조회 실패:', error);
      throw error;
    }
    console.log('[notify-schedule] 조회된 토큰 수:', tokens?.length ?? 0);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_recipients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pushTokens = tokens.map((t: { push_token: string }) => t.push_token);
    const displayName = sender_name || '누군가';
    const dateStr = schedule.date.replace(/-/g, '.');
    const timeStr = schedule.startTime ? ` ${schedule.startTime}` : '';

    const titleMap = {
      add: `📅 ${displayName}님이 일정을 추가했어요`,
      update: `✏️ ${displayName}님이 일정을 수정했어요`,
      delete: `🗑️ ${displayName}님이 일정을 삭제했어요`,
    };

    const messages = pushTokens.map((token) => ({
      to: token,
      title: titleMap[action] ?? titleMap.add,
      body: `${schedule.title} · ${dateStr}${timeStr}`,
      data: { scheduleId: schedule.id, date: schedule.date },
      sound: 'default',
    }));

    console.log('[notify-schedule] Expo Push 전송:', messages.map((m) => ({ to: m.to, title: m.title })));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('[notify-schedule] Expo Push 결과:', JSON.stringify(result));

    return new Response(JSON.stringify({ sent: messages.length, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[notify-schedule] 오류:', String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
