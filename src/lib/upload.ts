import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export type Picked = { uri: string; mime: string; ext: string; size: number | null; durationMs?: number | null };

export type PickResult = { ok: true; file: Picked } | { ok: false; reason: 'cancelled' | 'denied' | 'too_big' | 'too_long' | 'too_short' };

const extOf = (mime: string, fallback: string) => {
  const sub = mime.split('/')[1] ?? fallback;
  return sub === 'jpeg' ? 'jpg' : sub === 'quicktime' ? 'mov' : sub.replace(/[^a-z0-9]/g, '') || fallback;
};

/** Photo from camera or library. */
export async function pickPhoto(source: 'camera' | 'library', front = false): Promise<PickResult> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'denied' };
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: source === 'library',
    cameraType: front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return { ok: false, reason: 'cancelled' };
  const a = res.assets[0];
  const mime = a.mimeType ?? 'image/jpeg';
  return { ok: true, file: { uri: a.uri, mime, ext: extOf(mime, 'jpg'), size: a.fileSize ?? null } };
}

/** Intro video, 30–90 seconds, up to 100MB. */
export async function pickVideo(source: 'camera' | 'library'): Promise<PickResult> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'denied' };
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['videos'],
    videoMaxDuration: 90,
    quality: 0.7,
    cameraType: ImagePicker.CameraType.front,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return { ok: false, reason: 'cancelled' };
  const a = res.assets[0];
  if (a.fileSize && a.fileSize > MAX_VIDEO_BYTES) return { ok: false, reason: 'too_big' };
  if (a.duration && a.duration > 91000) return { ok: false, reason: 'too_long' };
  if (a.duration && a.duration < 29000) return { ok: false, reason: 'too_short' };
  const mime = a.mimeType ?? 'video/mp4';
  return { ok: true, file: { uri: a.uri, mime, ext: extOf(mime, 'mp4'), size: a.fileSize ?? null, durationMs: a.duration } };
}

/** PDF or image document (police clearance). */
export async function pickDocument(): Promise<PickResult> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return { ok: false, reason: 'cancelled' };
  const a = res.assets[0];
  if (a.size && a.size > MAX_DOC_BYTES) return { ok: false, reason: 'too_big' };
  const mime = a.mimeType ?? 'application/pdf';
  return { ok: true, file: { uri: a.uri, mime, ext: extOf(mime, 'pdf'), size: a.size ?? null } };
}

export const PICK_ERROR: Record<Exclude<PickResult, { ok: true }>['reason'], string> = {
  cancelled: '',
  denied: 'צריך לאשר גישה למצלמה או לתמונות בהגדרות הטלפון.',
  too_big: 'הקובץ גדול מדי.',
  too_long: 'הסרטון ארוך מ-90 שניות.',
  too_short: 'הסרטון קצר מ-30 שניות.',
};

/** Upload to `<bucket>/<uid>/<name>.<ext>` and return the storage path. */
export async function uploadFile(bucket: 'media' | 'documents', uid: string, name: string, f: Picked): Promise<string> {
  const path = `${uid}/${name}-${Date.now()}.${f.ext}`;
  const body = await new File(f.uri).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: f.mime, upsert: false });
  if (error) throw error;
  return path;
}
