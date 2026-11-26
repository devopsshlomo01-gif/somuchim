# סמוכים

אפליקציה לאנדרואיד ולאייפון שמחברת בין הורים לבייביסיטרים מהשכונה.
נבנתה ב-Expo (React Native) עם Supabase בצד השרת.

## מה עובד באפליקציה
- כניסה בלי סיסמה, עם קוד חד-פעמי ב-SMS או במייל, והרשמה כהורה, בייביסיטר או שניהם
- חיפוש בייביסיטריות מאומתות עם סינונים, ופרופיל עם תמונה, סרטון היכרות, ביקורות והמלצות היכרות
- בקשת שמירה: ההורה שולח, הבייביסיטר מאשרת או דוחה, ואישור יוצר משמרת
- צ׳ק-אין וצ׳ק-אאוט: דגימת מיקום אחת בלחיצה ובדיקת מרחק מהבית (עד 300 מ׳ נחשב מאומת). אין מעקב רציף
- סיום משמרת: חישוב לפי הזמן בפועל (עיגול לרבע שעה, מינימום שעה), תשלום בביט בקישור או במספר, ואישור קבלה מצד הבייביסיטר
- ביקורת אחרי תשלום, בארבע קטגוריות, והמלצות היכרות ממי שמכיר את הבייביסיטר
- העלאת תמונה וסרטון (30–90 שניות) לבייביסיטר ולמשפחה. תמונות המשפחה גלויות רק לבייביסיטר שקיבלה בקשה ממנה
- אימות זהות (שם, ת״ז עם בדיקת ספרת ביקורת, תאריך לידה, צילום תעודה וסלפי) ואישור משטרה
- לשונית ניהול לצוות: בדיקת מסמכים, אישור או דחייה עם הערה, ותוקף אישור משטרה ל-12 חודשים
- דוחות חודשיים ושנתיים להורים, והכנסות ופתוח לגבייה לבייביסיטר
- מסך אודות עם תיבת הודעות, שנשלחות למייל של המפתח
- כל שינוי סטטוס נעשה בפונקציות בשרת, והרשאות מסד הנתונים חוסמות גישה לנתונים של אחרים

## עוד לא קיים
- התראות פוש (דורש פרויקט Firebase)
- שיחה קולית עם קוד (דורש Twilio)
- דיווח על בעיה מצד משתמשים

## הגדרה ראשונית (פעם אחת)

### 1. Supabase
1. פותחים פרויקט ב-[supabase.com](https://supabase.com), באזור **Frankfurt (eu-central-1)**.
2. **SQL Editor**: מדביקים את התוכן של `supabase/migrations/20261125000000_init.sql` ולוחצים Run.
3. **Authentication → Sign In / Providers**:
   - **Phone**: מפעילים, בוחרים ב-**Twilio Verify** וממלאים Account SID, Auth Token ו-Verify Service SID מחשבון Twilio.
   - **Email**: מפעילים.
4. **Authentication → Email Templates → Magic Link**: מוסיפים לתבנית את הקוד `{{ .Token }}`, כדי שבמייל יופיע קוד בן 6 ספרות ולא רק קישור.
5. **Project Settings → API**: מעתיקים את ה-Project URL ואת ה-anon key לקובץ `.env` (לפי `.env.example`).

### 2. הודעות למייל שלך (תיבת "שליחת הודעה למפתח")
1. פותחים חשבון ב-[resend.com](https://resend.com) ומאמתים דומיין שולח, או משתמשים בכתובת הבדיקה שלהם.
2. מעלים את הפונקציה: `npx supabase functions deploy notify-feedback --no-verify-jwt`
3. **Edge Functions → Secrets**: מגדירים `RESEND_API_KEY`, `DEV_EMAIL` (המייל שלך), `MAIL_FROM` ו-`WEBHOOK_SECRET` (מחרוזת אקראית).
4. שומרים את אותה מחרוזת אקראית ב-Vault ומריצים את `supabase/migrations/20261126000000_feedback_email_trigger.sql` (ההוראה בראש הקובץ).

### 3. להפוך את עצמך לצוות
אחרי שנרשמת באפליקציה, מריצים ב-SQL Editor:
```sql
update profiles set is_staff = true where full_name = 'השם שלך';
```
איש צוות רואה לשונית **ניהול** באפליקציה: אישור זהויות ואישורי משטרה, וההודעות שהתקבלו.

## הרצה בטלפון שלך (פיתוח)
```bash
npm install
cp .env.example .env   # וממלאים
npx expo start
```
מתקינים בטלפון את **Expo Go** מחנות האפליקציות וסורקים את קוד ה-QR. בפתיחה הראשונה האפליקציה עוברת לימין-לשמאל, וייתכן שצריך לסגור ולפתוח אותה פעם אחת.

## בניית APK לבודקים באנדרואיד
```bash
npm install -g eas-cli
eas login
eas init                 # מקשר את הפרויקט לחשבון Expo שלך
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://... --environment preview
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value ... --environment preview
eas build -p android --profile preview
```
בסוף הבנייה מתקבל קישור להורדת APK, שאפשר לשלוח לבודקים.

לפרסום ב-Google Play: `eas build -p android --profile production` ואחר כך `eas submit -p android`. הקובץ נשלח למסלול הבדיקה הפנימי (internal) כטיוטה.

## אייפון
אותו קוד. `eas build -p ios --profile preview` דורש חשבון Apple Developer (99$ לשנה). לא צריך מחשב Mac.

## מבנה הפרויקט
```
src/app/                 המסכים (expo-router)
  sign-in.tsx            כניסה עם קוד
  welcome.tsx            השלמת הרשמה
  (tabs)/                חיפוש, משמרות, פרופיל, אודות
  sitter/[id].tsx        פרופיל בייביסיטר
src/components/ui.tsx    רכיבי עיצוב משותפים
src/lib/                 Supabase, התחברות, ערכת צבעים, בדיקות קלט
supabase/migrations/     סכמת מסד הנתונים והרשאות
supabase/functions/      פונקציות שרת (שליחת הודעות למייל)
```
