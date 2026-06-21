// tests/programa-onda-b.spec.js
// Onda B — programa profissional (panel-13). Cada teste cobre uma entrega:
//   B1+B2 — campos estruturados (setor / qtd / pé-direito) + % circulação e área
//           construída estimada automática.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('B1+B2: programa dimensionado com setor/qtd/pé-direito + circulação → área construída', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    state.prog_ambientes = [
      { id: 1, nome: 'Sala multiuso', setor: 'publico', qtd: '2', area: '30', pd: '3.5', ocup: '40 pes.', req: 'acústica' },
      { id: 2, nome: 'Copa de apoio', setor: 'servico', qtd: '1', area: '10', pd: '2.7', ocup: '', req: '' },
    ];
    state['prog-circulacao'] = '20';
    const ci = document.getElementById('prog-circulacao'); if (ci) ci.value = '20';
    renderProgAmbientes();
    const headers = [...document.querySelectorAll('#prog-ambientes thead th')].map(t => t.textContent.trim());
    const selects = [...document.querySelectorAll('#prog-ambientes tbody select')].map(s => s.value);
    const firstCellStyle = document.querySelector('#prog-ambientes tbody tr td')?.getAttribute('style') || '';
    const total = document.getElementById('prog-total').textContent;
    return { headers, selects, firstCellStyle, total, areas: _progAreas() };
  });
  console.log('B1+B2:', { headers: r.headers, selects: r.selects, areas: r.areas });

  // colunas estruturadas novas
  const H = r.headers.join('|');
  expect(r.headers).toContain('Setor');
  expect(r.headers).toContain('Qtd');
  expect(H).toContain('Pé-dir');
  expect(H).toContain('Área un');
  // setor persistido nos selects + linha colorida por setor
  expect(r.selects).toEqual(['publico', 'servico']);
  expect(r.firstCellStyle).toContain('border-left');
  // áreas: útil = 30×2 + 10×1 = 70; circulação 20% = 14; construída = 84
  expect(r.areas.util).toBe(70);
  expect(r.areas.pct).toBe(20);
  expect(r.areas.circ).toBeCloseTo(14, 1);
  expect(r.areas.construida).toBeCloseTo(84, 1);
  expect(r.total).toContain('70');
  expect(r.total).toContain('84');
  expect(r.total).toMatch(/constru/i);
});

test('B1+B2: % circulação e qtd persistem no estado e recalculam ao vivo', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    state.prog_ambientes = [{ id: 1, nome: 'A', setor: '', qtd: '1', area: '100', pd: '', ocup: '', req: '' }];
    renderProgAmbientes();
    // muda circulação ao vivo
    progSetCirculacao('30');
    const apos30 = _progAreas();
    // muda qtd via progAmbInput (como o oninput da célula)
    progAmbInput('1', 'qtd', '3');
    const aposQtd = _progAreas();
    return {
      circPersist: state['prog-circulacao'],
      apos30, aposQtd,
    };
  });
  console.log('persist:', r);
  expect(r.circPersist).toBe('30');
  // 100 × 1, +30% = 130
  expect(r.apos30.util).toBe(100);
  expect(r.apos30.construida).toBeCloseTo(130, 1);
  // qtd 3 → útil 300, +30% = 390
  expect(r.aposQtd.util).toBe(300);
  expect(r.aposQtd.construida).toBeCloseTo(390, 1);
});

test('B3: checagem do programa × potencial do terreno (CA/TO) com alerta de excesso', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    // Legislação: terreno 200 m², CA 1.2 → máximo construída 240 m²; TO 50% → projeção máx 100 m²
    document.getElementById('l-area-terreno').value = '200';
    document.getElementById('l-ca').value = '1.2';
    document.getElementById('l-to').value = '50';
    const ci = document.getElementById('prog-circulacao'); if (ci) ci.value = '';
    state['prog-circulacao'] = '';
    // programa que CABE: útil 100 → construída 100 ≤ 240
    state.prog_ambientes = [{ id: 1, nome: 'A', setor: 'publico', qtd: '1', area: '100', pd: '', ocup: '', req: '' }];
    renderProgAmbientes();
    const cabe = document.getElementById('prog-checagem').textContent;
    const pot = _progPotencial();
    // agora EXCEDE: qtd 3 → útil 300 → construída 300 > 240
    state.prog_ambientes = [{ id: 1, nome: 'A', setor: 'publico', qtd: '3', area: '100', pd: '', ocup: '', req: '' }];
    renderProgAmbientes();
    const excede = document.getElementById('prog-checagem').textContent;
    return { cabe, excede, pot };
  });
  console.log('B3:', { cabe: r.cabe.slice(0, 90), excede: r.excede.slice(0, 90), pot: r.pot });

  expect(r.pot.terreno).toBe(200);
  expect(r.pot.ca).toBe(1.2);
  expect(r.pot.maxCA).toBeCloseTo(240, 1);
  // cabe → verde, mostra o máximo (240) e a projeção pela TO
  expect(r.cabe).toMatch(/Cabe|folga/i);
  expect(r.cabe).toContain('240');
  expect(r.cabe).toMatch(/Proje/i);
  // excede → alerta
  expect(r.excede).toMatch(/Excede|falta/i);
});

test('B4: organograma — bolhas por setor + adjacências da matriz, rasterizável p/ o PDF', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(async () => {
    // lista viva (a matriz é dela) + relações; o dimensionado referencia via origem
    state.programa = [{ id: 11, item: 'Foyer' }, { id: 12, item: 'Sala' }, { id: 13, item: 'Copa' }];
    state.prog_relacoes = { '11|12': 'obrig', '11|13': 'desej' };
    state.prog_ambientes = [
      { id: 1, origem: 11, nome: 'Foyer', setor: 'publico', qtd: '1', area: '80' },
      { id: 2, origem: 12, nome: 'Sala multiuso', setor: 'publico', qtd: '1', area: '120' },
      { id: 3, origem: 13, nome: 'Copa', setor: 'servico', qtd: '1', area: '15' },
    ];
    renderOrganograma();
    const host = document.getElementById('prog-organograma');
    const circles = host.querySelectorAll('svg circle.org-bubble').length;   // só as bolhas (não os swatches da legenda)
    const lines = host.querySelectorAll('svg line.org-rel').length;          // só as relações
    const txt = host.textContent;
    // rasterização p/ o relatório
    const svg = _organogramaSVGString();
    const m = svg.match(/width="(\d+)" height="(\d+)"/);
    const png = await _svgParaPNG(svg, +m[1], +m[2]);
    return {
      circles, lines,
      hasPublico: txt.includes('Público'), hasServico: txt.includes('Serviço'),
      hasLegenda: txt.includes('Setores') && txt.includes('Relações') && txt.includes('obrigatória') && txt.includes('evitar'),
      pngOk: !!png && /^data:image\/png/.test(png.src),
    };
  });
  console.log('B4:', r);
  // uma bolha por ambiente
  expect(r.circles).toBe(3);
  // duas relações → duas linhas
  expect(r.lines).toBe(2);
  // setores rotulados
  expect(r.hasPublico).toBe(true);
  expect(r.hasServico).toBe(true);
  // legenda de cores (setores) e tipos de linha (relações)
  expect(r.hasLegenda).toBe(true);
  // entra no relatório como imagem
  expect(r.pngOk).toBe(true);
});

test('B5: template por tipologia gera programa base (lista + dimensionado c/ setor) sem duplicar', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  // por subtipo: Residência unifamiliar
  const r = await page.evaluate(() => {
    state.programa = []; state.prog_ambientes = []; state.prog_relacoes = {};
    state['proj-tipo'] = 'Residência unifamiliar';
    const dt = document.getElementById('proj-tipo'); if (dt) dt.value = 'Residência unifamiliar';
    gerarProgramaTemplate();
    const prog1 = state.programa.length, amb1 = state.prog_ambientes.length;
    const nomes = state.prog_ambientes.map(a => a.nome);
    const setores = [...new Set(state.prog_ambientes.map(a => a.setor))].sort();
    gerarProgramaTemplate(); // 2ª vez não deve duplicar
    return { prog1, amb1, nomes, setores, prog2: state.programa.length };
  });
  console.log('B5:', { prog1: r.prog1, setores: r.setores, prog2: r.prog2 });
  expect(r.prog1).toBeGreaterThan(5);
  expect(r.amb1).toBe(r.prog1);          // lista viva e dimensionado em paralelo
  expect(r.nomes).toContain('Suíte');
  expect(r.nomes).toContain('Cozinha');
  expect(r.setores).toEqual(expect.arrayContaining(['publico', 'servico', 'intimo']));
  expect(r.prog2).toBe(r.prog1);         // idempotente

  // fallback por categoria: paisagístico → praça/parque
  const r2 = await page.evaluate(() => {
    state.programa = []; state.prog_ambientes = [];
    state['proj-tipo'] = ''; const dt = document.getElementById('proj-tipo'); if (dt) dt.value = '';
    state['proj-modulo'] = 'paisagistico'; const dm = document.getElementById('proj-modulo'); if (dm) dm.value = 'paisagistico';
    gerarProgramaTemplate();
    return { nomes: state.prog_ambientes.map(a => a.nome) };
  });
  expect(r2.nomes).toContain('Playground');
});
