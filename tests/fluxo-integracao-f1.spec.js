// tests/fluxo-integracao-f1.spec.js
// 2026-10-03 · FASE 1 da reestruturação: fechar os becos sem saída do fluxo.
//  - Campo (06 · Instrumentos / Matriz de Descobertas) e Obras Análogas (07) geram ACHADOS
//    P/F/O/A que chegam ao SWOT e às Diretrizes (antes só iam ao relatório).
//  - Critérios da matriz das análogas → requisitos do programa e → achados.
//  - Funil alinhado: Leitura → Diretrizes → Programação (e não o inverso).
//  - Referências de aba corrigidas (Mapa de Análise = aba 08).
//  - Relatório: Diretrizes antes do Programa; capítulo "Programação arquitetônica" com matriz 5×4;
//    seção "Rastreabilidade — do achado à diretriz e ao programa".
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrir(page) {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

// Emite o relatório num coletor simples (mesma interface R usada pelo PDF/DOC)
const emitir = page => page.evaluate(() => {
  const out = [];
  const base = { titulo: t => out.push('H1 ' + t), subt: t => out.push('H2 ' + t), p: t => out.push('P ' + t), item: t => out.push('- ' + t) };
  // demais métodos do emissor (capa, figuras, espaço…) são ignorados
  const R = new Proxy(base, { get: (o, k) => (k in o ? o[k] : () => {}) });
  _emitirRelatorio(R, {});
  return out;
});

test('Campo: Matriz de Descobertas → achados → SWOT e Diretrizes', async ({ page }) => {
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await abrir(page);
  await page.locator('#nav-9').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('.subtab')].find(b => /Matriz de Descobertas/.test(b.textContent)); b.click(); });
  await page.waitForTimeout(300);
  await expect(page.locator('#findings-9')).toBeAttached();
  await page.locator('#md-mensagem').fill('Moradores evitam a praça à noite por falta de iluminação');
  await page.locator('#md-curto').fill('Instalar bancos sombreados no acesso');
  await page.evaluate(() => mdPuxarAchados());
  const n = await page.evaluate(() => state.findings[9].length);
  expect(n).toBe(2);
  // puxar de novo não duplica
  await page.evaluate(() => mdPuxarAchados());
  expect(await page.evaluate(() => state.findings[9].length)).toBe(2);
  // achado manual + classificar F
  await page.locator('#inp-f9').fill('Calçada estreita no trecho da escola');
  await page.locator('#inp-f9').press('Enter');
  await page.locator('#findings-9 .finding-item').nth(2).locator('.fc-btn.F').click();
  await page.locator('#findings-9 .finding-item').nth(0).locator('.fc-btn.A').click();

  // chega ao SWOT e às Diretrizes
  await page.locator('#nav-7').click();
  await page.waitForTimeout(400);
  const swot = await page.evaluate(() => document.getElementById('panel-7').innerText);
  expect(swot).toContain('Calçada estreita no trecho da escola');
  expect(swot).toContain('falta de iluminação');
  await page.locator('#nav-8').click();
  await page.waitForTimeout(400);
  const dir = await page.evaluate(() => document.getElementById('dir-summary-bar').innerText);
  expect(dir).toMatch(/Fragilidades:\s*1/);
  expect(dir).toMatch(/Ameaças:\s*1/);
  // menu marca a aba 06 como "com dados"
  expect(await page.evaluate(() => document.getElementById('nav-9').classList.contains('has-data'))).toBe(true);
  // persiste
  await page.evaluate(() => salvar());
  await page.reload(); await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (state.findings[9] || []).length)).toBe(3);
  expect(await page.evaluate(() => getAllFindings().filter(f => f.sec === 9).length)).toBe(3);
  expect(erros).toEqual([]);
});

test('Análogas: critérios → requisitos do programa e → achados; lição → diretriz continua', async ({ page }) => {
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await abrir(page);
  await page.locator('#nav-12').click();
  await page.waitForTimeout(500);
  await expect(page.locator('#findings-12')).toBeAttached();
  await page.evaluate(() => {
    state.analogas = [{ id: 'ob1', nome: 'Sesc Pompeia', aproveitar: 'Rua interna coberta como espaço de encontro', evitar: '' }];
    renderAnalogasPanel();
  });
  // o bloco da matriz começa recolhido: usa a mesma função do botão "+ critério"
  await page.evaluate(() => { const i = document.getElementById('ref-crit-input'); i.value = 'Relação com o entorno'; addRefCriterio(); i.value = 'Permeabilidade térrea'; addRefCriterio(); });
  expect(await page.evaluate(() => state.ref_criterios.length)).toBe(2);
  // meta ★ do projeto = 4 para o 1º critério
  await page.evaluate(() => { const c = state.ref_criterios[0].id; for (let i = 0; i < 4; i++) refMatrizCiclar(c, 'projeto'); });
  const meta = await page.evaluate(() => refMatrizGet(state.ref_criterios[0].id, 'projeto'));
  expect(meta).toBe(4);

  await page.evaluate(() => refCriteriosParaRequisitos());
  const req = await page.evaluate(() => state['prog-req-desemp']);
  expect(req).toContain('Relação com o entorno — meta para o projeto: 4/5');
  expect(req).toContain('Permeabilidade térrea');
  await page.evaluate(() => refCriteriosParaRequisitos()); // idempotente
  expect((await page.evaluate(() => state['prog-req-desemp'])).split('Relação com o entorno').length).toBe(2);

  await page.evaluate(() => refCriteriosComoAchados());
  const ach = await page.evaluate(() => state.findings[12].map(f => [f.class, f.text]));
  expect(ach.length).toBe(2);
  expect(ach[0][0]).toBe('O');
  expect(ach[0][1]).toContain('Relação com o entorno');

  // lição → diretriz (já existia) continua funcionando e fica rastreável (origem ref:)
  await page.evaluate(() => promoverLicaoComoDiretriz('ob1', 'urbana'));
  const d = await page.evaluate(() => state.dir_cats.urbana[0]);
  expect(d.origem).toBe('ref:ob1');
  // aparece na Programação (textarea) e as Diretrizes contam a Oportunidade
  await page.locator('#nav-13').click(); await page.waitForTimeout(400);
  expect(await page.locator('#prog-req-desemp').inputValue()).toContain('Permeabilidade térrea');
  await page.locator('#nav-8').click(); await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.getElementById('dir-summary-bar').innerText)).toMatch(/Oportunidades:\s*2/);
  expect(erros).toEqual([]);
});

test('Funil Leitura → Diretrizes → Programação e referências de aba corrigidas', async ({ page }) => {
  await abrir(page);
  const html = await page.content();
  // os três funis dizem a mesma ordem
  const funis = html.match(/Funil da síntese[\s\S]{0,900}?<\/div>/g) || [];
  expect(funis.length).toBe(3);
  for (const f of funis) {
    const txt = f.replace(/<[^>]+>/g, ' ');
    expect(txt.indexOf('② Diretrizes')).toBeGreaterThan(0);
    expect(txt.indexOf('③ Programação')).toBeGreaterThan(txt.indexOf('② Diretrizes'));
  }
  expect(html).not.toContain('② Problema (Programação)');
  expect(html).not.toContain('(aba 09)');
  expect(html).not.toContain('Painel 06 · Mapa de Análise');
  expect(html).not.toContain('07 · Síntese SWOT');
  expect(html).toContain('Mapa de Análise (aba 08)');
  // a ordem do menu e o texto da Programação concordam (diretrizes = aba anterior)
  expect(html).toContain('com as diretrizes (aba anterior');
});

test('Relatório: Diretrizes antes do Programa, capítulo Programação (5×4) e Rastreabilidade', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => {
    // achado documental classificado → diretriz automática
    state.findings[1].push({ id: 1, text: 'Insolação norte desobstruída no lote', class: 'P' });
    // achado de campo
    state.findings[9].push({ id: 2, text: 'Ruído intenso da avenida no período da tarde', class: 'F', origem: 'walk-through' });
    // análoga → diretriz manual com origem
    state.analogas = [{ id: 'ob1', nome: 'Casa de Vidro', aproveitar: 'Pilotis liberando o térreo', evitar: '' }];
    promoverLicaoComoDiretriz('ob1', 'implantacao');
    // diretriz manual que cria item do programa
    state.programa = [{ id: 'p1', item: 'Pátio coberto', status: 'novo', ajustes: [{ texto: 'Criado a partir da diretriz: Garantir espaço de convívio protegido do ruído', data: '2026-10-03' }] }];
    // matriz 5x4
    state.prog_matriz = { objetivos_funcao: 'Acolher 120 crianças em período integral', fatos_economia: 'Orçamento de R$ 4 mi' };
    state['prog-enunciado'] = 'Dado o lote ruidoso e bem insolado, o projeto deve…';
  });
  const out = await emitir(page);
  const idx = s => out.findIndex(l => l.startsWith(s));
  const iDir = idx('H1 Diretrizes prioritárias'), iRas = idx('H1 Rastreabilidade'), iProg = idx('H1 Programação arquitetônica'), iSwot = idx('H1 Síntese SWOT');
  expect(iSwot).toBeGreaterThan(-1);
  expect(iDir).toBeGreaterThan(iSwot);
  expect(iRas).toBeGreaterThan(iDir);
  expect(iProg).toBeGreaterThan(iRas);
  expect(out).not.toContain('H1 Programa de necessidades');
  // SWOT marca a origem do achado de campo
  expect(out.some(l => /Ruído intenso da avenida.*\[Campo \(Instrumentos\)\]/.test(l))).toBe(true);
  // rastreabilidade: achado → diretriz, ref → diretriz, diretriz → programa
  const ras = out.slice(iRas, iProg).join('\n');
  expect(ras).toMatch(/\[P\] Insolação norte desobstruída no lote\s+→\s+.+\(/);
  expect(ras).toContain('[Ref.] Casa de Vidro  →  Aproveitar: Pilotis liberando o térreo');
  expect(ras).toContain('→  programa: Pátio coberto');
  // programação: matriz 5x4 + enunciado
  const prog = out.slice(iProg).join('\n');
  expect(prog).toContain('H2 Matriz de programação — 5 passos × 4 considerações');
  expect(prog).toContain('Objetivos — Função: Acolher 120 crianças em período integral');
  expect(prog).toContain('Fatos — Economia: Orçamento de R$ 4 mi');
  expect(prog).toContain('H2 Enunciado do problema de projeto');
});
