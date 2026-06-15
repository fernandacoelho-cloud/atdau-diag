// tests/governanca.spec.js
// Governanca e Participacao Comunitaria (Mansfeld, L5): painel novo (15) com
// stakeholders (lista viva), matriz interesse x influencia (Mendelow) e campos de
// participacao (VS/NGT). Painel nucleo (nao escopavel). Persiste no state.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Governanca: stakeholder cai no quadrante Mendelow certo + persiste; categoria de reuniao', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);

  const r = await page.evaluate(() => {
    irPara(15, document.getElementById('nav-15'));
    const navOk = document.getElementById('panel-15').classList.contains('active');
    document.getElementById('gov-nome').value = 'Associacao de Moradores';
    document.getElementById('gov-interesse').value = '3';
    document.getElementById('gov-influencia').value = '3';
    govAddStakeholder();
    return {
      navOk,
      naLista: /Associacao de Moradores/.test(document.getElementById('gov-stakeholders-lista').textContent),
      noQuad: /Gerir de perto[\s\S]*Associacao de Moradores/.test(document.getElementById('gov-matriz').textContent),
      catReuniao: MA_CATEGORIES.some(c => c.id === 'ponto-reuniao'),
      n: (state.gov_stakeholders || []).length,
    };
  });
  expect(r.navOk).toBe(true);
  expect(r.naLista).toBe(true);
  expect(r.noQuad).toBe(true);       // alta influencia + alto interesse -> gerir de perto
  expect(r.catReuniao).toBe(true);
  expect(r.n).toBe(1);

  // persiste no reload (state.gov_stakeholders + campo de texto)
  await page.evaluate(() => { document.getElementById('gov-metas').value = 'ampliar feira'; document.getElementById('gov-metas').dispatchEvent(new Event('input')); salvar(); });
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForTimeout(1700);
  const persist = await page.evaluate(() => {
    irPara(15, document.getElementById('nav-15'));
    return { n: (state.gov_stakeholders || []).length, lista: /Associacao de Moradores/.test(document.getElementById('gov-stakeholders-lista').textContent), metas: document.getElementById('gov-metas').value };
  });
  expect(persist.n).toBe(1);
  expect(persist.lista).toBe(true);
  expect(persist.metas).toBe('ampliar feira');
});
