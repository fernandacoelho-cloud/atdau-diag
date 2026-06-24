// tests/partido-diretriz.spec.js
// Onda Partido — gancho verbo→diretriz: cada verbo aplicado a uma peça (no mapa) vira uma
// diretriz na dimensão correspondente (VERBO_GRUPO_DIRCAT). Fecha o fluxo "dado entra uma
// vez e anda" (partido → diretrizes). Idempotente.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Gancho partido→diretriz: verbos das peças viram diretrizes (idempotente)', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  await page.locator('#nav-8').click();   // aba Diretrizes (garante o painel renderizado)
  await page.waitForTimeout(500);

  const r = await page.evaluate(() => {
    state.dir_cats = {};
    _mlFeatures['livres'] = [
      { id: 1, props: { peca: 'conector', rotulo: 'Av. Verde', verbos: ['sel-conectar', 'sel-articular'] } },
      { id: 2, props: { peca: 'corpodagua', rotulo: 'Lagoa', verbos: ['sel-demarcar'] } },
      { id: 3, props: { peca: 'fragmento' } },   // sem verbos → ignorado
    ];
    const n1 = partidoPuxarDiretrizes();
    const urbana = (state.dir_cats['urbana'] || []).map(d => d.text);
    const n2 = partidoPuxarDiretrizes();         // 2ª vez não duplica
    const total = Object.values(state.dir_cats).reduce((s, a) => s + a.length, 0);
    return { n1, n2, urbana, total };
  });
  console.log('partido→diretriz:', r);

  expect(r.n1).toBe(3);                            // 2 verbos (conector) + 1 (corpo d'água)
  expect(r.n2).toBe(0);                            // idempotente
  expect(r.total).toBe(3);
  expect(r.urbana.some(t => /Conectar Conector/.test(t))).toBe(true);
  expect(r.urbana.some(t => /Articular Conector/.test(t))).toBe(true);
  expect(r.urbana.some(t => /Demarcar Corpo d'água/.test(t))).toBe(true);
  expect(r.urbana.every(t => /\[partido\]/.test(t))).toBe(true);
});
