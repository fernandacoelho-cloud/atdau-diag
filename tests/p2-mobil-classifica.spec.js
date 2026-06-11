// tests/p2-mobil-classifica.spec.js
// Classificação de pontos desenhados por tipo/estado (2026-06-11):
// - popup do ponto desenhado mostra pictograma + Tipo + Estado de conservação
//   (isPoint passou a olhar a geometria REAL da feição, não a capacidade da camada)
// - salvar persiste props.tipo / props.estado
// - camada desenhada pode ser colorida por tipo/estado/pictograma (Categorizado),
//   com legenda por valor; persiste no projeto.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirComMobil(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const c = _mlMap.getCenter();
    const tipos = ['Banco / assento', 'Lixeira', 'Paraciclo / bicicletário'];
    const estados = ['Bom', 'Regular', 'Ruim'];
    _mlFeatures.mobil = [];
    for (let i = 0; i < 12; i++) {
      _mlFeatures.mobil.push({ id: 'm' + i, geom: { type: 'Point', coordinates: [c.lng + ((i % 4) - 2) * 0.0008, c.lat + (Math.floor(i / 4) - 1) * 0.0008] },
        props: { tipo: tipos[i % 3], estado: estados[i % 3], pictograma: '🪑' } });
    }
    _mlMap.getSource('src-mobil').setData(mlGetFC('mobil'));
  });
  await page.waitForTimeout(300);
}

test.describe('P2 — classificação de mobiliário desenhado', () => {

  test('Popup do ponto desenhado mostra pictograma + Tipo + Estado e salva', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await abrirComMobil(page);
    await page.evaluate(() => {
      mlOpenFeaturePopup('mobil', 'm0', { _fid: 'm0', tipo: 'Banco / assento', estado: 'Bom', pictograma: '🪑' }, _mlMap.getCenter(), ML_LAYERS.find(l => l.id === 'mobil'));
    });
    await page.waitForSelector('.maplibregl-popup.ml-popup', { timeout: 6000 });
    await page.waitForTimeout(300);
    const ui = await page.evaluate(() => {
      const p = document.querySelector('.maplibregl-popup.ml-popup');
      return {
        pictograma: !!p.querySelector('.ml-picto-btn'),
        tipo: p.querySelector('#popup-tipo')?.value,
        estado: p.querySelector('#popup-estado')?.value,
      };
    });
    expect(ui.pictograma).toBe(true);     // pictograma volta a aparecer p/ ponto desenhado
    expect(ui.tipo).toBe('Banco / assento');
    expect(ui.estado).toBe('Bom');

    // editar e salvar
    await page.evaluate(() => {
      const p = document.querySelector('.maplibregl-popup.ml-popup');
      p.querySelector('#popup-tipo').value = 'Bebedouro';
      p.querySelector('#popup-estado').value = 'Ruim';
      p.querySelector('#popup-salvar').click();
    });
    await page.waitForTimeout(400);
    const props = await page.evaluate(() => { const f = _mlFeatures.mobil.find(x => x.id === 'm0'); return { tipo: f.props.tipo, estado: f.props.estado }; });
    expect(props.tipo).toBe('Bebedouro');
    expect(props.estado).toBe('Ruim');
  });

  test('Colorir a camada por estado gera cores por valor + legenda; persiste', async ({ page }) => {
    await abrirComMobil(page);
    const attrs = await page.evaluate(() => mlLayerAttrs('mobil'));
    expect(attrs).toEqual(expect.arrayContaining(['tipo', 'estado', 'pictograma']));

    await page.evaluate(() => { mlSetActiveLayer('mobil'); mlCategorizeLayer('mobil', 'estado'); });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const cat = state.ml_cat.mobil;
      const expr = _mlMap.getPaintProperty('circle-mobil', 'circle-color');
      return {
        nVal: cat.valores.length,
        coresDistintas: new Set(cat.valores.map(v => v.cor)).size,
        somaContagem: cat.valores.reduce((s, v) => s + v.n, 0),
        ehMatch: JSON.stringify(expr).includes('match'),
        legenda: mlLegendItems().filter(i => String(i.id).startsWith('cat-')).map(i => i.label.trim()),
      };
    });
    expect(r.nVal).toBe(3);
    expect(r.coresDistintas).toBe(3);
    expect(r.somaContagem).toBe(12);
    expect(r.ehMatch).toBe(true);
    expect(r.legenda).toEqual(expect.arrayContaining(['Bom', 'Regular', 'Ruim']));

    // persiste no reload (state.ml_cat) e a expressão match é reaplicada
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForTimeout(1500);
    await page.locator('#nav-6').click();
    await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
    await page.waitForTimeout(1000);
    const apos = await page.evaluate(() => {
      const cat = state.ml_cat && state.ml_cat.mobil;
      const expr = _mlMap.getPaintProperty('circle-mobil', 'circle-color');
      return { campo: cat?.campo, ehMatch: JSON.stringify(expr).includes('match') };
    });
    expect(apos.campo).toBe('estado');
    expect(apos.ehMatch).toBe(true);

    // reverter para cor padrão
    await page.evaluate(() => mlClearLayerCat('mobil'));
    await page.waitForTimeout(300);
    const limpo = await page.evaluate(() => ({ temCat: !!(state.ml_cat && state.ml_cat.mobil) }));
    expect(limpo.temCat).toBe(false);
  });
});
