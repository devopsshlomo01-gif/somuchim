/** Israeli phone helpers. Accepts 050-1234567, 0501234567, +972501234567. */
export function digits(p: string): string {
  let d = p.replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  return d;
}

export const isIsraeliMobile = (p: string) => /^05\d{8}$/.test(digits(p));

/** E.164 form required by Supabase Auth: 0501234567 -> +972501234567 */
export const toE164 = (p: string) => '+972' + digits(p).slice(1);

export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Israeli ID check digit (Luhn variant). */
export function isValidIsraeliId(raw: string): boolean {
  const id = raw.trim();
  if (!/^\d{5,9}$/.test(id)) return false;
  const p = id.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(p[i]) * ((i % 2) + 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

export const fullNameOk = (n: string) => n.trim().split(/\s+/).length >= 2;
