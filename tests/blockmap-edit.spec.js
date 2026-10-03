// tests/blockmap-edit.spec.js
// 2026-06-11: editar feições desenhadas DENTRO dos block-maps do Diagnóstico
// (clicar → cor/excluir) e o painel "🎨 Estilo" não ser cortado pela borda do
// mapa (mora no wrap, com altura limitada ao viewport).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

const clickFb = async (loc) => { try { await loc.click({ timeout: 4000 }); } catch { await loc.evaluate(el => el.click()); } };

// Abre a lente do primeiro bloco com "Ver no mapa" de um panel simples (sem módulos/subabas) e devolve
// o índice do wrap + a camada destino. 2026-10: os mini-mapas viraram lentes do mapa único
// (#lente-wrap, o único .block-map-wrap da página) — o índice devolvido é sempre 0.
async function abrirPrimeiroBlockMap(page) {
  const t = (await page.evaluate(() =>
    [...document.querySelectorAll('.lente-btn')].map((b, i) => ({
      i, panel: (b.closest('.panel') || {}).id || null,
      modules: (b.closest('.module-block') || { dataset: {} }).dataset.modules || null,
      subId: (b.closest('.subpanel') || {}).id || null,
    })).filter(t => !t.modules && !t.subId && /^panel-(\d+)$/.test(t.panel || ''))
  ))[0];
  const n = /^panel-(\d+)$/.exec(t.panel)[1];
  await page.evaluate(nn => document.querySelector('#nav-' + nn)?.click(), n);
  await page.waitForTimeout(800);
  const btn = page.locator('.lente-btn').nth(t.i);
  try { await btn.scrollIntoViewIfNeeded({ timeout: 4000 }); } catch { await btn.evaluate(el => el.scrollIntoView({ block: 'center' })); }
  await clickFb(btn);
  const tema = await btn.getAttribute('data-lente');
  await page.waitForFunction(tema => {
    const wr = document.getElementById('lente-wrap');
    return wr && wr.dataset.theme === tema && wr.dataset.ready === '1' && wr.querySelector('.block-map-draw-ctrl .bm-draw-btn');
  }, tema, { timeout: 25000 });
  await page.waitForTimeout(700);
  const lid = await page.evaluate(() => document.getElementById('lente-wrap').querySelector('.bm-layer-select').value);
  return { wrapIdx: 0, lid };
}

test('Block-map: clicar numa feição desenhada abre o editor (cor + excluir) e salva', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
  const { wrapIdx, lid } = await abrirPrimeiroBlockMap(page);
  const wrapLoc = page.locator('.block-map-wrap').nth(wrapIdx);

  // desenhar um ponto
  await clickFb(wrapLoc.locator('.bm-draw-btn[data-geom="point"]'));
  const canvas = wrapLoc.locator('.block-map canvas').first();
  await canvas.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const antes = await page.evaluate(l => (_mlFeatures[l] || []).length, lid);
  await page.mouse.click(cx, cy);
  await page.waitForFunction(({ l, a }) => (_mlFeatures[l] || []).length > a, { l: lid, a: antes }, { timeout: 8000 });
  const fid = await page.evaluate(l => _mlFeatures[l][_mlFeatures[l].length - 1].id, lid);

  // desenhar agora dispara o modal "vincular achado" (igual ao Mapa de Análise):
  // fechar antes de clicar na feição para editá-la.
  await page.evaluate(() => { if (typeof mlFecharVinculo === 'function') mlFecharVinculo(); });
  await page.waitForTimeout(200);

  // clicar no ponto → editor abre com cor + excluir
  await page.waitForTimeout(400);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);
  const editor = await page.evaluate(() => {
    const p = document.querySelector('.maplibregl-popup.ml-popup');
    return { abriu: !!p, temCor: !!p?.querySelector('#popup-cor'), temDeletar: !!p?.querySelector('#popup-deletar') };
  });
  expect(editor.abriu).toBe(true);
  expect(editor.temCor).toBe(true);
  expect(editor.temDeletar).toBe(true);

  // mudar cor + salvar → corOverride persiste
  const cor = await page.evaluate(({ l, f }) => {
    const p = document.querySelector('.maplibregl-popup.ml-popup');
    const inp = p.querySelector('#popup-cor');
    inp.value = '#ff0000'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    p.querySelector('#popup-salvar').click();
    return _mlFeatures[l].find(x => String(x.id) === String(f))?.props?.corOverride || null;
  }, { l: lid, f: fid });
  expect(cor).toBe('#ff0000');

  // reabrir e excluir
  await page.waitForTimeout(400);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);
  const before = await page.evaluate(l => _mlFeatures[l].length, lid);
  await page.evaluate(() => document.querySelector('.maplibregl-popup.ml-popup #popup-deletar').click());
  await page.waitForTimeout(500);
  const after = await page.evaluate(l => _mlFeatures[l].length, lid);
  expect(after).toBeLessThan(before);
});

test('Block-map: painel de estilo cabe na tela (não cortado pela borda do mapa)', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
  const { wrapIdx } = await abrirPrimeiroBlockMap(page);
  const wrapLoc = page.locator('.block-map-wrap').nth(wrapIdx);

  await clickFb(wrapLoc.locator('.bm-style-btn'));
  await page.waitForTimeout(350);
  const r = await page.evaluate(wi => {
    const wr = document.querySelectorAll('.block-map-wrap')[wi];
    const panel = wr.querySelector('.block-map-style-panel');
    const p = panel.getBoundingClientRect();
    return {
      visivel: panel.style.display === 'block',
      paiEhWrap: panel.parentElement === wr,          // fora do .block-map (overflow:hidden)
      dentroViewport: p.top >= 0 && p.bottom <= window.innerHeight + 1,
      altura: Math.round(p.height),
    };
  }, wrapIdx);
  expect(r.visivel).toBe(true);
  expect(r.paiEhWrap).toBe(true);          // não está mais dentro do mapa que recorta
  expect(r.dentroViewport).toBe(true);     // visível por inteiro
  expect(r.altura).toBeGreaterThan(120);
});
