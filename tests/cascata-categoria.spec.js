// tests/cascata-categoria.spec.js
// Reconciliação dos campos de tipologia da Identificação: a CATEGORIA do projeto
// (proj-modulo) é a fonte — filtra os SUBTIPOS (proj-tipo) pertinentes, reflete no
// ESCOPO (proj-escopo) e, em mudança do usuário, faz cascata para a lógica de
// RECORTE (proj-tipologia-recorte) + cartão percurso/CAU. Tudo persiste no reload
// (inclui correção do restoreModule que rodava antes do carregarDados).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Cascata: Categoria filtra subtipos, reflete escopo e cascateia recorte; persiste', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  // mudar categoria (ação do usuário) → subtipos filtrados + escopo + recorte + cartão
  const pais = await page.evaluate(() => {
    const sel = document.getElementById('proj-modulo'); sel.value = 'paisagistico'; sel.dispatchEvent(new Event('change'));
    return {
      subs: [...document.getElementById('proj-tipo').options].map(o => o.textContent),
      escopo: document.getElementById('proj-escopo').value,
      recorte: document.getElementById('proj-tipologia-recorte').value,
      card: /Percurso de uso sugerido/.test(document.getElementById('recorte-orientacao').textContent || ''),
    };
  });
  expect(pais.subs).toContain('Praça / parque / espaço público');
  expect(pais.subs).not.toContain('Residência unifamiliar'); // filtrado pela categoria
  expect(pais.escopo).toBe('Paisagístico');
  expect(pais.recorte).toBe('pais');
  expect(pais.card).toBe(true);

  // parcelamento filtra para loteamentos
  const parc = await page.evaluate(() => {
    const sel = document.getElementById('proj-modulo'); sel.value = 'parcelamento'; sel.dispatchEvent(new Event('change'));
    document.getElementById('proj-tipo').value = 'Loteamento misto';
    document.getElementById('proj-tipo').dispatchEvent(new Event('change'));
    return { subs: [...document.getElementById('proj-tipo').options].map(o => o.textContent), escopo: document.getElementById('proj-escopo').value };
  });
  expect(parc.subs).toContain('Loteamento misto');
  expect(parc.subs).not.toContain('Residência unifamiliar');
  expect(parc.escopo).toBe('Urbanístico');

  // persiste no reload: módulo, subtipo (válido na categoria), escopo
  await page.waitForTimeout(1400);
  await page.reload();
  await page.waitForTimeout(1700);
  const persist = await page.evaluate(() => ({
    mod: document.getElementById('proj-modulo').value,
    sub: document.getElementById('proj-tipo').value,
    escopo: document.getElementById('proj-escopo').value,
  }));
  expect(persist.mod).toBe('parcelamento');
  expect(persist.sub).toBe('Loteamento misto');
  expect(persist.escopo).toBe('Urbanístico');
});
