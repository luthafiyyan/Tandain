/**
 * test-aspect-ratio.js
 * Memverifikasi unifikasi preview dan export untuk dokumen Landscape, Portrait, dan Resolusi Berbeda.
 */

import assert from 'node:assert';
import { renderWatermark, DEFAULT_WATERMARK_SETTINGS } from '../src/core/watermark.js';

function createCountingCtx() {
  let count = 0;
  return {
    ctx: {
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      fillText: () => { count++; },
      strokeText: () => {},
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      textAlign: '',
      textBaseline: ''
    },
    getCount: () => count
  };
}

console.log('--- PENGUJIAN ORIENTASI & KONSISTENSI PREVIEW VS EXPORT ---');

const settings = {
  ...DEFAULT_WATERMARK_SETTINGS,
  text: 'VERIFIKASI TANDAIN',
  fontSizePercent: 3.5,
  spacingXPercent: 25.0,
  spacingYPercent: 15.0,
  jitterPercent: 0
};

// 1. Uji Landscape (KTP / KK Landscape): Preview 600x378 vs Export 2400x1512 (Skala 4x)
{
  const p = createCountingCtx();
  renderWatermark(p.ctx, 600, 378, settings);

  const e = createCountingCtx();
  renderWatermark(e.ctx, 2400, 1512, settings);

  assert.strictEqual(p.getCount(), e.getCount(), 'Kepadatan tile preview landscape harus persis sama dengan export landscape');
  console.log(`✅ Landscape Document: ${p.getCount()} tiles (Preview 600x378) == ${e.getCount()} tiles (Export 2400x1512)`);
}

// 2. Uji Portrait (Ijazah / Pas Foto Portrait): Preview 400x600 vs Export 2000x3000 (Skala 5x)
{
  const p = createCountingCtx();
  renderWatermark(p.ctx, 400, 600, settings);

  const e = createCountingCtx();
  renderWatermark(e.ctx, 2000, 3000, settings);

  assert.strictEqual(p.getCount(), e.getCount(), 'Kepadatan tile preview portrait harus persis sama dengan export portrait');
  console.log(`✅ Portrait Document: ${p.getCount()} tiles (Preview 400x600) == ${e.getCount()} tiles (Export 2000x3000)`);
}

// 3. Uji Ukuran Font Relatif
{
  const testWidths = [320, 768, 1200, 3840];
  for (const w of testWidths) {
    const c = createCountingCtx();
    renderWatermark(c.ctx, w, Math.round(w * 0.7), settings);
    const expectedFontPx = Math.max(8, (settings.fontSizePercent / 100) * w);
    assert(c.ctx.font.includes(`${expectedFontPx}px`), `Ukuran font pada lebar ${w}px harus ${expectedFontPx}px`);
  }
  console.log('✅ Skalabilitas Ukuran Font: Terverifikasi linear dan persis proporsional terhadap lebar di seluruh resolusi.');
}

console.log('\nSeluruh pengujian orientasi dan preview vs export lolos!\n');
