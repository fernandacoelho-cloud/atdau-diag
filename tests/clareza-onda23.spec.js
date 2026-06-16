// tests/clareza-onda23.spec.js
// Clareza Ondas 2-3 (UX): (2) Glossario dos termos/metodos em linguagem simples
// (modal com busca) e (3) trilho de fluxo no topo de cada aba (vem de -> voce esta
// aqui -> alimenta), orientando onde a etapa esta no processo.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Clareza: trilho de fluxo por aba + glossario com busca', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);

  // trilho aparece no painel-0 (no load) e no painel-7 (ao navegar)
  const trilho = await page.evaluate(() => {
    const t0 = !!document.querySelector('#panel-0 > .fluxo-trilho');
    irPara(7, document.getElementById('nav-7'));
    const t7 = document.querySelector('#panel-7 > .fluxo-trilho');
    return { t0, t7: !!t7, txt: (t7 ? t7.textContent : '') };
  });
  expect(trilho.t0).toBe(true);
  expect(trilho.t7).toBe(true);
  expect(trilho.txt).toMatch(/vem de/);
  expect(trilho.txt).toMatch(/você está aqui/);
  expect(trilho.txt).toMatch(/alimenta/);

  // glossario abre, lista termos e a busca filtra
  const gloss = await page.evaluate(() => {
    abrirGlossario();
    const nTotal = document.querySelectorAll('#gloss-lista .gloss-item').length;
    filtrarGlossario('arnstein');
    const nFiltro = document.querySelectorAll('#gloss-lista .gloss-item').length;
    const temArnstein = /Arnstein/.test(document.getElementById('gloss-lista').textContent);
    fecharGlossario();
    const fechado = document.getElementById('gloss-overlay').style.display === 'none';
    return { nTotal, nFiltro, temArnstein, fechado };
  });
  expect(gloss.nTotal).toBeGreaterThanOrEqual(12);
  expect(gloss.nFiltro).toBe(1);
  expect(gloss.temArnstein).toBe(true);
  expect(gloss.fechado).toBe(true);
});
