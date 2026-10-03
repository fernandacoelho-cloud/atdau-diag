// Gera os prints do guia visual (guia-visual.html) com um projeto-exemplo fictício.
// SHOT_DIR=<pasta> npx playwright test --project=prints  →  python tools/build-guia.py <pasta>
import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');
const OUT = process.env.SHOT_DIR;

const C = [-43.8516, -19.7707];   // centro histórico de Santa Luzia (aprox.)
const d = (dx, dy) => [C[0] + dx, C[1] + dy];
const ring = (pts) => [pts.concat([pts[0]])];
const SEED = {
  'proj-nome': 'Centro Comunitário da Rua Direita',
  'proj-escopo': 'Arquitetônico',
  'ml-lot': C,
  'ml-features': {
    terreno: [{ id: 't1', geom: { type: 'Polygon', coordinates: ring([d(-.0004, -.0003), d(.0004, -.0003), d(.0004, .0003), d(-.0004, .0003)]) }, props: { rotulo: 'Terreno' } }],
    risco: [{ id: 'r1', geom: { type: 'Polygon', coordinates: ring([d(-.0035, -.0028), d(.0005, -.0032), d(.0012, -.0018), d(-.0030, -.0012)]) }, props: { rotulo: 'Várzea do córrego' } }],
    viario: [{ id: 'v1', geom: { type: 'LineString', coordinates: [d(-.004, .0006), d(.004, .0004)] }, props: { rotulo: 'Rua Direita' } }],
    patrim: [{ id: 'p1', geom: { type: 'Point', coordinates: d(.0012, .0011) }, props: { rotulo: 'Igreja Matriz', pictograma: '⛪' } },
             { id: 'p2', geom: { type: 'Point', coordinates: d(-.0015, .0012) }, props: { rotulo: 'Casarão tombado', pictograma: '🏛️' } }],
    livres: [{ id: 'l1', geom: { type: 'Polygon', coordinates: ring([d(.0007, -.0006), d(.0016, -.0006), d(.0016, .0001), d(.0007, .0001)]) }, props: { rotulo: 'Praça' } }],
    swot: [
      { id: 's1', geom: { type: 'Polygon', coordinates: ring([d(-.0035, -.0028), d(.0005, -.0032), d(.0012, -.0018), d(-.0030, -.0012)]) }, props: { swot: 'A', rotulo: 'Inundação' } },
      { id: 's2', geom: { type: 'Point', coordinates: d(.0012, .0011) }, props: { swot: 'O', rotulo: 'Visada para a Matriz' } },
      { id: 's3', geom: { type: 'LineString', coordinates: [d(-.004, .0006), d(.004, .0004)] }, props: { swot: 'F', rotulo: 'Ruído do tráfego' } },
    ],
  },
  findings: {
    1: [{ id: 1, text: 'Terreno a 40 m da várzea do córrego, com histórico de alagamento', class: 'A' },
        { id: 2, text: 'Rua Direita concentra comércio e passagem de pedestres', class: 'O' }],
    2: [{ id: 3, text: 'Zona de proteção do centro histórico: gabarito máximo de 2 pavimentos', class: 'F' }],
    3: [{ id: 4, text: 'Insolação norte desobstruída no fundo do lote', class: 'P' }],
    5: [{ id: 5, text: 'Casario de 1–2 pavimentos no alinhamento, ritmo contínuo de fachadas', class: 'P' }],
    9: [{ id: 6, text: 'Moradores evitam a praça à noite por falta de iluminação', class: 'F', origem: 'Matriz de Descobertas · mensagem-chave' }],
    12: [{ id: 7, text: 'Critério de referência: relação com o entorno (meta 4/5)', class: 'O', origem: 'matriz de critérios' }],
    14: [{ id: 8, text: 'Mancha urbana avançou 18% sobre a várzea entre 2000 e 2022', class: 'A' }],
  },
  analogas: [{ id: 'ob1', nome: 'Sesc Pompeia', autor: 'Lina Bo Bardi', aproveitar: 'Rua interna coberta como espaço de encontro' },
             { id: 'ob2', nome: 'Centro Comunitário de Ibitira', autor: 'exemplo', aproveitar: 'Pátio sombreado aberto ao bairro' }],
  ref_criterios: [{ id: 'c1', text: 'Relação com o entorno' }, { id: 'c2', text: 'Permeabilidade térrea' }],
  dir_cats: {
    implantacao: [{ text: 'Volume baixo no alinhamento, continuando o ritmo do casario', pri: 'E' }],
    programa: [{ text: 'Prever salão multiuso que receba a feira de domingo', pri: 'D' }],
    urbana: [{ text: 'Abrir o térreo para a praça, com passagem coberta', pri: 'E', origem: 'ref:ob1' }],
  },
  programa: [{ id: 'p1', item: 'Salão multiuso', area: '180', status: 'novo', ajustes: [{ texto: 'Criado a partir da diretriz: Prever salão multiuso que receba a feira de domingo' }] },
             { id: 'p2', item: 'Oficinas', area: '90' }, { id: 'p3', item: 'Pátio coberto', area: '240' }],
  prog_ambientes: [{ id: 'a1', nome: 'Salão multiuso', setor: 'publico', qtd: 1, area: 180 }, { id: 'a2', nome: 'Oficinas', setor: 'publico', qtd: 2, area: 45 }, { id: 'a3', nome: 'Copa', setor: 'servico', qtd: 1, area: 20 }],
  prog_relacoes: { 'p1|p3': 'obrig', 'p2|p3': 'desej' },
  'prog-enunciado': 'Dado o lote no centro histórico, junto à várzea e à Rua Direita, o projeto deve acolher a vida comunitária e a feira sem romper o casario nem expor o programa à inundação.',
  swot_narrativa: 'O lote tem boa insolação e está no eixo de passagem da Rua Direita, mas a proximidade da várzea e a proteção do centro histórico limitam a ocupação.',
  migr_estrutura_2026_10: true,
};

test('prints', async ({ page, context }) => {
  test.skip(!OUT, 'defina SHOT_DIR');
  test.setTimeout(240000);
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.setViewportSize({ width: 1440, height: 860 });
  await page.goto(DIAG_URL); await page.waitForTimeout(800);
  await page.evaluate(s => localStorage.setItem('atdau-diag-v1', JSON.stringify(s)), SEED);
  await page.reload(); await page.waitForTimeout(2000);
  await page.evaluate(() => { const t = document.getElementById('tutorial-modal') || document.querySelector('.tut-modal'); if (t) t.style.display = 'none'; document.querySelectorAll('[id*="tutorial"],[class*="tutorial-overlay"]').forEach(e => { if (getComputedStyle(e).position === 'fixed') e.style.display = 'none'; }); });
  const shot = async (nome, fn, full) => { if (fn) await fn(); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${nome}.jpg`, type: 'jpeg', quality: 74, clip: full ? undefined : { x: 240, y: 50, width: 1200, height: 760 } }); };
  const ir = async n => { await page.locator('#nav-' + n).click(); await page.waitForTimeout(600); await page.evaluate(() => window.scrollTo(0, 0)); };

  await ir(0); await shot('01-identificacao');
  await ir(14); await shot('02-dinamica');
  await ir(2); await page.evaluate(() => document.querySelectorAll('#panel-2 .cat-group').forEach((g,i) => g.classList.toggle('cat-open', i===0))); await shot('02b-legislacao');
  await ir(3); await shot('02c-condicionantes');
  // 02 Contexto + mapa do diagnóstico na lente de risco
  await ir(1);
  await page.waitForFunction(() => document.getElementById('lente-wrap').dataset.ready === '1', null, { timeout: 30000 });
  await page.evaluate(() => { const c = document.getElementById('lente-seguir'); c.checked = false; lenteSeguir(false); document.querySelectorAll('#panel-1 .cat-group').forEach(g => g.classList.toggle('cat-open', /Meio Físico/.test(g.textContent))); });
  await page.evaluate(() => { const b = [...document.querySelectorAll('#panel-1 .block')].find(b => /Áreas de risco/.test(b.querySelector('.block-title').textContent)); b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); b.querySelector('.lente-btn').click(); });
  await page.waitForTimeout(2500);
  await shot('03-contexto-lente', null, true);
  // 05 aba fundida
  await ir(5);
  await page.evaluate(() => document.querySelectorAll('#panel-5 .cat-group').forEach(g => g.classList.remove('cat-open')));
  await shot('04-uso-ocupacao');
  // 06 Matriz de Descobertas
  await ir(9);
  await page.evaluate(() => { [...document.querySelectorAll('.subtab')].find(b => /Matriz de Descobertas/.test(b.textContent)).click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = document.getElementById('findings-9').closest('.block'); b.scrollIntoView({ block: 'center' }); });
  await shot('05-campo-achados');
  // 08 Mapa de Análise
  await ir(6);
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.loaded(), null, { timeout: 30000 });
  await page.evaluate(() => { ['risco', 'viario', 'patrim', 'livres', 'swot', 'terreno'].forEach(l => { try { mlToggleLayer(l, true); } catch (e) {} }); _mlMap.jumpTo({ center: [-43.8516, -19.7712], zoom: 15.6 }); });
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.getElementById('ml-map').scrollIntoView({ block: 'center' }));
  await shot('06-mapa-analise');
  // 09 Obras Análogas — matriz de critérios
  await ir(12);
  await page.evaluate(() => { const b = document.getElementById('ref-matriz-criterios').closest('.block'); b.classList.add('block-open'); renderMatrizCriterios(); b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await shot('07-analogas');
  await ir(15); await page.evaluate(() => { state.gov_stakeholders = [{id:'a1',nome:'Associação de Moradores do Centro',tipo:'Sociedade civil',interesse:'3',influencia:'2'},{id:'a2',nome:'Prefeitura · Patrimônio',tipo:'Poder público',interesse:'2',influencia:'3'},{id:'a3',nome:'Feirantes da Rua Direita',tipo:'Usuários',interesse:'3',influencia:'1'}]; govRender(); }); await shot('05b-governanca');
  await ir(7); await shot('08-swot');
  await ir(8);
  await page.evaluate(() => { const c = document.getElementById('dir-cats-container'); c.scrollIntoView({ block: 'start' }); window.scrollBy(0, -150); });
  await shot('09-diretrizes');
  await ir(13);
  await page.evaluate(() => { const o = [...document.querySelectorAll('#panel-13 .block')].find(b => /Programa de necessidades — lista viva/.test(b.textContent)); o && o.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await shot('10-programacao');
  // 13 Mapa-Síntese (editor)
  await ir(10);
  const [ms] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => abrirMapaSinteseNovaAba())]);
  await ms.setViewportSize({ width: 1440, height: 860 });
  await ms.waitForFunction(() => typeof map !== 'undefined' && map && map.loaded() && elements.some(e => e.diagId), null, { timeout: 40000 });
  await ms.waitForTimeout(3500);
  await ms.screenshot({ path: `${OUT}/11-mapa-sintese.jpg`, type: 'jpeg', quality: 74 });
  await ms.close();
});
