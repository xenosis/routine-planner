const PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EF4444'];

export const NAME_TAG_DEFAULT_COLOR = '#94A3B8';

/** 이름 문자열을 해시해서 팔레트 색상을 반환한다. 같은 이름은 항상 같은 색. */
export function getNameColor(name: string): string {
  if (!name) return NAME_TAG_DEFAULT_COLOR;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
