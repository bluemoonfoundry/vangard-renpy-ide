import type { SerializedSceneComposition, SerializedImageMapComposition } from '@/types';

export function isSerializedSceneComposition(obj: unknown): obj is SerializedSceneComposition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'sprites' in obj &&
    Array.isArray((obj as Record<string, unknown>).sprites)
  );
}

export function isSerializedImageMapComposition(obj: unknown): obj is SerializedImageMapComposition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'screenName' in obj &&
    typeof (obj as Record<string, unknown>).screenName === 'string' &&
    'hotspots' in obj &&
    Array.isArray((obj as Record<string, unknown>).hotspots)
  );
}
