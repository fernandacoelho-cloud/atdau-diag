// tests/relatorio-visual.spec.js
// Relatório Etapa B (visuais no PDF): o relatório passou a embutir os mapas como
// imagem. O núcleo é o refactor de exportarMapaPNG → _comporMapaCanvas, que compõe
// um canvas (mapa + norte + escala + legenda) e o devolve para ser convertido em
// JPEG e inserido no PDF via addImage. Aqui testamos esse núcleo offline (sem depender
// do jsPDF, que vem de CDN): o canvas é capturável e o guard de mapa ausente não quebra.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Relatório visual: _comporMapaCanvas captura o mapa (canvas + JPEG) e exportarMapaPNG guarda mapa ausente', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  // o refactor expôs as duas funções
  const fns = await page.evaluate(() => ({ compor: typeof _comporMapaCanvas, exp: typeof exportarMapaPNG }));
  expect(fns.compor).toBe('function');
  expect(fns.exp).toBe('function');

  // mapa ainda não renderizado / ausente → retorna null (não lança)
  const semMapa = await page.evaluate(() => {
    try { return { ret: _comporMapaCanvas(null, {}), erro: null }; }
    catch (e) { return { ret: 'THREW', erro: e.message }; }
  });
  expect(semMapa.erro).toBe(null);
  expect(semMapa.ret).toBe(null);

  // renderizar o Mapa Anotado e capturar seu canvas com legenda
  await page.locator('#nav-9').click();
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('ma-mapa')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => typeof _maInst !== 'undefined' && _maInst && _maInst.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(1000);

  const cap = await page.evaluate(() => {
    const cv = _comporMapaCanvas(_maInst, { titulo: 'Teste', legendaItems: maLegendItems, legendaTitulo: 'Categorias', credito: 'ATDAU' });
    if (!cv) return { ok: false };
    let url = '';
    try { url = cv.toDataURL('image/jpeg', 0.9); } catch (e) { return { ok: false, erro: e.message }; }
    return { ok: true, w: cv.width, h: cv.height, jpeg: /^data:image\/jpeg/.test(url) };
  });
  expect(cap.ok).toBe(true);
  expect(cap.w).toBeGreaterThan(0);
  expect(cap.h).toBeGreaterThan(0);
  expect(cap.jpeg).toBe(true);
});
