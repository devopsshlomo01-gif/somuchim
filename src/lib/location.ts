import * as Location from 'expo-location';

export type Point = { lat: number; lng: number };

/**
 * Take one location sample (no tracking). Returns null if the user declined
 * permission or the device could not get a fix; callers continue without it.
 */
export async function sampleLocationOnce(): Promise<Point | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
    if (!pos) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function distanceLabel(m: number | null | undefined): string {
  if (m === null || m === undefined) return 'מיקום לא זמין';
  if (m < 1000) return `${m} מ׳`;
  return `${(m / 1000).toFixed(1)} ק״מ`;
}
