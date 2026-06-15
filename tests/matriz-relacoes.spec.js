// tests/matriz-relacoes.spec.js
// Matriz de relações entre ambientes (Programação): tabela triangular interativa a
// partir de state.programa; clique cicla ▲ obrigatório → ○ desejável → ✕ evitar →
// vazio; persiste em state.prog_relacoes; exporta diagrama SVG.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Matriz de relações: monta da lista viva, cicla, exporta SVG e persiste', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-13').click();
  await page.waitForTimeout(600);

  const add = await page.evaluate(() => {
    ['Nave', 'Sacristia', 'Adro'].forEach(nm => { document.getElementById('prog-item').value = nm; addProgramaItem(); });
    const host = document.getElementById('matriz-relacoes');
    return { tabela: !!host.querySelector('table'), celulas: host.querySelectorAll('td[onclick]').length };
  });
  expect(add.tabela).toBe(true);
  expect(add.celulas).toBe(3); // triângulo superior de 3×3

  const ciclo = await page.evaluate(() => {
    const ids = (state.programa || []).map(p => p.id);
    matrizCiclar(ids[0], ids[1]);
    const v1 = state.prog_relacoes[_matrizKey(ids[0], ids[1])];
    matrizCiclar(ids[0], ids[1]);
    const v2 = state.prog_relacoes[_matrizKey(ids[0], ids[1])];
    return { v1, v2 };
  });
  expect(ciclo.v1).toBe('obrig');
  expect(ciclo.v2).toBe('desej');

  // export SVG dispara download
  const dlPromise = page.waitForEvent('download', { timeout: 5000 });
  await page.evaluate(() => exportarMatrizSVG());
  const dl = await dlPromise;
  expect(dl.suggestedFilename()).toMatch(/matriz/);

  // persiste no reload
  await page.waitForTimeout(1400);
  await page.reload();
  await page.waitForTimeout(1500);
  await page.locator('#nav-13').click();
  await page.waitForTimeout(500);
  const persist = await page.evaluate(() => {
    const ids = (state.programa || []).map(p => p.id);
    return { n: (state.programa || []).length, rel: state.prog_relacoes[_matrizKey(ids[0], ids[1])], tabela: !!document.querySelector('#matriz-relacoes table') };
  });
  expect(persist.n).toBe(3);
  expect(persist.rel).toBe('desej');
  expect(persist.tabela).toBe(true);
});
