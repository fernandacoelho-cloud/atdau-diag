// tests/relatorio-doc.spec.js
// Onda D — entrega/documento. gerarRelatorioDOC() produz um relatório .doc editável
// (HTML que Word/LibreOffice/Google Docs abrem), com o MESMO conteúdo do PDF (via o
// emitter compartilhado _emitirRelatorio), sumário (lista de seções) e figuras embutidas.
// Não depende de jsPDF (CDN) — a função retorna o HTML, então testamos offline.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('D1+D3: relatório .doc editável — Word-HTML com sumário, seções e figuras embutidas', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('download', d => { try { d.cancel(); } catch (e) {} });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1300);

  const r = await page.evaluate(async () => {
    document.getElementById('proj-nome').value = 'Projeto DOC';
    document.getElementById('prog-enunciado').value = 'Resolver X no sítio Y.';
    state.analogas = [{ id: 1, nome: 'Obra Ref', partidoTipo: 'Pátio / claustro', aproveitar: 'átrio central' }];
    state.programa = [{ id: 11, item: 'Sala multiuso', area: '40' }];
    state.prog_ambientes = [{ id: 21, origem: 11, nome: 'Sala multiuso', setor: 'publico', qtd: '1', area: '40' }];
    const html = await gerarRelatorioDOC();
    return { html, fn: typeof gerarRelatorioDOC };
  });
  const html = r.html;
  console.log('DOC len:', html.length, '· toc?', /<ol class=toc>/.test(html), '· img?', /<img src="data:image\/png/.test(html));

  // função existe e produz Word-HTML
  expect(r.fn).toBe('function');
  expect(html).toContain('urn:schemas-microsoft-com:office:word');
  expect(html).toContain('application/msword'.length ? 'Relatório de Pré-Projeto' : '');
  expect(html).toContain('Projeto DOC');
  // sumário (D3)
  expect(html).toContain('Sumário');
  expect(html).toMatch(/<ol class=toc>/);
  // seções vindas do mesmo conteúdo do PDF
  expect(html).toContain('Referências projetuais');
  expect(html).toContain('Obra Ref');
  expect(html).toContain('Pátio / claustro');
  expect(html).toContain('Programa de necessidades');
  expect(html).toContain('Resolver X no sítio Y.');
  // figura embutida (organograma rasterizado, pois há setor) → img base64
  expect(html).toMatch(/<img src="data:image\/png/);
  // h2 com âncora de seção
  expect(html).toMatch(/<h2 id="sec\d+">/);
});

test('D2: figuras para prancha — coleta organograma (SVG) + diagramas de referência (PNG)', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('download', d => { try { d.cancel(); } catch (e) {} });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1300);

  const names = await page.evaluate(async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ACzDhlR0YsgAlpwES8K5x7QAAAABJRU5ErkJggg==';
    state.prog_ambientes = [{ id: 1, nome: 'Sala', setor: 'publico', qtd: '1', area: '50' }];   // gera organograma
    state.analogas = [{ id: 9, nome: 'Obra', analise: { 'elementos/circulacao': { desc: 'x', diagrama: { imagem: PNG, marks: [] } } } }];
    const figs = await exportarFigurasPrancha();
    return figs.map(f => f.name);
  });
  console.log('D2 figuras:', names);

  expect(names.some(n => n === 'organograma.svg')).toBe(true);
  expect(names.some(n => n === 'referencia-1.png')).toBe(true);
});
