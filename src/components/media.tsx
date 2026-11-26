import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Avatar, T } from '@/components/ui';
import { mediaUrl } from '@/lib/sitters';
import { useTheme } from '@/lib/theme';

/** Resolve a private storage path to a short-lived URL. */
export function useMediaUrl(path: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    mediaUrl(path).then((url) => alive && setResolved({ path, url }));
    return () => {
      alive = false;
    };
  }, [path]);
  return path && resolved?.path === path ? resolved.url : null;
}

export function Photo({ path, name, size = 56, color }: { path: string | null | undefined; name: string; size?: number; color?: string }) {
  const url = useMediaUrl(path);
  if (!url) return <Avatar name={name} size={size} color={color} />;
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      accessibilityLabel={name}
      transition={150}
    />
  );
}

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: '#000' }}
      nativeControls
      contentFit="contain"
    />
  );
}

/** Intro video from storage path, or a local file URI when `local` is set. */
export function IntroVideo({ path, local, emptyText }: { path?: string | null; local?: string | null; emptyText?: string }) {
  const t = useTheme();
  const remote = useMediaUrl(local ? null : path);
  const uri = local ?? remote;
  if (!uri) {
    return (
      <View
        style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <T variant="muted">{emptyText ?? 'עוד לא הועלה סרטון'}</T>
      </View>
    );
  }
  return <Player key={uri} uri={uri} />;
}
