import { supabase } from './supabase';

export type SitterCard = {
  id: string;
  full_name: string;
  bio: string;
  area: string;
  age: number | null;
  hourly_rate: number | null;
  hosts_at_home: boolean;
  photo_path: string | null;
  video_path: string | null;
  id_verified: boolean;
  police_ok: boolean;
  rating: number;
  review_count: number;
  vouch_count: number;
};

export const nis = (n: number) => '₪' + n.toLocaleString('he-IL');

/** Short-lived signed URL for a file in the private "media" bucket. */
export async function mediaUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from('media').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

const PALETTE = ['#2F6F5E', '#7A4E8C', '#B5562F', '#35608F', '#8A5A2B', '#3F7D7A'];
export function colorFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
