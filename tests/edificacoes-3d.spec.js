// tests/edificacoes-3d.spec.js
// 3D no Mapa de Análise — Onda 1: controle "🏢 Prédios" traz footprints REAIS como overlay
// (sem trocar o basemap), de duas fontes (iguais às do Mapa-Síntese): OSM/OpenFreeMap (fonte
// 'openmaptiles', camada 'building', altura real) e Open Buildings via PMTiles (lazy-load).
// Toggle 2D/3D (fill-extrusion + pitch). Cor por uso virá na Onda 2.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

const setCb = (sel) => `(()=>{const cb=document.querySelector('${sel}');cb.checked=true;cb.dispatchEvent(new Event('change',{bubbles:true}));})()`;

test('Edificações: controle adiciona prédios OSM + Open Buildings (2D/3D) no Mapa de Análise', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(500);

  // o bloco visível "Prédios reais" e os três toggles existem (abaixo da barra do mapa)
  await expect(page.locator('.edif-box summary')).toContainText('Prédios');
  for (const c of ['.edif-ob', '.edif-osm', '.edif-3d']) {
    expect(await page.locator('.edif-box ' + c).count()).toBe(1);
  }

  // OSM (OpenFreeMap): liga → fonte vetorial + camadas de prédio (overlay, basemap intacto)
  await page.evaluate(setCb('.edif-osm'));
  await page.waitForTimeout(200);
  const osm = await page.evaluate(() => ({
    src: !!_mlMap.getSource('openmaptiles'),
    fill: !!_mlMap.getLayer('edif-osm-fill'),
    line: !!_mlMap.getLayer('edif-osm-line'),
    basemapVivo: !!_mlMap.getLayer('background'),   // não trocou o estilo
  }));
  expect(osm).toEqual({ src: true, fill: true, line: true, basemapVivo: true });

  // Volume 3D: extrusão + pitch
  await page.evaluate(setCb('.edif-3d'));
  await page.waitForFunction(() => _mlMap.getPitch() > 5, null, { timeout: 4000 });
  expect(await page.evaluate(() => !!_mlMap.getLayer('edif-osm-3d'))).toBe(true);

  // Open Buildings (PMTiles, lazy-load do pmtiles.js): liga → fonte + camada
  await page.evaluate(setCb('.edif-ob'));
  await page.waitForFunction(() => !!_mlMap.getSource('overture-build'), null, { timeout: 25000 });
  expect(await page.evaluate(() => !!_mlMap.getLayer('edif-ob-fill'))).toBe(true);

  // editar a altura dos prédios sem dado (Open Buildings) atualiza a extrusão ao vivo
  expect(await page.evaluate(() => !!_mlMap.getLayer('edif-ob-3d'))).toBe(true);
  await page.evaluate(() => { const i = document.querySelector('.edif-box .edif-h'); i.value = '24'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => _mlMap.getPaintProperty('edif-ob-3d', 'fill-extrusion-height'))).toBe(24);

  // desligar OSM remove só as camadas OSM (Open Buildings permanece)
  await page.evaluate(() => { const cb = document.querySelector('.edif-osm'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(150);
  const off = await page.evaluate(() => ({
    osmFill: !!_mlMap.getLayer('edif-osm-fill'),
    obFill: !!_mlMap.getLayer('edif-ob-fill'),
  }));
  expect(off).toEqual({ osmFill: false, obFill: true });

  // ── também nos block-maps (Usos/Ocupação e demais abas de mapeamento) ──
  await page.locator('#nav-1').click();
  await page.waitForTimeout(600);
  const bmToggle = page.locator('.block-map-toggle').nth(0);
  await bmToggle.scrollIntoViewIfNeeded();
  await bmToggle.click();
  // o controle "🏢 Prédios" é injetado na barra do block-map
  await page.waitForFunction(() => document.querySelectorAll('.block-map-wrap')[0]?.querySelector('.edif-box-bm .edif-osm'), null, { timeout: 25000 });
  // ligar OSM no block-map adiciona a camada NAQUELA instância de mapa
  await page.evaluate(() => { const cb = document.querySelector('.block-map-wrap .edif-box-bm .edif-osm'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => {
    const wrap = document.querySelector('.block-map-wrap');
    const inst = Object.values(_blockMaps).find(m => m && m.getContainer && wrap.contains(m.getContainer()));
    return !!(inst && inst.getLayer('edif-osm-fill'));
  }, null, { timeout: 10000 });
});
