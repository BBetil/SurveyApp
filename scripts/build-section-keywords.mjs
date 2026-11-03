// Eski rapor cümlelerinden kök -> bölüm ağırlıkları üretir.
// Kullanım: node scripts/build-section-keywords.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { matchPartSection } from '../src/app/core/part-match.ts';

const raw = readFileSync('sorvey-poc/phrases.js', 'utf8');
const phrases = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));

const STOP = new Set(['tavs', 'olun', 'gorul', 'mevcu', 'edilm', 'ilgil', 'sezon', 'oncesi', 'once', 'bakim',
  'sorve', 'takri', 'degis', 'yapil', 'kusur', 'gider', 'gozle', 'degerl', 'halde', 'bulun', 'taraf', 'uzeri',
  'onari', 'kontr', 'temiz', 'hasar', 'iskel', 'sanca', 'calis', 'tekne', 'olara', 'minor', 'emare', 'emar',
  'ana', 'ile', 'bir', 'ait', 'icin', 'bas', 'kic', 'kirli', 'korozy', 'koroz', 'nizam', 'gerce', 'planl', 'seyir', 'devir', 'tesli']);

export function normalize(s) {
  return s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
}
export function stems(text) {
  return [...new Set((normalize(text).match(/[a-z0-9]{3,}/g) ?? []).map((t) => t.slice(0, 5)))].filter((t) => !STOP.has(t));
}

// Rapor sayısı az olduğu için alan bilgisiyle eklenen kesin kökler
const EXTRA = { 1: ['karin', 'nem', 'ozmos', 'trim', 'flap', 'tutya', 'kinis', 'borda', 'jelko', 'rubra', 'lumbo'],
  2: ['pervan', 'dumen', 'yeke', 'saft', 'klere', 'brake', 'kovan', 'pod', 'ips'],
  3: ['zinci', 'irgat', 'capst', 'demir', 'stope', 'minde', 'bimin', 'vardav', 'varda', 'kupes', 'tik', 'sika', 'flybr', 'fly', 'havuz', 'platf', 'passa', 'hardt', 'barbe'],
  4: ['kamar', 'salon', 'mutfa', 'dolap', 'yatak', 'dusa', 'banyo', 'tuval', 'perde', 'kapak', 'mobil', 'kapi'],
  5: ['makin', 'jener', 'motor', 'egzoz', 'sinti', 'webas', 'filtr', 'yakit', 'akiska', 'hortu', 'turbo'],
  6: ['pis', 'gri', 'tatli', 'hidro', 'boyle', 'sifon'],
  7: ['korna', 'mfd', 'ais', 'vhf', 'radar', 'gps', 'otopi', 'akü', 'aku', 'switc', 'sigor', 'panel', 'kablo', 'proje', 'searc', 'uydu', 'muzik', 'kamer', 'aydin', 'lamba'],
  8: ['yangi', 'sondu', 'yelek', 'simid', 'cansa', 'sertif', 'serti', 'cakar', 'epirb', 'filik', 'ruhsa'] };

function train(items) {
  const counts = {};
  for (const { s, t } of items) for (const st of stems(t)) (counts[st] ??= Array(8).fill(0))[s]++;
  const out = {};
  for (const [st, c] of Object.entries(counts)) {
    const total = c.reduce((a, b) => a + b, 0);
    if (total < 2) continue;
    const best = c.indexOf(Math.max(...c));
    const share = c[best] / total;
    if (share >= 0.6) out[st] = [best + 1, Math.round(share * Math.log2(total + 1) * 100) / 100];
  }
  for (const [sec, list] of Object.entries(EXTRA)) for (const k of list) out[k.slice(0, 5)] = [+sec, 3];
  return out;
}
function predict(model, text) {
  const score = Array(9).fill(0);
  for (const st of stems(text)) if (model[st]) score[model[st][0]] += model[st][1];
  const max = Math.max(...score);
  return max >= 1 ? score.indexOf(max) : null;
}

// Her raporu dışarıda bırakarak doğruluk ölç
let hit = 0, none = 0, n = 0;
for (const src of new Set(phrases.map((p) => p.src))) {
  const model = train(phrases.filter((p) => p.src !== src));
  for (const p of phrases.filter((x) => x.src === src)) {
    const got = predict(model, p.t.split('.')[0]);
    n++;
    if (got === null) none++;
    else if (got === p.s + 1) hit++;
  }
}
console.log(`dışarıda bırakma: ${n} cümle, doğru ${hit} (${Math.round((hit / n) * 100)}%), öneri yok ${none}, yanlış ${n - hit - none}`);

// Parça listesiyle birlikte. Liste aynı raporlardan elle çıkarıldığı için bu oran iyimserdir.
const partTerms = Object.entries(JSON.parse(readFileSync('src/app/core/default-parts.json', 'utf8')))
  .flatMap(([section, names]) => names.map((name) => ({ key: normalize(name), section: +section })));
let partHit = 0, partNone = 0, partWrong = [];
for (const src of new Set(phrases.map((p) => p.src))) {
  const m = train(phrases.filter((p) => p.src !== src));
  for (const p of phrases.filter((x) => x.src === src)) {
    const text = p.t.split('.')[0];
    const got = matchPartSection(normalize(text), partTerms) ?? predict(m, text);
    if (got === null) partNone++;
    else if (got === p.s + 1) partHit++;
    else partWrong.push(`${p.s + 1}->${got} ${text.slice(0, 60)}`);
  }
}
console.log(`parça listesiyle: doğru ${partHit} (${Math.round((partHit / n) * 100)}%), öneri yok ${partNone}, yanlış ${partWrong.length}`);
if (process.argv.includes('--yanlislar')) console.log(partWrong.join(String.fromCharCode(10)));

const model = train(phrases);
writeFileSync('src/app/core/section-keywords.json', JSON.stringify(model));
console.log(Object.keys(model).length, 'kök yazıldı');
for (const t of ['Zincir stoperinin dili eksik', 'Yangın tüpü manometre yüksek', 'Sancak jeneratör egzoz hortumu kesik', 'Baş kamara TV si çalışmıyor', 'Sancak flybridge merdiven kapağı gaz pistonu demonte', 'Korna çalıştırılamadı', 'Şaft kovanlarında boşluk', 'Gri su pompası geç devreye giriyor'])
  console.log(' ', t, '->', predict(model, t));
