// tests/mapa-anotado.spec.js
// Correção do Mapa Anotado (panel-9, sub-aba Urbana) — 2026-06-11.
// Bug herdado: maLegendItems iterava MapaAnotadoStore.data (objeto
// {annotations,activeCategories}) em vez de .annotations (array), lançando
// "data.forEach is not a function". Isso quebrava maRenderMarkers a cada
// chamada — markers nunca apareciam e "adicionar" abortava antes do modal.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirMapaAnotado(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-9').click();
  await page.waitForFunction(() => typeof _maInst !== 'undefined' && _maInst && _maInst.isStyleLoaded && _maInst.isStyleLoaded(), null, { timeout: 15000 });
  await page.waitForTimeout(800);
}

test.describe('Mapa Anotado — adicionar anotação funciona', () => {

  test('maLegendItems não lança e o mapa inicializa', async ({ page }) => {
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    await abrirMapaAnotado(page);
    const r = await page.evaluate(() => ({
      legenda: (() => { try { return maLegendItems().length; } catch (e) { return 'THROW: ' + e.message; } })(),
      basemap: !!_maInst.getLayer('basemap-layer'),
      canvas: !!document.querySelector('#ma-mapa canvas'),
    }));
    expect(typeof r.legenda).toBe('number'); // não lança
    expect(r.basemap).toBe(true);
    expect(r.canvas).toBe(true);
    expect(erros.filter(e => /forEach is not a function/.test(e))).toEqual([]);
  });

  test('Adicionar cria anotação, marker e abre o modal de edição', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await abrirMapaAnotado(page);
    const add = await page.evaluate(() => {
      MapaAnotadoStore.clear();
      maSetAddCategory(MA_CATEGORIES[0].id); // modo add + 1a categoria
      const antes = MapaAnotadoStore.getAll().length;
      let erro = null;
      try { const c = _maInst.getCenter(); _maInst.fire('click', { lngLat: c, point: _maInst.project(c) }); }
      catch (e) { erro = e.message; }
      return { antes, depois: MapaAnotadoStore.getAll().length, erro };
    });
    expect(add.erro).toBeNull();
    expect(add.depois).toBe(add.antes + 1);

    await page.waitForTimeout(400);
    const ui = await page.evaluate(() => ({
      markers: document.querySelectorAll('#ma-mapa .maplibregl-marker').length,
      modal: [...document.querySelectorAll('*')].some(e => /editar|anota/i.test(e.textContent || '') && getComputedStyle(e).position === 'fixed'),
      legenda: maLegendItems().length,
    }));
    expect(ui.markers).toBeGreaterThanOrEqual(1);
    expect(ui.modal).toBe(true);
    expect(ui.legenda).toBe(1);
  });
});
