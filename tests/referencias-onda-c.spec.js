// tests/referencias-onda-c.spec.js
// Onda C — referências profissionais (panel-12). Uma entrega por teste:
//   C1 — ficha profissional: tipologia de partido + aproveitar/evitar separados + citação (DOI/URL/acesso)
//   C2 — promover lição → diretriz (conecta o estudo de referências ao Painel 08)
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('C1: ficha profissional — tipologia de partido, aproveitar/evitar e citação persistem e aparecem na tabela', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    state.analogas = [];
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    set('an-nome', 'SESC Pompéia');
    set('an-partido-tipo', 'Megaestrutura');
    set('an-partido', 'tensão galpão × torres');
    set('an-aproveitar', 'reuso da fábrica existente');
    set('an-evitar', 'circulação confusa no térreo');
    set('an-doi', '10.1234/abc');
    set('an-url', 'https://archdaily.com.br/sesc');
    set('an-acesso', '2026-06-21');
    addAnaloga();
    const o = state.analogas[0];
    return { o, tbl: document.getElementById('an-tabela').textContent, limpou: document.getElementById('an-partido-tipo').value };
  });
  console.log('C1:', { partidoTipo: r.o.partidoTipo, aproveitar: r.o.aproveitar, doi: r.o.doi });

  expect(r.o.partidoTipo).toBe('Megaestrutura');
  expect(r.o.aproveitar).toBe('reuso da fábrica existente');
  expect(r.o.evitar).toBe('circulação confusa no térreo');
  expect(r.o.doi).toBe('10.1234/abc');
  expect(r.o.url).toContain('archdaily');
  expect(r.o.acesso).toBe('2026-06-21');
  // tabela mostra tipologia de partido + aproveitar/evitar
  expect(r.tbl).toContain('Megaestrutura');
  expect(r.tbl).toContain('reuso da fábrica existente');
  expect(r.tbl).toContain('circulação confusa no térreo');
  // formulário limpo após adicionar
  expect(r.limpou).toBe('');
});

test('C2: promover lição → diretriz cria a diretriz no Painel 08 (sem duplicar)', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    state.analogas = [{ id: 1, nome: 'Obra X', aproveitar: 'térreo permeável', evitar: 'fachada cega' }];
    state.dir_cats = {};
    promoverLicaoComoDiretriz(1, 'urbana');
    const arr = (state.dir_cats['urbana'] || []).slice();
    promoverLicaoComoDiretriz(1, 'urbana');   // 2ª vez não deve duplicar
    return { texto: arr[0] && arr[0].text, count1: arr.length, count2: (state.dir_cats['urbana'] || []).length };
  });
  console.log('C2:', r);

  expect(r.count1).toBe(1);
  expect(r.texto).toContain('Aproveitar: térreo permeável');
  expect(r.texto).toContain('Evitar: fachada cega');
  expect(r.texto).toContain('[ref.: Obra X]');
  expect(r.count2).toBe(1);   // idempotente
});

test('C3: matriz de critérios — colunas obras + ★ seu projeto, pontuação cicla 1–5 (e zera em 6)', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    state.analogas = [{ id: 1, nome: 'Obra A' }, { id: 2, nome: 'Obra B' }];
    state.ref_criterios = []; state.ref_matriz = {};
    document.getElementById('ref-crit-input').value = 'relação com o entorno';
    addRefCriterio();
    const cid = state.ref_criterios[0].id;
    // Obra A = 3 (3 cliques); Seu projeto = 5; Obra B = 6 cliques → volta a 0
    refMatrizCiclar(cid, '1'); refMatrizCiclar(cid, '1'); refMatrizCiclar(cid, '1');
    for (let i = 0; i < 5; i++) refMatrizCiclar(cid, 'projeto');
    for (let i = 0; i < 6; i++) refMatrizCiclar(cid, '2');
    const headers = [...document.querySelectorAll('#ref-matriz-criterios thead th')].map(t => t.textContent.trim());
    return {
      critText: state.ref_criterios[0].text,
      scoreA: refMatrizGet(cid, '1'), scoreProj: refMatrizGet(cid, 'projeto'), scoreB: refMatrizGet(cid, '2'),
      hasObraA: headers.some(h => h.includes('Obra A')),
      hasObraB: headers.some(h => h.includes('Obra B')),
      hasProjeto: headers.some(h => h.includes('Seu projeto')),
    };
  });
  console.log('C3:', r);

  expect(r.critText).toBe('relação com o entorno');
  expect(r.scoreA).toBe(3);
  expect(r.scoreProj).toBe(5);
  expect(r.scoreB).toBe(0);            // 6 cliques → cicla de volta a 0
  expect(r.hasObraA).toBe(true);
  expect(r.hasObraB).toBe(true);
  expect(r.hasProjeto).toBe(true);     // coluna ★ Seu projeto
});

test('C4: exportInstrument(obras-analogas) gera JSON estruturado (obras + critérios + matriz)', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('download', d => { try { d.cancel(); } catch (e) {} });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    state.analogas = [{ id: 1, nome: 'Obra A', partidoTipo: 'Pátio / claustro', aproveitar: 'átrio central', doi: '10.1/x' }];
    state.ref_criterios = [{ id: 9, text: 'relação com o entorno' }];
    state.ref_matriz = { '9|1': 4, '9|projeto': 5 };
    state['proj-nome'] = 'Projeto Teste';
    return exportInstrument('obras-analogas');   // retorna o objeto exportado
  });
  console.log('C4:', { obras: r.obras.length, crit: r.criterios.length, matriz: r.matriz_criterios });

  expect(r.instrumento).toBe('obras-analogas');
  expect(r.projeto).toBe('Projeto Teste');
  expect(r.obras.length).toBe(1);
  expect(r.obras[0].nome).toBe('Obra A');
  expect(r.obras[0].partidoTipo).toBe('Pátio / claustro');
  expect(r.obras[0].doi).toBe('10.1/x');
  expect(r.criterios[0].text).toBe('relação com o entorno');
  expect(r.matriz_criterios['9|1']).toBe(4);
  expect(r.matriz_criterios['9|projeto']).toBe(5);
});
