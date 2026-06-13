// tests/dinamica.spec.js
// 2026-06-12: módulo "Dinâmica Territorial" (panel-14). Dois mapas oficiais do
// MapBiomas embutidos (cobertura + mancha urbana), carregados sob clique; a
// leitura/números vão ao export e os achados (sec=14) alimentam a Síntese SWOT.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Dinâmica Territorial: dois mapas MapBiomas sob clique + achado→SWOT', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  await page.locator('#nav-14').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.getElementById('panel-14').classList.contains('active'))).toBe(true);

  // dois blocos de mapa com iframe ainda sem src (lazy) e placeholder visível
  const antes = await page.evaluate(() => ({
    cobSrc: document.getElementById('din-cob-iframe').getAttribute('src'),
    urbSrc: document.getElementById('din-urb-iframe').getAttribute('src'),
    cobPh: getComputedStyle(document.getElementById('din-cob-ph')).display,
    btns: [...document.querySelectorAll('#panel-14 button[onclick^="dinCarregarMapa"]')].length,
  }));
  expect(antes.cobSrc).toBeNull();
  expect(antes.urbSrc).toBeNull();
  expect(antes.cobPh).not.toBe('none');
  expect(antes.btns).toBe(2);

  // carregar o mapa de cobertura define o src para o MapBiomas e some o placeholder
  const cob = await page.evaluate(() => {
    dinCarregarMapa('cob');
    return {
      src: document.getElementById('din-cob-iframe').getAttribute('src'),
      visivel: document.getElementById('din-cob-iframe').style.display,
      ph: document.getElementById('din-cob-ph').style.display,
    };
  });
  expect(cob.src).toContain('mapbiomas.org');
  expect(cob.visivel).toBe('block');
  expect(cob.ph).toBe('none');

  const urb = await page.evaluate(() => { dinCarregarMapa('urb'); return document.getElementById('din-urb-iframe').getAttribute('src'); });
  expect(urb).toContain('mapbiomas.org');

  // achado classificado entra no getAllFindings (→ SWOT)
  const swot = await page.evaluate(() => {
    document.getElementById('inp-f14').value = 'Perda de floresta no entorno';
    addFinding(14); setFClass(14, 0, 'A');
    const f = getAllFindings().find(x => /Perda de floresta/.test(x.text));
    return { entrou: !!f, classe: f?.class };
  });
  expect(swot.entrou).toBe(true);
  expect(swot.classe).toBe('A');
});

test('Dinâmica Territorial: leitura e números-chave persistem no reload', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-14').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => { dinSetCampo('numeros', 'floresta 55→38%'); dinSetCampo('leitura', 'urbanização acelerada a sudeste'); });
  await page.waitForTimeout(1400); // autoSave debounce

  await page.reload();
  await page.waitForTimeout(1500);
  const persist = await page.evaluate(() => ({ numeros: state.dinamica?.numeros, leitura: state.dinamica?.leitura }));
  expect(persist.numeros).toBe('floresta 55→38%');
  expect(persist.leitura).toBe('urbanização acelerada a sudeste');
});
