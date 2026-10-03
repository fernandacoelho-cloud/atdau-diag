// tests/fusao-0405.spec.js
// 2026-10-03 · FASE 3, fatia 1: abas 04 (Paisagem e Morfologia) e 05 (Ocupação e Usos) fundidas
// na 05 "Uso, Ocupação, Morfologia e Paisagem" (+ uso/GEU/morfologia que estavam na 01).
//  - cada tema aparece uma vez; blocos duplicados somem; grupos recolhíveis
//  - projeto salvo ANTES da fusão é migrado sem perda (campos → observações; achados 04 → 05;
//    escopo por posição → por título)
//  - menu: Dinâmica abre o levantamento documental; numeração contínua 01–13; selos de fonte
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Estrutura: aba 05 fundida, sem temas repetidos, menu numerado e selos de fonte', async ({ page }) => {
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.goto(DIAG_URL);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const titulos = id => [...document.querySelectorAll('#' + id + ' .block-title')].map(t => t.textContent.trim());
    const todos = [...document.querySelectorAll('.panel .block-title')].map(t => t.textContent.trim());
    return {
      p4: !!document.getElementById('panel-4'), nav4: !!document.getElementById('nav-4'),
      p5: titulos('panel-5'), p1: titulos('panel-1'),
      grupos5: [...document.querySelectorAll('#panel-5 .cat-group .cat-title')].map(t => t.textContent),
      nav: [...document.querySelectorAll('.sec-nav-item')].map(n => n.textContent.trim().replace(/\s*\d+%$/, '')),   // ignora o % de completude
      sumiram: todos.filter(t => /^(Morfologia urbana do entorno|Altimetria e densidade construtiva|Achados — Paisagem e Morfologia)/.test(t)),
      selos: [...document.querySelectorAll('#panel-5 .selo-fonte')].map(s => s.textContent),
      seloRisco: document.querySelector('#panel-1 .block-title') && [...document.querySelectorAll('#panel-1 .block')].find(b => /Áreas de risco/.test(b.textContent))?.querySelector('.selo-fonte')?.textContent,
      tituloAba: document.querySelector('#panel-5 .sec-title').textContent.trim(),
    };
  });
  expect(r.p4).toBe(false);
  expect(r.nav4).toBe(false);
  expect(r.sumiram).toEqual([]);
  expect(r.tituloAba).toMatch(/^05 · Uso, Ocupação, Morfologia e Paisagem/);
  for (const t of ['Uso e ocupação do solo no entorno', 'Levantamento de usos do solo', 'Vazios urbanos', 'Grandes equipamentos urbanos', 'Análise de Morfologia Urbana', 'Morfologia e estrutura urbana', 'Leitura da imagem urbana', 'Campos visuais e paisagem', 'Achados — Uso, Ocupação, Morfologia e Paisagem'])
    expect(r.p5.some(x => x.startsWith(t)), t).toBe(true);
  for (const t of ['Uso e ocupação do solo no entorno', 'Grandes equipamentos urbanos', 'Morfologia e estrutura urbana'])
    expect(r.p1.some(x => x.startsWith(t)), 'saiu da 01: ' + t).toBe(false);
  expect(r.grupos5).toEqual(['Uso e ocupação do solo', 'Morfologia urbana', 'Paisagem e imagem urbana', 'Síntese']);
  expect(r.nav.slice(2)).toEqual(['01 · Dinâmica Territorial', '02 · Contexto Urbano', '03 · Legislação', '04 · Condicionantes Ambientais', '05 · Uso, Ocupação e Morfologia', '06 · Instrumentos de Coleta', '07 · Governança e Participação', '08 · Mapa de Análise', '09 · Obras Análogas', '10 · Síntese SWOT', '11 · Diretrizes', '12 · Programação Arquitetônica', '13 · Mapa-Síntese (Partido)']);
  expect(r.selos).toContain('🚶 campo');                 // levantamento de usos, imagem urbana…
  expect(r.selos).toContain('📄 documental');            // grandes equipamentos
  expect(r.seloRisco).toBe('📄 documental');
  // o bloco de morfologia da 01 não repete mais quadras/figura-fundo (ficam nas 6 dimensões)
  expect(await page.locator('#mod-urb-quadra, #mod-urb-quadra-dim, #r-mod-figura-fundo').count()).toBe(0);
  expect(await page.locator('#mod-urb-densidade, #mod-urb-ca-med').count()).toBe(2);
  expect(erros).toEqual([]);
});

test('Migração: projeto salvo antes da fusão não perde nada', async ({ page }) => {
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.goto(DIAG_URL);
  await page.waitForTimeout(800);
  // estado no formato antigo (aba 04 + Altimetria + bloco de morfologia com quadras, escopo por posição)
  await page.evaluate(() => {
    const antigo = {
      'm-tracado': 'Irregular / orgânico', 'm-lote': 'Lotes estreitos e profundos (tipo corredor)',
      'm-cheiovazio': 'Quarteirões densos, poucos vazios internos', 'm-carater': 'Centro histórico com casario colonial',
      'o-alt': '1–2 pavimentos', 'o-padrao': 'Alvenaria rebocada, telhado cerâmico',
      'mod-urb-quadra': 'Quarteirão histórico colonial', 'mod-urb-quadra-dim': '60×90m',
      'morf-fg-obs': 'Texto que já existia',
      ratings: { 'r-dens': 'Alta', 'r-mod-figura-fundo': 'Cheio' },
      findings: { 1: [], 2: [], 3: [], 4: [{ id: 7, text: 'Visada para a serra a partir da praça', class: 'P' }], 5: [{ id: 8, text: 'Comércio no térreo da rua principal', class: 'O' }], 14: [] },
      escopo: { blocos: { 'esc-4-0': false, 'esc-5-1': false, 'esc-1-0': false }, campos: {} },
    };
    localStorage.setItem('atdau-diag-v1', JSON.stringify(antigo));
  });
  await page.reload();
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => ({
    migrado: state.migr_estrutura_2026_10,
    tracado: state['morf-tracado-obs'], parc: state['morf-parc-obs'], fg: state['morf-fg-obs'], tipo: state['morf-tipo-obs'],
    uiFg: document.getElementById('morf-fg-obs').value,
    f4: (state.findings[4] || []).length, f5: state.findings[5].map(f => [f.text, f.class, f.origem || '']),
    swot: document.getElementById('panel-7') ? getAllFindings().map(f => f.text) : [],
    esc: state.escopo.blocos,
    lynchAtivo: (() => { const b = [...document.querySelectorAll('#panel-5 .block[data-escopo-id]')].find(b => /Leitura da imagem urbana/.test(b.textContent)); return b ? escopoBlocoAtivo(b.getAttribute('data-escopo-id')) : null; })(),
    usosAtivo: (() => { const b = [...document.querySelectorAll('#panel-5 .block[data-escopo-id]')].find(b => /^Levantamento de usos do solo/.test(b.querySelector('.block-title').textContent.trim())); return b ? escopoBlocoAtivo(b.getAttribute('data-escopo-id')) : null; })(),
  }));
  expect(r.migrado).toBe(true);
  expect(r.tracado).toBe('Traçado urbano predominante: Irregular / orgânico');
  expect(r.parc).toContain('Tipologia de lote predominante: Lotes estreitos e profundos (tipo corredor)');
  expect(r.parc).toContain('Tipologia predominante das quadras: Quarteirão histórico colonial');
  expect(r.parc).toContain('Tamanho médio das quadras: 60×90m');
  expect(r.fg.split('\n')[0]).toBe('Texto que já existia');      // o que já havia fica em primeiro
  expect(r.fg).toContain('Relação cheio-vazio: Quarteirões densos, poucos vazios internos');
  expect(r.fg).toContain('Densidade construtiva do entorno: Alta');
  expect(r.fg).toContain('Proporção cheios/vazios (figura-fundo): Cheio');
  expect(r.uiFg).toBe(r.fg);                                    // aparece no formulário
  expect(r.tipo).toContain('Caráter e identidade do entorno: Centro histórico com casario colonial');
  expect(r.tipo).toContain('Altura predominante das edificações vizinhas: 1–2 pavimentos');
  expect(r.tipo).toContain('Padrão construtivo predominante: Alvenaria rebocada, telhado cerâmico');
  expect(r.f4).toBe(0);
  expect(r.f5).toEqual([['Comércio no térreo da rua principal', 'O', ''], ['Visada para a serra a partir da praça', 'P', 'antiga aba Paisagem e Morfologia']]);
  expect(r.swot).toContain('Visada para a serra a partir da praça');
  // escopo: 'esc-4-0' era "Leitura da imagem urbana", 'esc-5-1' era "Levantamento de usos do solo"
  expect(Object.keys(r.esc).every(k => !/^esc-\d+-\d+$/.test(k))).toBe(true);
  expect(r.lynchAtivo).toBe(false);
  expect(r.usosAtivo).toBe(false);
  // roda uma vez só: recarregar não duplica as linhas migradas
  await page.reload(); await page.waitForTimeout(1500);
  expect(await page.evaluate(() => state['morf-parc-obs'].split('Tamanho médio das quadras').length)).toBe(2);
  expect(erros).toEqual([]);
});
