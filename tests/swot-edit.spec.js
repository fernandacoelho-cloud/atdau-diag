// tests/swot-edit.spec.js
// Edicao/exclusao de feicao individual no mapa SWOT (2026-06-11): antes so
// dava para "limpar categoria" inteira. Agora clicar numa feicao (fora do
// modo desenho) abre popup para editar rotulo, mover entre categorias P/F/O/A
// e excluir.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirSwotComFeicao(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-7').click();
  await page.waitForFunction(() => typeof _swotMap !== 'undefined' && _swotMap && _swotMap.isStyleLoaded && _swotMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const c = _swotMap.getCenter();
    _swotFeatures.P = [{ id: 111, geom: { type: 'Point', coordinates: [c.lng, c.lat] }, props: { cat: 'P', label: 'Vista privilegiada' } }];
    _swotFeatures.F = []; _swotFeatures.O = []; _swotFeatures.A = [];
    _swotMap.getSource('swot-P').setData(swotFC('P'));
  });
  await page.waitForTimeout(500);
}

async function clicarNaFeicao(page) {
  // esperar a feição renderizar (setData é assíncrono) antes de clicar
  await page.waitForFunction(() => {
    const c = _swotMap.project(_swotMap.getCenter());
    return _swotMap.queryRenderedFeatures(c, { layers: ['swot-pt-P', 'swot-pt-F', 'swot-pt-O', 'swot-pt-A'].filter(id => _swotMap.getLayer(id)) }).length > 0;
  }, null, { timeout: 8000 }).catch(() => {});
  // trazer o mapa para a viewport (no viewport 1280x720 ele fica abaixo da dobra)
  await page.locator('#swot-map-el').scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const box = await page.locator('#swot-map-el').boundingBox();
  const pt = await page.evaluate(() => { const p = _swotMap.project(_swotMap.getCenter()); return { x: p.x, y: p.y }; });
  await page.mouse.click(box.x + pt.x, box.y + pt.y);
  await page.waitForTimeout(400);
}

test.describe('SWOT — editar/excluir feição individual', () => {

  test('Clicar abre popup com rótulo, categoria e excluir', async ({ page }) => {
    await abrirSwotComFeicao(page);
    await clicarNaFeicao(page);
    const popup = await page.evaluate(() => {
      const p = document.querySelector('.maplibregl-popup.ml-popup');
      return p ? { label: p.querySelector('#swot-pop-label')?.value, cat: !!p.querySelector('#swot-pop-cat'), del: !!p.querySelector('#swot-pop-del') } : null;
    });
    expect(popup).not.toBeNull();
    expect(popup.label).toBe('Vista privilegiada');
    expect(popup.cat).toBe(true);
    expect(popup.del).toBe(true);
  });

  test('Editar rótulo e mover de categoria (P→F)', async ({ page }) => {
    await abrirSwotComFeicao(page);
    await clicarNaFeicao(page);
    await page.evaluate(() => {
      const p = document.querySelector('.maplibregl-popup.ml-popup');
      p.querySelector('#swot-pop-label').value = 'Encosta instável';
      p.querySelector('#swot-pop-cat').value = 'F';
      p.querySelector('#swot-pop-save').click();
    });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({
      P: _swotFeatures.P.length, F: _swotFeatures.F.length,
      label: _swotFeatures.F[0]?.props.label, cat: _swotFeatures.F[0]?.props.cat,
      persistidoF: (state['swot-map']?.F || []).length,
    }));
    expect(r.P).toBe(0);
    expect(r.F).toBe(1);
    expect(r.label).toBe('Encosta instável');
    expect(r.cat).toBe('F');
    expect(r.persistidoF).toBe(1);
  });

  test('Excluir feição individual', async ({ page }) => {
    await abrirSwotComFeicao(page);
    await clicarNaFeicao(page);
    await page.evaluate(() => document.querySelector('.maplibregl-popup.ml-popup #swot-pop-del').click());
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ P: _swotFeatures.P.length, persistido: (state['swot-map']?.P || []).length }));
    expect(r.P).toBe(0);
    expect(r.persistido).toBe(0);
  });
});
