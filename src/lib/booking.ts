export type RequestCard = {
  id: string;
  parent_id: string;
  sitter_id: string;
  location: 'parent_home' | 'sitter_home';
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;
  kids: string;
  notes: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  parent_name: string;
  sitter_name: string;
  family_about: string | null;
  family_area: string | null;
  hourly_rate: number | null;
};

export type ShiftCard = {
  id: string;
  parent_id: string;
  sitter_id: string;
  starts_at: string;
  ends_at: string;
  hourly_rate: number;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_verified: boolean | null;
  check_out_verified: boolean | null;
  check_in_distance_m: number | null;
  check_out_distance_m: number | null;
  amount: number;
  location: 'parent_home' | 'sitter_home';
  kids: string | null;
  notes: string | null;
  parent_name: string;
  sitter_name: string;
  bit_phone: string | null;
  bit_link: string | null;
  reviewed: boolean;
};

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/** Today's date in Israel as YYYY-MM-DD. */
export function israelToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayLabel(iso: string): { day: string; date: string } {
  const d = new Date(iso + 'T12:00:00Z');
  return { day: DAY_NAMES[d.getUTCDay()], date: `${d.getUTCDate()}.${d.getUTCMonth() + 1}` };
}

export const hhmm = (t: string) => t.slice(0, 5);

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(n: number): string {
  const v = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** Duration in minutes; an end time at or before the start means past midnight. */
export function durationMinutes(start: string, end: string): number {
  let d = toMinutes(end) - toMinutes(start);
  if (d <= 0) d += 1440;
  return d;
}

export function hoursLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}:${String(m).padStart(2, '0')} ש׳` : `${h} ש׳`;
}

export const REQUEST_STATUS: Record<RequestCard['status'], [string, 'honey' | 'ok' | 'plain' | 'warn']> = {
  pending: ['ממתינה לתשובה', 'honey'],
  accepted: ['אושרה', 'ok'],
  declined: ['נדחתה', 'plain'],
  cancelled: ['בוטלה', 'plain'],
};

export const SHIFT_STATUS: Record<string, [string, 'acc' | 'ok' | 'warn' | 'honey' | 'plain']> = {
  scheduled: ['מתוכננת', 'acc'],
  in_progress: ['בפעילות', 'ok'],
  unpaid: ['ממתין לתשלום', 'warn'],
  reported: ['ההורה דיווח תשלום', 'honey'],
  confirmed: ['שולם ואושר', 'ok'],
  cancelled: ['בוטלה', 'plain'],
};
