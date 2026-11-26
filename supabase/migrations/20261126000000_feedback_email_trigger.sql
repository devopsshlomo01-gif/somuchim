-- Email the developer when a new message arrives from the app's contact box.
-- Calls the notify-feedback Edge Function via pg_net right after each insert.
--
-- Before running, store the function's shared secret in Vault (once):
--   select vault.create_secret('<same value as the WEBHOOK_SECRET function secret>', 'notify_feedback_secret');

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_feedback_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_feedback_secret' limit 1;
  if secret is null then
    return new; -- not configured yet; the message is still saved
  end if;
  perform net.http_post(
    url := 'https://kpxqhpkhtrkkrdqfxbpk.supabase.co/functions/v1/notify-feedback',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('type', 'INSERT', 'table', 'feedback_messages', 'record', to_jsonb(new))
  );
  return new;
end $$;

revoke all on function public.notify_feedback_email() from public, anon, authenticated;

drop trigger if exists feedback_email on public.feedback_messages;
create trigger feedback_email after insert on public.feedback_messages
  for each row execute function public.notify_feedback_email();
