// tests/verbos-sel.spec.js
// Verbos de ação SEL (Tardim) no painel 08: novo grupo VERBOS_GRUPOS.sel com 6
// verbos (acrescentar, demarcar, conectar, adequar, articular, enlaçar). Ids com
// prefixo sel- p/ não colidir com os verbos existentes (ex.: 'conectar' topológico).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Verbos SEL (Tardim): grupo renderiza, toggla, persiste e não colide ids', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const r = await page.evaluate(() => {
    irPara(8, document.getElementById('nav-8'));
    if (typeof renderVerbos === 'function') renderVerbos();
    const grid = document.getElementById('verbos-grid');
    toggleVerbo('sel-conectar');
    toggleVerbo('sel-enlacar');
    return {
      grupoNoMap: !!VERBOS_GRUPOS.sel,
      qtdSel: VERBOS_OPERATIVOS.filter(v => v.grupo === 'sel').length,
      headerSEL: /Sistema de espa/.test(grid.textContent || ''),
      chipConectar: !!grid.querySelector('[onclick*="sel-conectar"]'),
      selecionados: state['verbos-selecionados'] || [],
      idsUnicos: new Set(VERBOS_OPERATIVOS.map(v => v.id)).size === VERBOS_OPERATIVOS.length,
    };
  });
  expect(r.grupoNoMap).toBe(true);
  expect(r.qtdSel).toBe(6);
  expect(r.headerSEL).toBe(true);
  expect(r.chipConectar).toBe(true);
  expect(r.selecionados).toContain('sel-conectar');
  expect(r.selecionados).toContain('sel-enlacar');
  expect(r.idsUnicos).toBe(true);
});
