// tests/programa-csv.spec.js
// Frente "Programa → CSV": exporta o programa dimensionado (ambientes + áreas + setor +
// capacidade + requisitos + totais + checagem CA/TO) para CSV que abre no Excel/Sheets em pt-BR
// (separador ";", decimal vírgula, BOM). _programaCSVString() é pura (testável offline);
// exportarProgramaCSV() baixa o arquivo. Testa conteúdo, escaping e o download (nome do arquivo).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Programa → CSV: tabela + totais + potencial, formato Excel pt-BR, e download', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);

  // botão de exportar existe no painel do programa
  await expect(page.locator('button[onclick="exportarProgramaCSV()"]')).toHaveCount(1);

  // monta um programa + circulação + potencial do lote (CA/TO) no estado
  const csv = await page.evaluate(() => {
    state['proj-nome'] = 'Escola Teste';
    state['prog-circulacao'] = '25';
    state['l-area-terreno'] = '500';
    state['l-ca'] = '2';
    state['l-to'] = '60';
    state.prog_ambientes = [
      { id: 1, nome: 'Sala de aula', setor: 'publico', qtd: '2', area: '45', pd: '3', ocup: '30 alunos', req: 'ventilação cruzada; luz natural' },
      { id: 2, nome: 'Depósito', setor: 'servico', qtd: '1', area: '12', pd: '', ocup: '', req: '' },
    ];
    return _programaCSVString();
  });
  console.log(csv);

  // BOM no início (Excel abre acentos corretamente)
  expect(csv.charCodeAt(0)).toBe(0xFEFF);

  // cabeçalho com ";" e colunas dimensionais
  expect(csv).toContain('Ambiente;Setor;Qtd;Área unitária (m²);Área total (m²);Pé-direito (m);Capacidade;Requisitos');

  // linha 1: área total = 45 × 2 = 90; decimal com vírgula; requisito com ";" vai entre aspas
  expect(csv).toContain('Sala de aula;Público;2;45,00;90,00;3,0;30 alunos;"ventilação cruzada; luz natural"');
  // linha 2: campos vazios preservados (pé-direito/capacidade/requisitos)
  expect(csv).toContain('Depósito;Serviço;1;12,00;12,00;;;');

  // resumo de áreas (útil 102; circ 25% = 25,50; construída 127,50)
  expect(csv).toContain('Área útil programada (m²);102,00');
  expect(csv).toContain('Circulação e paredes (%);25');
  expect(csv).toContain('Circulação e paredes (m²);25,50');
  expect(csv).toContain('Área construída estimada (m²);127,50');

  // potencial do lote: 500×2 = 1000 (sem separador de milhar); folga 1000 − 127,5 = 872,5; TO 500×60% = 300
  expect(csv).toContain('Área máx. construível pelo CA (m²);1000,00');
  expect(csv).toContain('872,50');
  expect(csv).toContain('Projeção máx. no térreo pela TO (m²);300,00');

  // download de verdade: nome do arquivo derivado do projeto
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => exportarProgramaCSV()),
  ]);
  expect(download.suggestedFilename()).toBe('programa-escola-teste.csv');

  // vazio → não baixa, alerta
  const vazio = await page.evaluate(() => { state.prog_ambientes = []; return _programaCSVString(); });
  expect(vazio).toBe('');
});

test('Programa → XLSX: abas Programa+Resumo com células numéricas (SheetJS falsa, offline)', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);

  await expect(page.locator('button[onclick="exportarProgramaXLSX()"]')).toHaveCount(1);

  const cap = await page.evaluate(async () => {
    // SheetJS falsa: captura o workbook montado sem baixar nada (offline)
    window.XLSX = {
      utils: {
        book_new: () => ({ SheetNames: [], Sheets: {} }),
        aoa_to_sheet: (aoa) => ({ __aoa: aoa }),
        book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
      },
      writeFile: (wb, fname) => { window.__xlsx = { wb, fname }; },
    };
    state['proj-nome'] = 'Escola Teste';
    state['prog-circulacao'] = '25';
    state['l-area-terreno'] = '500'; state['l-ca'] = '2'; state['l-to'] = '60';
    state.prog_ambientes = [
      { id: 1, nome: 'Sala de aula', setor: 'publico', qtd: '2', area: '45', pd: '3', ocup: '30 alunos', req: 'ventilação cruzada; luz natural' },
      { id: 2, nome: 'Depósito', setor: 'servico', qtd: '1', area: '12', pd: '', ocup: '', req: '' },
    ];
    await exportarProgramaXLSX();
    return window.__xlsx;
  });

  expect(cap.fname).toBe('programa-escola-teste.xlsx');
  expect(cap.wb.SheetNames).toEqual(['Programa', 'Resumo']);

  const prog = cap.wb.Sheets['Programa'].__aoa;
  expect(prog[0]).toEqual(['Ambiente', 'Setor', 'Qtd', 'Área unitária (m²)', 'Área total (m²)', 'Pé-direito (m)', 'Capacidade', 'Requisitos']);
  // linha 1 — células numéricas DE VERDADE (não texto)
  expect(prog[1]).toEqual(['Sala de aula', 'Público', 2, 45, 90, 3, '30 alunos', 'ventilação cruzada; luz natural']);
  for (const i of [2, 3, 4, 5]) expect(typeof prog[1][i]).toBe('number');
  // linha 2 — pé-direito vazio vira null (célula em branco)
  expect(prog[2]).toEqual(['Depósito', 'Serviço', 1, 12, 12, null, '', '']);

  const resumo = cap.wb.Sheets['Resumo'].__aoa;
  const val = label => (resumo.find(r => r[0] === label) || [])[1];
  expect(val('Área útil programada (m²)')).toBe(102);
  expect(val('Circulação e paredes (m²)')).toBe(25.5);
  expect(val('Área construída estimada (m²)')).toBe(127.5);
  expect(val('Área máx. construível pelo CA (m²)')).toBe(1000);
  expect(val('Projeção máx. no térreo pela TO (m²)')).toBe(300);
  expect(typeof val('Área útil programada (m²)')).toBe('number');
});
