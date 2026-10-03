// tests/progresso-abas.spec.js
// 2026-10-03 · Percentuais do menu coerentes. Cada % é "quanto DESTA aba já foi feito" (não somam
// 100). Num projeto vazio apareciam Diretrizes 50%, Governança 60%, Legislação 34%, Mapa 33% —
// contavam seletores de "adicionar item", controles de mapa e valores de referência prontos.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

const pcts = page => page.evaluate(() => { atualizarCompletude(); return Object.fromEntries([...document.querySelectorAll('.sec-nav-item')].map(n => [n.id, n.querySelector('.nav-pct')?.textContent || '-'])); });

test('Projeto vazio: nenhuma aba mostra progresso; preencher move só a aba certa', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL); await page.waitForTimeout(1500);
  for (const id of await page.evaluate(() => [...document.querySelectorAll('.sec-nav-item')].map(n => n.id))) { await page.locator('#' + id).click(); await page.waitForTimeout(150); }
  const vazio = await pcts(page);
  for (const [id, v] of Object.entries(vazio)) expect(['0%', '-', '—'], id + ' = ' + v).toContain(v);
  // legenda explica o que é o %
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.sec-nav'), '::before').content)).toContain('quanto de cada aba');

  // Legislação: valor de referência do Código de Obras só conta quando o aluno confirma (mexe) no campo
  await page.locator('#nav-2').click();
  await page.evaluate(() => { const el = document.getElementById('co-peitoril-dorm'); el.dispatchEvent(new Event('change', { bubbles: true })); });
  expect((await pcts(page))['nav-2']).not.toBe('0%');
  expect(await page.evaluate(() => state.campos_tocados['co-peitoril-dorm'])).toBe(1);

  // Diretrizes: 1 dimensão com diretriz = 10%
  await page.evaluate(() => { state.dir_cats = { implantacao: [{ text: 'x', pri: 'E' }] }; });
  expect((await pcts(page))['nav-8']).toBe('10%');
  // Programação: 2 de 6 etapas (lista + enunciado) = 33%
  await page.evaluate(() => { state.programa = [{ id: 1, item: 'Sala' }]; state['prog-enunciado'] = 'Dado…'; });
  expect((await pcts(page))['nav-13']).toBe('33%');
  // Governança: só os atores (formulário de novo ator não conta) = 1 de 2
  await page.evaluate(() => { state.gov_stakeholders = [{ id: 'a', nome: 'Associação', interesse: '3', influencia: '3' }]; });
  expect((await pcts(page))['nav-15']).toBe('50%');
  // Obras Análogas: 1 de 4 etapas
  await page.evaluate(() => { state.analogas = [{ id: 'o1', nome: 'Obra' }]; });
  expect((await pcts(page))['nav-12']).toBe('25%');
  // o painel de entrada usa a mesma medida
  await page.locator('#nav-0').click(); await page.waitForTimeout(300);
  const dash = await page.evaluate(() => [...document.querySelectorAll('.dash-aba')].find(a => /Diretrizes/.test(a.textContent))?.title);
  expect(dash).toContain('10%');
});
