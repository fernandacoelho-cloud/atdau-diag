// tests/sweep-blockmaps.spec.js
// VARREDURA PESADA (~4-6 min): desenha um polígono em TODOS os block-maps,
// dirigindo a UI como o usuário (abas, módulos, subabas, acordeões).
// Fora do `npm test` normal — rodar com `npm run test:sweep` (ex.: antes de release).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Desenho de polígono funciona em todos os block-maps', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // clique com fallback DOM: a verificação de actionability do Playwright
  // trava em layouts que acabaram de rolar/expandir; o handler é o mesmo
  const clickFb = async (loc) => {
    try { await loc.click({ timeout: 4000 }); }
    catch { await loc.evaluate(el => el.click()); }
  };

  const toggles = await page.evaluate(() =>
    [...document.querySelectorAll('.block-map-toggle')].map((b, i) => {
      const block = b.closest('.block');
      const wraps = [...block.querySelectorAll('.block-map-wrap')];
      return {
        i,
        titulo: block.querySelector('.block-title')?.textContent?.trim() || '?',
        panel: (b.closest('.panel') || {}).id || null,
        primeiroWrapIdx: [...document.querySelectorAll('.block-map-wrap')].indexOf(wraps[0]),
        modules: (b.closest('.module-block') || { dataset: {} }).dataset.modules || null,
        subId: (b.closest('.subpanel') || {}).id || null,
      };
    })
  );
  expect(toggles.length).toBeGreaterThanOrEqual(25);

  const falhas = [];
  for (const t of toggles) {
    const m = /^panel-(\d+)$/.exec(t.panel || '');
    if (!m) { falhas.push(`${t.titulo}: fora de um panel-N (${t.panel})`); continue; }
    try {
      // navegar até a aba (irPara usa scroll suave — dar tempo de assentar)
      await page.evaluate(n => document.querySelector('#nav-' + n)?.click(), m[1]);
      await page.waitForTimeout(700);

      // blocos modulares só aparecem com o módulo ativo (seletor de tipo de projeto)
      if (t.modules) {
        await page.evaluate(id => setModule(id), t.modules.split(' ')[0]);
        await page.waitForTimeout(300);
      }
      // subabas (ex.: panel-9 — Mapas da escala)
      if (t.subId) {
        const tabId = t.subId.replace(/^sp-\d+-/, '');
        await page.evaluate(tabId => {
          const btn = [...document.querySelectorAll('.subtab')]
            .find(b => (b.getAttribute('onclick') || '').includes(`'${tabId}'`));
          btn?.click();
        }, tabId);
        await page.waitForTimeout(400);
      }
      // acordeões de categoria fechados escondem o botão
      await page.evaluate(i => {
        let el = document.querySelectorAll('.block-map-toggle')[i];
        while (el && el !== document.body) {
          if (el.classList && el.classList.contains('cat-group') && !el.classList.contains('cat-open'))
            el.querySelector(':scope > .cat-header')?.click();
          el = el.parentElement;
        }
      }, t.i);
      await page.waitForTimeout(200);

      const btn = page.locator('.block-map-toggle').nth(t.i);
      try { await btn.scrollIntoViewIfNeeded({ timeout: 4000 }); }
      catch { await btn.evaluate(el => el.scrollIntoView({ block: 'center' })); }
      const aberto = await page.evaluate(
        wi => document.querySelectorAll('.block-map-wrap')[wi].classList.contains('open'),
        t.primeiroWrapIdx
      );
      if (!aberto) await clickFb(btn); // toggleBlockMap expande o bloco recolhido sozinho

      await page.waitForFunction(wi => {
        const wr = document.querySelectorAll('.block-map-wrap')[wi];
        return wr && wr.querySelector('.block-map-draw-ctrl .bm-draw-btn');
      }, t.primeiroWrapIdx, { timeout: 25000 });
      await page.waitForTimeout(600);

      const wrapLoc = page.locator('.block-map-wrap').nth(t.primeiroWrapIdx);
      const info = await page.evaluate(wi => {
        const wr = document.querySelectorAll('.block-map-wrap')[wi];
        const lid = wr.querySelector('.bm-layer-select').value;
        return { lid, antes: (_mlFeatures[lid] || []).length };
      }, t.primeiroWrapIdx);

      await clickFb(wrapLoc.locator('.bm-draw-btn[data-geom="polygon"]'));
      const canvas = wrapLoc.locator('.block-map canvas').first();
      // mouse.click não rola a página: trazer o canvas para o viewport antes
      await canvas.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      const box = await canvas.boundingBox();
      if (!box || box.width < 50) { falhas.push(`${t.titulo}: canvas invisível (${JSON.stringify(box)})`); continue; }

      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.click(cx - 55, cy + 35);
      await page.mouse.click(cx + 55, cy + 35);
      await page.mouse.click(cx, cy - 45);
      await page.mouse.dblclick(cx, cy - 45);

      await page.waitForFunction(({ lid, antes }) =>
        (_mlFeatures[lid] || []).length > antes &&
        _mlFeatures[lid][_mlFeatures[lid].length - 1].geom.type === 'Polygon',
        { lid: info.lid, antes: info.antes }, { timeout: 8000 });
      console.log(`  ok ${t.titulo} (camada ${info.lid})`);

      await clickFb(btn); // fechar o wrap alivia os contextos WebGL
      await page.waitForTimeout(150);
    } catch (e) {
      falhas.push(`${t.titulo}: ${e.message.split('\n')[0].slice(0, 100)}`);
      console.log(`  FALHA ${t.titulo}`);
    }
  }

  expect(falhas, 'Block-maps onde o desenho falhou:\n' + falhas.join('\n')).toEqual([]);
});
