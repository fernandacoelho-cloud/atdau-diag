// tests/sweep-blockmaps.spec.js
// VARREDURA PESADA: para CADA botão "🗺️ Ver no mapa" (lente) dos blocos de levantamento, dirige a UI
// como o usuário (aba, módulo, subaba, acordeão), troca a lente do mapa único do diagnóstico e
// desenha um polígono nele. 2026-10: os 27 mini-mapas inline viraram lentes de um mapa só.
// Fora do `npm test` normal — rodar com `npm run test:sweep` (ex.: antes de release).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Desenho de polígono funciona em todas as lentes do mapa do diagnóstico', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const clickFb = async (loc) => {
    try { await loc.click({ timeout: 4000 }); }
    catch { await loc.evaluate(el => el.click()); }
  };

  const lentes = await page.evaluate(() =>
    [...document.querySelectorAll('.lente-btn')].map((b, i) => ({
      i, tema: b.dataset.lente,
      titulo: b.closest('.block')?.querySelector('.block-title')?.textContent?.trim() || '?',
      panel: (b.closest('.panel') || {}).id || null,
      modules: (b.closest('.module-block') || { dataset: {} }).dataset.modules || null,
      subId: (b.closest('.subpanel') || {}).id || null,
    }))
  );
  expect(lentes.length).toBe(27);

  const falhas = [];
  for (const t of lentes) {
    const m = /^panel-(\d+)$/.exec(t.panel || '');
    if (!m) { falhas.push(`${t.titulo}: fora de um panel-N (${t.panel})`); continue; }
    try {
      await page.evaluate(n => document.querySelector('#nav-' + n)?.click(), m[1]);
      await page.waitForTimeout(500);
      if (t.modules) { await page.evaluate(id => setModule(id), t.modules.split(' ')[0]); await page.waitForTimeout(300); }
      if (t.subId) {
        const tabId = t.subId.replace(/^sp-\d+-/, '');
        await page.evaluate(tabId => { [...document.querySelectorAll('.subtab')].find(b => (b.getAttribute('onclick') || '').includes(`'${tabId}'`))?.click(); }, tabId);
        await page.waitForTimeout(300);
      }
      await page.evaluate(i => {   // acordeões de categoria fechados escondem o botão
        let el = document.querySelectorAll('.lente-btn')[i];
        while (el && el !== document.body) {
          if (el.classList && el.classList.contains('cat-group') && !el.classList.contains('cat-open')) el.querySelector(':scope > .cat-header')?.click();
          el = el.parentElement;
        }
      }, t.i);
      const btn = page.locator('.lente-btn').nth(t.i);
      try { await btn.scrollIntoViewIfNeeded({ timeout: 4000 }); } catch { await btn.evaluate(el => el.scrollIntoView({ block: 'center' })); }
      // desliga "seguir a rolagem" para a varredura não trocar de lente sozinha
      await page.evaluate(() => { const c = document.getElementById('lente-seguir'); if (c && c.checked) { c.checked = false; lenteSeguir(false); } });
      await clickFb(btn);

      // a lente certa no mapa único, com a barra de desenho do tema
      await page.waitForFunction(tema => {
        const w = document.getElementById('lente-wrap');
        return w && w.dataset.theme === tema && w.dataset.ready === '1' && w.querySelector('.block-map-draw-ctrl .bm-draw-btn[data-geom="polygon"]');
      }, t.tema, { timeout: 25000 });
      await page.waitForTimeout(400);
      const wrap = page.locator('#lente-wrap');
      const lid = await wrap.evaluate(w => w.querySelector('.bm-layer-select').value);
      const antes = await page.evaluate(l => (_mlFeatures[l] || []).length, lid);

      await clickFb(wrap.locator('.bm-draw-btn[data-geom="polygon"]'));
      const canvas = wrap.locator('.block-map canvas').first();
      const box = await canvas.boundingBox();
      if (!box || box.width < 50) { falhas.push(`${t.titulo}: canvas invisível (${JSON.stringify(box)})`); continue; }
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.click(cx - 55, cy + 35);
      await page.mouse.click(cx + 55, cy + 35);
      await page.mouse.click(cx, cy - 45);
      await page.mouse.dblclick(cx, cy - 45);
      await page.waitForFunction(({ lid, antes }) =>
        (_mlFeatures[lid] || []).length > antes && _mlFeatures[lid][_mlFeatures[lid].length - 1].geom.type === 'Polygon',
        { lid, antes }, { timeout: 8000 });
      console.log(`  ok ${t.titulo} (lente ${t.tema}, camada ${lid})`);
      const pular = page.locator('#ml-vinculo-modal button', { hasText: 'Pular' });
      if (await pular.count()) await pular.click();
      await page.waitForFunction(() => !document.getElementById('ml-vinculo-modal'), null, { timeout: 3000 });
    } catch (e) {
      falhas.push(`${t.titulo}: ${e.message.split('\n')[0].slice(0, 100)}`);
      console.log(`  FALHA ${t.titulo}`);
    }
  }
  // um único mapa (contexto WebGL) atende todas as lentes
  expect(await page.evaluate(() => Object.keys(_blockMaps).filter(k => _blockMaps[k] && !_blockMaps[k]._removed).length)).toBe(1);
  expect(falhas, 'Lentes onde o desenho falhou:\n' + falhas.join('\n')).toEqual([]);
});
