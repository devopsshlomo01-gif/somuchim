// Emails each new message from the app's "contact the developer" box.
//
// Triggered on INSERT into public.feedback_messages by a pg_net trigger
// (supabase/migrations/20261126000000_feedback_email_trigger.sql).
// The developer's address lives only in the DEV_EMAIL secret on the server, so it
// never ships inside the app.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   API key from resend.com
//   DEV_EMAIL        where messages are delivered
//   MAIL_FROM        sender; "Somuchim <onboarding@resend.dev>" works without a domain
//                    but only delivers to the Resend account owner's address
//   WEBHOOK_SECRET   random string; the same value is stored in Vault as notify_feedback_secret
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Msg = {
  id: string;
  user_id: string;
  kind: string;
  rating: number | null;
  body: string;
  reply_to: string | null;
  role: string | null;
  app_version: string | null;
  created_at: string;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json();
  if (payload?.type !== 'INSERT' || payload?.table !== 'feedback_messages') {
    return new Response('ignored', { status: 200 });
  }
  const m = payload.record as Msg;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: profile } = await admin.from('profiles').select('full_name').eq('id', m.user_id).maybeSingle();
  const sender = profile?.full_name ?? 'משתמש/ת';
  const role = m.role === 'sitter' ? 'בייביסיטר' : 'הורה';
  const stars = m.rating ? '★'.repeat(m.rating) + ` (${m.rating}/5)` : '—';

  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">
  <h2 style="margin:0 0 8px">הודעה חדשה מסמוכים: ${esc(m.kind)}</h2>
  <p style="white-space:pre-wrap;border-right:3px solid #2F6F5E;padding-right:10px">${esc(m.body)}</p>
  <table style="font-size:14px;color:#444">
    <tr><td>מאת:</td><td>${esc(sender)} (${role})</td></tr>
    <tr><td>דירוג:</td><td>${stars}</td></tr>
    <tr><td>לחזרה:</td><td>${m.reply_to ? esc(m.reply_to) : '—'}</td></tr>
    <tr><td>גרסה:</td><td>${esc(m.app_version ?? '')}</td></tr>
  </table></div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM'),
      to: [Deno.env.get('DEV_EMAIL')],
      subject: `סמוכים – ${m.kind}: ${m.body.slice(0, 40)}`,
      html,
      ...(m.reply_to && m.reply_to.includes('@') ? { reply_to: m.reply_to } : {}),
    }),
  });

  if (!res.ok) {
    console.error('resend failed', res.status, await res.text());
    return new Response('email failed', { status: 502 });
  }
  await admin.from('feedback_messages').update({ emailed_at: new Date().toISOString() }).eq('id', m.id);
  return new Response('ok', { status: 200 });
});
