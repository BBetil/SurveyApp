# Sörvey

Tekne ekspertizi için saha uygulaması (Angular PWA). Notlar ve fotoğraflar telefonda (IndexedDB) tutulur, sörvey zip olarak dışa aktarılır. Rapor üretimi sonraki aşama; girdisi zip içindeki `survey.json` (şema: `src/app/core/models.ts`).

## Geliştirme

- `npm start` — http://localhost:4200
- Android'de deneme: `npx ng serve --host 0.0.0.0`, telefondan `http://<PC-IP>:4200` (aynı Wi-Fi). İnternetsiz çalışma ve paylaşım menüsü HTTP'de çalışmaz.
- `npm run build` — `dist/sorvey/browser`



## Üretilen dosyalar

- `node scripts/build-section-keywords.mjs` — `sorvey-poc/phrases.js` dosyasından bölüm önerisi köklerini üretir. Bu dosya gerçek rapor cümleleri içerdiği için depoda yoktur.
- `node scripts/build-assets.mjs` — uygulama ikonlarını ve `src/app/shared/icons.ts`'i üretir.
