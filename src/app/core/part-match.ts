/** Parça adıyla metin eşleştirme. Girdiler normalizeTr'den geçmiş olmalı; import içermez, ölçüm betiği de kullanır. */
export interface PartTerm {
  key: string;
  section: number;
}

const SHORT_SUFFIX = /^(ler|lar|leri|lari|nin|nun|si|su|ya|ye|da|de|yi|yu|i|u|a|e|in|un|deki|daki)?$/;

function wordMatches(partWord: string, word: string): boolean {
  // Kısa kelimede önek yetmez: "tik" tıkalıyı, "duş" düşüğü yakalamasın
  if (partWord.length <= 3) return word.startsWith(partWord) && SHORT_SUFFIX.test(word.slice(partWord.length));
  // Son harf yumuşayabilir: kapak -> kapağı
  return word.startsWith(partWord.slice(0, -1));
}

/** Metinde geçen en uzun parçanın bölümünü döner. */
export function matchPartSection(text: string, parts: PartTerm[]): number | undefined {
  const words = text.match(/[a-z0-9]+/g) ?? [];
  let best: PartTerm | undefined;
  for (const part of parts) {
    if (best && part.key.length <= best.key.length) continue;
    const partWords = part.key.split(/\s+/);
    for (let i = 0; i + partWords.length <= words.length; i++) {
      if (partWords.every((w, j) => wordMatches(w, words[i + j]))) {
        best = part;
        break;
      }
    }
  }
  return best?.section;
}
