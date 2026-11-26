import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, View } from 'react-native';

import { IntroVideo, Photo } from '@/components/media';
import { Button, Card, Row, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { PICK_ERROR, pickPhoto, pickVideo, uploadFile, type PickResult } from '@/lib/upload';

type Table = 'sitter_profiles' | 'families';

function chooseSource(title: string): Promise<'camera' | 'library' | null> {
  return new Promise((resolve) => {
    const opts = ['צילום עכשיו', 'בחירה מהגלריה', 'ביטול'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ title, options: opts, cancelButtonIndex: 2 }, (i) =>
        resolve(i === 0 ? 'camera' : i === 1 ? 'library' : null),
      );
    } else {
      Alert.alert(title, undefined, [
        { text: opts[2], style: 'cancel', onPress: () => resolve(null) },
        { text: opts[1], onPress: () => resolve('library') },
        { text: opts[0], onPress: () => resolve('camera') },
      ]);
    }
  });
}

/** Photo and intro video for the current user's sitter or family profile. */
export function MediaEditor({
  table,
  uid,
  name,
  photoPath,
  videoPath,
  videoRequired,
  onSaved,
}: {
  table: Table;
  uid: string;
  name: string;
  photoPath: string | null;
  videoPath: string | null;
  videoRequired: boolean;
  onSaved: (patch: { photo_path?: string; video_path?: string }) => void;
}) {
  const [busy, setBusy] = useState<'photo' | 'video' | null>(null);

  async function handle(kind: 'photo' | 'video') {
    const src = await chooseSource(kind === 'photo' ? 'תמונת פרופיל' : 'סרטון היכרות (30–90 שניות)');
    if (!src) return;
    const res: PickResult = kind === 'photo' ? await pickPhoto(src, src === 'camera') : await pickVideo(src);
    if (!res.ok) {
      if (PICK_ERROR[res.reason]) Alert.alert(PICK_ERROR[res.reason]);
      return;
    }
    setBusy(kind);
    try {
      // Family files carry a "family-" prefix; storage rules only show them to
      // sitters the family has sent a request to (see storage policies).
      const path = await uploadFile('media', uid, table === 'families' ? `family-${kind}` : kind, res.file);
      const col = kind === 'photo' ? 'photo_path' : 'video_path';
      const { error } = await supabase.from(table).update({ [col]: path }).eq('id', uid);
      if (error) throw error;
      onSaved({ [col]: path });
    } catch {
      Alert.alert('ההעלאה נכשלה', 'בדקו את החיבור לאינטרנט ונסו שוב.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <T variant="h3">{table === 'families' ? 'התמונה והסרטון שלנו' : 'התמונה והסרטון שלי'}</T>
      <Row>
        <Photo path={photoPath} name={name} size={76} />
        <View style={{ flex: 1 }}>
          <Button kind="secondary" title={photoPath ? 'החלפת תמונה' : 'העלאת תמונה'} onPress={() => handle('photo')} loading={busy === 'photo'} />
        </View>
      </Row>
      <IntroVideo path={videoPath} />
      <Button
        kind="secondary"
        title={`${videoPath ? 'החלפת סרטון' : 'העלאת סרטון'} (30–90 שניות${videoRequired ? ', חובה' : ', רשות'})`}
        onPress={() => handle('video')}
        loading={busy === 'video'}
      />
      {table === 'families' ? (
        <T variant="muted">הבייביסיטר רואה את התמונה והסרטון רק אחרי ששלחתם לה בקשה.</T>
      ) : (
        <T variant="muted">ספרי מי את, מה הניסיון שלך ומה את אוהבת לעשות עם ילדים.</T>
      )}
    </Card>
  );
}
