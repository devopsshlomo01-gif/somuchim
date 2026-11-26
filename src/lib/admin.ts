export type QueueItem = {
  id: string;
  user_id: string;
  kind: 'identity' | 'police';
  full_name: string;
  full_name_on_id: string | null;
  id_last4: string | null;
  birth_date: string | null;
  files: string[];
  status: 'pending' | 'approved' | 'rejected';
  staff_note: string | null;
  created_at: string;
  photo_path: string | null;
  video_path: string | null;
  hourly_rate: number | null;
  area: string | null;
};
