// tests/pendencias.spec.js
// Regressão dos 3 fixes de 2026-06-10 (pendências herdadas do claude.ai):
//   1. Popup salva/exclui features com id string (origem block-map) — via properties._fid
//   2. "Mostrar mapa" expande bloco recolhido (canvas deixava de renderizar com 0x0)
//   3. Legenda do Mapa de Análise inicia oculta, com botão "▤ Legenda" para reexibir
//   4. Todo botão de mapa tem exatamente um wrap (wraps órfãos removidos)
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

// Abre a aba 6 e espera o Mapa de Análise ficar pronto
async function abrirMapaAnalise(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-6').click();
  await page.waitForFunction(
    () => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(),
    null, { timeout: 20000 }
  );
  await page.waitForTimeout(800);
}

// Injeta um polígono no centro do mapa e devolve a camada usada
async function injetarPoligono(page, fid) {
  const lid = await page.evaluate((fid) => {
    const l = ML_LAYERS.find(l => l.geom.includes('polygon') && !['uso', 'terreno'].includes(l.id));
    _mlFeatures[l.id] = [];
    const c = _mlMap.getCenter(); const d = 0.0012;
    const ring = [[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]];
    _mlFeatures[l.id].push({ id: fid, geom: { type: 'Polygon', coordinates: [ring] }, props: { origem: 'block-map' } });
    _mlMap.getSource('src-' + l.id).setData(mlGetFC(l.id));
    return l.id;
  }, fid);
  await page.waitForTimeout(700);
  return lid;
}

// Clica no centro do mapa (onde está o polígono injetado)
async function clicarNoCentroDoMapa(page) {
  await page.locator('#ml-map').scrollIntoViewIfNeeded(); // a faixa de estado do desenho fica fixa acima do mapa
  const box = await page.locator('#ml-map').boundingBox();
  const pt = await page.evaluate(() => { const p = _mlMap.project(_mlMap.getCenter()); return { x: p.x, y: p.y }; });
  await page.mouse.click(box.x + pt.x, box.y + pt.y);
}

test.describe('ATDAU DIAG — regressão das pendências', () => {

  test('Popup salva e exclui feature com id string (origem block-map)', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await abrirMapaAnalise(page);
    const lid = await injetarPoligono(page, 'bm-regressao-1');

    // salvar: mover slider de opacidade e confirmar persistência
    await clicarNoCentroDoMapa(page);
    await page.waitForSelector('.maplibregl-popup.ml-popup #popup-opacity', { timeout: 6000 });
    await page.waitForTimeout(300); // wire-up dos handlers roda num setTimeout(50) após o mount
    await page.locator('#popup-opacity').focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await page.locator('#popup-salvar').click();
    await page.waitForTimeout(500);
    const props = await page.evaluate((lid) =>
      (_mlFeatures[lid].find(f => f.id === 'bm-regressao-1') || {}).props, lid);
    console.log('props após salvar:', props);
    expect(props.opacity).toBeCloseTo(0.55, 2);

    // excluir: reabrir popup e deletar (confirm é aceito pelo handler acima)
    await clicarNoCentroDoMapa(page);
    await page.waitForSelector('.maplibregl-popup.ml-popup #popup-deletar', { timeout: 6000 });
    await page.waitForTimeout(300); // idem: aguardar wire-up
    await page.locator('#popup-deletar').click();
    await page.waitForFunction((lid) => (_mlFeatures[lid] || []).length === 0, lid, { timeout: 5000 });
    const restantes = await page.evaluate((lid) => (_mlFeatures[lid] || []).length, lid);
    expect(restantes).toBe(0);
  });

  // 2026-10: os mini-mapas por bloco viraram lentes do mapa único (#lente-wrap): o botão do bloco mostra o tema no mapa único (o canvas fica na coluna do mapa)
  test('Ver no mapa (lente) mostra o tema no mapa único e o canvas renderiza', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await page.locator('#nav-1').click();
    await page.waitForTimeout(700);

    const btn = page.locator('#panel-1 .lente-btn').nth(1);
    const tema = await btn.getAttribute('data-lente');
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await page.waitForFunction(t => { const w = document.getElementById('lente-wrap'); return w.dataset.theme === t && w.dataset.ready === '1'; }, tema, { timeout: 25000 });
    const estado = await btn.evaluate(b => {
      const c = document.querySelector('#lente-wrap .block-map canvas');
      const r = c ? c.getBoundingClientRect() : null;
      return { foco: b.closest('.block').classList.contains('lente-foco'), ativo: b.classList.contains('ativa'), canvasLargura: r ? Math.round(r.width) : 0 };
    });
    expect(estado.foco).toBe(true);
    expect(estado.ativo).toBe(true);
    expect(estado.canvasLargura).toBeGreaterThan(100);
  });

  test('Legenda do Mapa de Análise inicia oculta com botão para reexibir', async ({ page }) => {
    await abrirMapaAnalise(page);
    await page.waitForSelector('#ml-map .map-legend', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(1000); // hide() roda 100ms após o mount

    const inicial = await page.evaluate(() => ({
      display: getComputedStyle(document.querySelector('#ml-map .map-legend')).display,
      botao: !!document.querySelector('#ml-map .ml-leg-toggle-btn'),
    }));
    console.log('legenda inicial:', inicial);
    expect(inicial.display).toBe('none');
    expect(inicial.botao).toBe(true);

    await page.locator('#ml-map .ml-leg-toggle-btn').click();
    await page.waitForTimeout(300);
    const depois = await page.evaluate(() => ({
      display: getComputedStyle(document.querySelector('#ml-map .map-legend')).display,
      botao: !!document.querySelector('#ml-map .ml-leg-toggle-btn'),
    }));
    expect(depois.display).toBe('flex');
    expect(depois.botao).toBe(false);
  });

  // 2026-10: os mini-mapas por bloco viraram lentes do mapa único (#lente-wrap)
  test('Todo botão de lente aponta para um tema válido e há um único mapa', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const wraps = document.querySelectorAll('.block-map-wrap').length;
      const botoes = [...document.querySelectorAll('.block-map-toggle')];
      const invalidos = botoes.filter(b => !b.dataset.lente || !ML_THEMES[b.dataset.lente]).map(b => b.closest('.block')?.querySelector('.block-title')?.textContent?.trim());
      return { wraps, botoes: botoes.length, invalidos };
    });
    expect(r.wraps).toBe(1);
    expect(r.botoes).toBe(27);
    expect(r.invalidos).toEqual([]);
  });
});
