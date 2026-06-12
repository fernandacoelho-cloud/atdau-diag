// tests/swot-edit.spec.js
// Consolidação do SWOT (2026-06-11): o mapa SWOT separado virou uma CAMADA do
// Mapa de Análise (🎯 Síntese SWOT). Desenha-se classificando como P/F/O/A; a
// cor é por classe; a legenda agrupa por classe; o painel SWOT só tem um atalho.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirMapa(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);
}

test.describe('SWOT consolidado como camada do Mapa de Análise', () => {

  test('swot está em ML_LAYERS e migra o SWOT antigo', async ({ page }) => {
    await abrirMapa(page);
    const r = await page.evaluate(() => {
      const inLayers = ML_LAYERS.some(l => l.id === 'swot');
      const c = _mlMap.getCenter();
      state['swot-map'] = {
        P: [{ id: 1, geom: { type: 'Point', coordinates: [c.lng, c.lat] }, props: { cat: 'P', label: 'Vista' } }],
        F: [{ id: 2, geom: { type: 'Point', coordinates: [c.lng + 0.001, c.lat] }, props: { cat: 'F' } }],
        O: [], A: []
      };
      state.swot_migrado = false; _mlFeatures.swot = [];
      mlMigrateSwot();
      return { inLayers, n: _mlFeatures.swot.length, p0: _mlFeatures.swot[0]?.props, corF: _mlFeatures.swot[1]?.props.cor, migrado: state.swot_migrado };
    });
    expect(r.inLayers).toBe(true);
    expect(r.n).toBe(2);
    expect(r.p0).toMatchObject({ layer: 'swot', swot: 'P', cor: '#22c474' });
    expect(r.corF).toBe('#e0506a'); // F = vermelho
    expect(r.migrado).toBe(true);
  });

  test('Barra de desenho mostra P/F/O/A; desenhar cria feição classificada e colorida', async ({ page }) => {
    await abrirMapa(page);
    await page.evaluate(() => { _mlFeatures.swot = []; mlSetActiveLayer('swot'); });
    await page.waitForTimeout(200);
    const bar = await page.evaluate(() => {
      const botoes = [...document.querySelectorAll('#ml-drawbar button')].map(b => b.textContent.trim());
      return { pfoa: ['P', 'F', 'O', 'A'].every(k => botoes.includes(k)), head: document.querySelector('.ml-drawbar-head')?.textContent };
    });
    expect(bar.pfoa).toBe(true);
    expect(bar.head).toContain('Síntese SWOT');

    const draw = await page.evaluate(() => {
      _mlSelSwot = 'O'; mlSelectDraw('swot', 'point');
      const c = _mlMap.getCenter();
      _mlMap.fire('click', { lngLat: { lng: c.lng + 0.002, lat: c.lat + 0.002 }, point: _mlMap.project([c.lng + 0.002, c.lat + 0.002]) });
      const f = _mlFeatures.swot[_mlFeatures.swot.length - 1];
      return { n: _mlFeatures.swot.length, swot: f.props.swot, cor: f.props.cor, semVinculoModal: !document.getElementById('ml-vinculo-modal') };
    });
    expect(draw.n).toBe(1);
    expect(draw.swot).toBe('O');
    expect(draw.cor).toBe('#4f9bf8'); // O = azul
    expect(draw.semVinculoModal).toBe(true); // swot não abre o modal de vínculo

    const leg = await page.evaluate(() => mlLegendItems().filter(i => String(i.id).startsWith('swot-')).map(i => i.id));
    expect(leg).toContain('swot-O');
  });

  test('Painel SWOT não cria mapa próprio e o atalho ativa a camada', async ({ page }) => {
    await abrirMapa(page);
    await page.locator('#nav-7').click();
    await page.waitForTimeout(800);
    const p7 = await page.evaluate(() => ({
      semMapEl: !document.getElementById('swot-map-el'),
      semSwotMap: typeof _swotMap === 'undefined' || !_swotMap,
      atalho: !![...document.querySelectorAll('#panel-7 button')].find(b => /Espacializar SWOT/.test(b.textContent)),
    }));
    expect(p7.semMapEl).toBe(true);
    expect(p7.semSwotMap).toBe(true);
    expect(p7.atalho).toBe(true);

    await page.evaluate(() => irParaSwotMapa());
    await page.waitForFunction(() => document.getElementById('panel-6').classList.contains('active') && _mlSelLayer === 'swot', null, { timeout: 8000 });
    const ok = await page.evaluate(() => ({ p6: document.getElementById('panel-6').classList.contains('active'), ativa: _mlSelLayer }));
    expect(ok.p6).toBe(true);
    expect(ok.ativa).toBe('swot');
  });

  test('Reclassificar uma feição SWOT pelo popup muda classe/cor sem virar cinza', async ({ page }) => {
    await abrirMapa(page);
    await page.evaluate(() => {
      const c = _mlMap.getCenter();
      _mlFeatures.swot = [{ id: 7000, geom: { type: 'Point', coordinates: [c.lng, c.lat] }, props: { layer: 'swot', swot: 'O', label: 'Oportunidade', cor: '#4f9bf8' } }];
      mlRefreshSource('swot');
      const ld = ML_LAYERS.find(l => l.id === 'swot');
      mlOpenFeaturePopup('swot', 7000, _mlFeatures.swot[0].props, c, ld, _mlMap);
    });
    await page.waitForTimeout(300);
    const popup = await page.evaluate(() => {
      const p = document.querySelector('.maplibregl-popup.ml-popup');
      return { btns: [...p.querySelectorAll('.popup-swot-btn')].map(b => b.dataset.swot), semCorGenerica: !p.querySelector('#popup-cor') };
    });
    expect(popup.btns).toEqual(['P', 'F', 'O', 'A']);
    expect(popup.semCorGenerica).toBe(true); // a classe define a cor; sem corOverride genérico

    const after = await page.evaluate(() => {
      const p = document.querySelector('.maplibregl-popup.ml-popup');
      p.querySelector('.popup-swot-btn[data-swot="F"]').click();
      p.querySelector('#popup-salvar').click();
      const f = _mlFeatures.swot.find(x => x.id === 7000);
      return { swot: f.props.swot, cor: f.props.cor, label: f.props.label, corOverride: f.props.corOverride || null };
    });
    expect(after.swot).toBe('F');
    expect(after.cor).toBe('#e0506a');     // F = vermelho (não cinza)
    expect(after.label).toBe('Fragilidade');
    expect(after.corOverride).toBe(null);  // não grava corOverride que apagaria a cor da classe
  });
});
