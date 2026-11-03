import keywords from './section-keywords.json';
import { normalizeTr } from './models';
import { matchPartSection, PartTerm } from './part-match';

const MODEL = keywords as unknown as Record<string, [number, number]>;

/**
 * Not metnine göre rapor bölümü önerir. Önce kullanıcının parça listesine bakar, parça geçmiyorsa
 * eski raporlardan çıkarılan köklere döner (scripts/build-section-keywords.mjs).
 */
export function suggestSection(text: string, parts: PartTerm[] = []): number | undefined {
  const normalized = normalizeTr(text);
  const fromPart = matchPartSection(normalized, parts);
  if (fromPart) return fromPart;
  const tokens = normalized.match(/[a-z0-9]{3,}/g) ?? [];
  const score = new Array<number>(9).fill(0);
  for (const stem of new Set(tokens.map((t) => t.slice(0, 5)))) {
    const hit = MODEL[stem];
    if (hit) score[hit[0]] += hit[1];
  }
  const max = Math.max(...score);
  return max >= 1 ? score.indexOf(max) : undefined;
}
