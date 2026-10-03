// tests/persistencia-campos.spec.js
// 2026-10-03 · REGRESSÃO de perda de dados: FIELDS/EXTRA_PERSIST_IDS eram listas feitas à mão e
// ~120 campos dos formulários (orientação solar, zona bioclimática, ventos, dados climáticos,
// morfologia em 6 dimensões, imagem urbana, vazios, módulos, Código de Obras…) não eram salvos.
// Preenche TODO campo com id de Identificação, Viabilidade e Diagnóstico, salva, recarrega
// (e abre cada aba, para os campos gerados por JS) e exige que nada tenha se perdido.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');
const PAINEIS = [0, 11, 1, 2, 3, 5];

test('Todo campo dos formulários do diagnóstico sobrevive a salvar + recarregar', async ({ page }) => {
  test.setTimeout(120000);
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL); await page.waitForTimeout(1500);
  // abre cada aba uma vez (alguns campos são gerados ao abrir)
  for (const n of PAINEIS) { await page.evaluate(n => irPara(n, document.getElementById('nav-' + n)), n); await page.waitForTimeout(150); }
  const preenchidos = await page.evaluate(() => {
    const out = [];
    _persistEls().forEach(el => {
      if (/^(checkbox|radio|range|color)$/.test(el.type)) return;
      if (el.id === 'proj-escopo') return;   // derivado do tipo de projeto (restoreModule o recalcula ao carregar)
      let v;
      if (el.tagName === 'SELECT') {
        const opts = [...el.options].filter(o => (o.value || o.textContent.trim()) && !/selecione/i.test(o.textContent));
        if (!opts.length) return;
        const o = opts[opts.length - 1]; el.value = o.value || o.textContent; v = el.value; if (!v) return;
      } else if (el.type === 'number') { el.value = '7'; v = '7'; }
      else if (el.type === 'date') { el.value = '2026-10-03'; v = el.value; }
      else { el.value = 'v-' + el.id; v = el.value; }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      out.push({ id: el.id, v, bloco: (el.closest('.block')?.querySelector('.block-title')?.textContent || '').trim().slice(0, 50) });
    });
    salvar();
    return out;
  });
  expect(preenchidos.length).toBeGreaterThan(250);
  await page.reload(); await page.waitForTimeout(1800);
  for (const n of PAINEIS) { await page.evaluate(n => irPara(n, document.getElementById('nav-' + n)), n); await page.waitForTimeout(150); }
  const perdidos = await page.evaluate(list => list.filter(f => { const el = document.getElementById(f.id); return el && el.value !== f.v; }).map(f => f.id + ' (' + f.bloco + ')'), preenchidos);
  expect(perdidos, 'campos que se perderam ao recarregar').toEqual([]);
  // essenciais citados no relatório e no pacote do T01
  expect(await page.evaluate(() => [state['a-orient'], state['a-zb']].every(Boolean))).toBe(true);
});

test('Campo ainda não restaurado não é sobrescrito pelo valor padrão', async ({ page }) => {
  await page.goto(DIAG_URL); await page.waitForTimeout(800);
  await page.evaluate(() => localStorage.setItem('atdau-diag-v1', JSON.stringify({ 'morf-fg-obs': 'meu texto salvo' })));
  await page.reload(); await page.waitForTimeout(1500);
  // simula um campo que "nasce" sem o dado (não restaurado) e um salvamento em seguida
  await page.evaluate(() => { const el = document.getElementById('morf-fg-obs'); delete el.dataset.persistOk; el.value = ''; salvar(); });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('atdau-diag-v1'))['morf-fg-obs'])).toBe('meu texto salvo');
});

// As demais abas guardam os dados em estruturas próprias (obras, diretrizes, programa, atores, fichas
// dos instrumentos); os campos soltos delas são de "adicionar item" e se esvaziam de propósito.
// Este teste garante que NADA além desses campos de entrada se perde ao recarregar.
const PAINEIS_2 = [14, 9, 15, 12, 7, 8, 13];
const CAMPOS_DE_ADICIONAR = /^(inp-f\d+|inp-dir-|pri-dir-|prog-(item|area|obs)$|gov-(nome|tipo)$|an-|ref-crit-input$|ma-edit-|(stationary-mapping|mapa-comportamental)-(custom-|perfil-count))/;
test('Demais abas: só os campos de "adicionar item" voltam vazios (nenhum dado se perde)', async ({ page }) => {
  test.setTimeout(180000);
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL); await page.waitForTimeout(1500);
  const abrirTudo = async () => {
    for (const n of PAINEIS_2) {
      await page.evaluate(n => irPara(n, document.getElementById('nav-' + n)), n); await page.waitForTimeout(250);
      if (n === 9) await page.evaluate(() => document.querySelectorAll('#panel-9 .subpanel').forEach(s => s.classList.add('active')));
    }
  };
  await abrirTudo();
  const preenchidos = await page.evaluate(P => {
    const out = [];
    P.forEach(n => document.querySelectorAll('#panel-' + n + ' input[id], #panel-' + n + ' textarea[id], #panel-' + n + ' select[id]').forEach(el => {
      if (/^(file|hidden|button|submit|checkbox|radio|range|color)$/.test(el.type)) return;
      if (el.closest('.maplibregl-popup, #ml-vinculo-modal, .block-map-wrap')) return;
      let v;
      if (el.tagName === 'SELECT') { const o = [...el.options].filter(o => (o.value || o.textContent.trim()) && !/selecione/i.test(o.textContent)).at(-1); if (!o) return; el.value = o.value || o.textContent; v = el.value; if (!v) return; }
      else if (el.type === 'number') { el.value = '7'; v = '7'; }
      else if (el.type === 'date') { el.value = '2026-10-03'; v = el.value; }
      else { el.value = 'v-' + el.id; v = el.value; }
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      out.push({ id: el.id, v });
    }));
    salvar();
    return out;
  }, PAINEIS_2);
  expect(preenchidos.length).toBeGreaterThan(150);
  await page.waitForTimeout(800);
  await page.reload(); await page.waitForTimeout(2000);
  await abrirTudo();
  const perdidos = await page.evaluate(list => list.filter(f => { const el = document.getElementById(f.id); return el && el.value !== f.v; }).map(f => f.id), preenchidos);
  expect(perdidos.filter(id => !CAMPOS_DE_ADICIONAR.test(id)), 'dados que se perderam ao recarregar').toEqual([]);
});

