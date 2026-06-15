// tests/itinerario-sel.spec.js
// A discussão SEL + itinerário cultural reverbera agora na Categoria/subtipos:
// - nova Categoria 'Itinerário cultural / Rota' (proj-modulo=itinerario) com subtipos
//   de rota, escopo Patrimonial/Cultural, cascata p/ recorte=rota e ativa o bloco de
//   Pesquisa histórica;
// - 'Paisagístico' relabel → '/ Sistema de espaços livres (SEL)' com subtipos SEL.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Itinerário cultural e SEL como categorias: subtipos, cascata e bloco histórico', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  const itin = await page.evaluate(() => {
    const sel = document.getElementById('proj-modulo');
    const temOpcao = [...sel.options].some(o => o.value === 'itinerario');
    sel.value = 'itinerario'; sel.dispatchEvent(new Event('change'));
    const hist = [...document.querySelectorAll('.module-block')].find(b => /Pesquisa histórica/.test(b.textContent));
    return {
      temOpcao,
      subs: [...document.getElementById('proj-tipo').options].map(o => o.textContent),
      escopo: document.getElementById('proj-escopo').value,
      recorte: document.getElementById('proj-tipologia-recorte').value,
      histAtivo: hist ? hist.classList.contains('mod-active') : false,
    };
  });
  expect(itin.temOpcao).toBe(true);
  expect(itin.subs).toContain('Rota de peregrinação');
  expect(itin.escopo).toBe('Patrimonial / Cultural');
  expect(itin.recorte).toBe('rota');
  expect(itin.histAtivo).toBe(true);

  const sel = await page.evaluate(() => {
    const s = document.getElementById('proj-modulo'); s.value = 'paisagistico'; s.dispatchEvent(new Event('change'));
    return {
      label: [...s.options].find(o => o.value === 'paisagistico').textContent,
      subs: [...document.getElementById('proj-tipo').options].map(o => o.textContent),
    };
  });
  expect(sel.label).toMatch(/SEL/);
  expect(sel.subs).toContain('Parque linear');
  expect(sel.subs).toContain('Corredor verde / ecológico');

  // persistência do itinerário (módulo + subtipo)
  await page.evaluate(() => {
    const s = document.getElementById('proj-modulo'); s.value = 'itinerario'; s.dispatchEvent(new Event('change'));
    const t = document.getElementById('proj-tipo'); t.value = 'Rota de peregrinação'; t.dispatchEvent(new Event('change'));
  });
  await page.waitForTimeout(1400);
  await page.reload();
  await page.waitForTimeout(1700);
  const persist = await page.evaluate(() => ({ mod: document.getElementById('proj-modulo').value, sub: document.getElementById('proj-tipo').value }));
  expect(persist.mod).toBe('itinerario');
  expect(persist.sub).toBe('Rota de peregrinação');
});
