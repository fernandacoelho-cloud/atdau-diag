// tests/partido-resumo.spec.js
// Onda Partido — resumo do partido no painel Mapa-Síntese (panel-10): lê _mlFeatures e lista
// peças + verbos + verbo motor + oportunidades SbN, SEM tocar no app 3D (base64). Degrau na
// direção "Mapa-Síntese consome o diagnóstico".
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Resumo do partido (panel-10): vazio quando não há partido; lista peças/verbos/motor/SbN quando há', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  // abre o painel Mapa-Síntese → estado vazio
  await page.locator('#nav-10').click();
  await page.waitForTimeout(400);
  const vazio = await page.evaluate(() => document.getElementById('partido-resumo').textContent);
  expect(vazio).toMatch(/ainda não foi montado/i);

  // injeta um partido e re-renderiza
  const r = await page.evaluate(() => {
    _mlFeatures['livres'] = [
      { id: 1, props: { peca: 'conector', rotulo: 'Av. Verde', verbos: ['sel-conectar', 'sel-articular'], verboMotor: 'sel-conectar' } },
      { id: 2, props: { peca: 'matriz', rotulo: 'Fundo de vale' } },
    ];
    _mlFeatures['sbn'] = [{ id: 3, props: {} }];
    renderPartidoResumo();
    return document.getElementById('partido-resumo').textContent;
  });
  console.log('resumo:', r.replace(/\s+/g, ' ').slice(0, 160));

  expect(r).toMatch(/Resumo do partido/);
  expect(r).toMatch(/Verbo motor:\s*Conectar/);
  expect(r).toContain('Conector');     // peça
  expect(r).toContain('Av. Verde');    // rótulo
  expect(r).toContain('Matriz');       // 2ª peça
  expect(r).toMatch(/1 oportunidade/); // SbN
});
