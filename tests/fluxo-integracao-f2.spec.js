// tests/fluxo-integracao-f2.spec.js
// 2026-10-03 · FASE 2: ponte DIAG ↔ Mapa-Síntese (o editor era uma ilha: não lia o diagnóstico).
//  ida   — _diagHandoffGravar() monta terreno/centro, SWOT espacializado, camadas de análise,
//          diretrizes (manuais + automáticas) e programa; o pacote vai INJETADO no HTML do editor
//          (window.DIAG_HANDOFF), porque a página do editor nasce de um Blob e, aberta de um
//          arquivo (file://), tem origem "null" — sem acesso ao localStorage do DIAG.
//  volta — ao salvar, o editor devolve por postMessage as intenções (camada Intenção) E o
//          diagrama inteiro; o DIAG guarda em state.ms_partido / state.ms_diagrama (vai no
//          projeto) e reabre o editor com o diagrama restaurado. Antes, o "Salvar" do editor
//          falhava em silêncio (SecurityError) e o diagrama se perdia.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

const emitir = page => page.evaluate(() => {
  const out = [];
  const base = { titulo: t => out.push('H1 ' + t), subt: t => out.push('H2 ' + t), p: t => out.push('P ' + t), item: t => out.push('- ' + t) };
  _emitirRelatorio(new Proxy(base, { get: (o, k) => (k in o ? o[k] : () => {}) }), {});
  return out;
});

async function abrirEditor(page, context) {
  const [ms] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => abrirMapaSinteseNovaAba())]);
  const alertas = [];
  ms.on('dialog', d => { alertas.push(d.message()); d.dismiss().catch(() => {}); });
  await ms.waitForLoadState('domcontentloaded');
  return { ms, alertas };
}

test('Ida e volta DIAG ↔ Mapa-Síntese (file://, sem localStorage)', async ({ page, context }) => {
  test.setTimeout(150000);
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // diagnóstico no estado (sem precisar abrir o Mapa de Análise)
  await page.evaluate(() => {
    const c = [-43.85, -19.77];
    document.getElementById('proj-nome').value = 'Projeto ponte';   // coletarDados() lê do formulário
    state['ml-lot'] = c;
    state['ml-features'] = {
      swot: [
        { id: 'sw1', geom: { type: 'Polygon', coordinates: [[[c[0], c[1]], [c[0] + .002, c[1]], [c[0] + .002, c[1] + .002], [c[0], c[1] + .002], [c[0], c[1]]]] }, props: { swot: 'F', label: 'Fragilidade', rotulo: 'Ruído da avenida' } },
        { id: 'sw2', geom: { type: 'Point', coordinates: [c[0] + .003, c[1]] }, props: { swot: 'O', label: 'Oportunidade' } },
      ],
      viario: [{ id: 'v1', geom: { type: 'LineString', coordinates: [[c[0] - .004, c[1]], [c[0] + .004, c[1]]] }, props: {} }],
    };
    state.findings[1].push({ id: 1, text: 'Insolação norte desobstruída', class: 'P' });
    state.dir_cats = { implantacao: [{ text: 'Volume baixo junto à rua', pri: 'E' }] };
    state.programa = [{ id: 'p1', item: 'Pátio coberto', area: '80' }];
    document.getElementById('prog-enunciado').value = 'Dado o lote ruidoso, o projeto deve proteger o pátio.';   // coletarDados() lê do formulário
  });
  await page.locator('#nav-10').click();
  await page.waitForTimeout(400);
  const pk = await page.evaluate(() => _diagHandoffGravar(true));
  expect(pk.nome).toBe('Projeto ponte');
  expect(pk.centro).toEqual([-43.85, -19.77]);
  expect(pk.swot.map(s => s.swot)).toEqual(['F', 'O']);
  expect(Object.keys(pk.camadas)).toEqual(['viario']);
  expect(pk.diretrizes.some(d => d.text === 'Volume baixo junto à rua' && d.pri === 'essencial')).toBe(true);
  expect(pk.diretrizes.some(d => d.auto)).toBe(true);           // automática do achado P
  expect(pk.programa).toEqual([{ item: 'Pátio coberto', area: '80' }]);
  await expect(page.locator('#ms-handoff-status')).toContainText('2 feição(ões) SWOT');
  // o botão "puxar diretrizes do partido" saiu da aba Diretrizes e mora aqui
  expect(await page.locator('#panel-8 button', { hasText: 'puxar diretrizes do partido' }).count()).toBe(0);
  expect(await page.locator('#panel-10 button', { hasText: 'puxar diretrizes do partido' }).count()).toBe(1);

  // ── ida: abre o editor; o pacote chega injetado e é importado sozinho
  const { ms, alertas } = await abrirEditor(page, context);
  expect(await ms.evaluate(() => location.origin)).toBe('null');           // o caso real: file:// → Blob
  await ms.waitForFunction(() => document.getElementById('diagBody') && document.getElementById('diagBody').style.display === 'block', null, { timeout: 15000 });
  await expect(ms.locator('#diagDirLista')).toContainText('Volume baixo junto à rua');
  await expect(ms.locator('#diagProgLista')).toContainText('Pátio coberto');
  await expect(ms.locator('#diagEnunTxt')).toContainText('proteger o pátio');
  await ms.waitForFunction(() => typeof map !== 'undefined' && map && map.loaded(), null, { timeout: 30000 });
  await ms.waitForFunction(() => elements.filter(e => e.diagId).length === 2, null, { timeout: 15000 });
  const r = await ms.evaluate(() => ({
    cats: elements.filter(e => e.diagId).map(e => [e.type, e.cat, e.label]),
    base: baseMode,
    camada: !!map.getLayer('diag-viario-line'),
    centro: [+map.getCenter().lng.toFixed(3), +map.getCenter().lat.toFixed(3)],
    camadasUI: document.getElementById('diagCamadas').innerText,
  }));
  expect(r.base).toBe('map');
  expect(r.cats).toEqual([['polygon', 'Fragilidade', 'Ruído da avenida'], ['point', 'Oportunidade', 'Oportunidade']]);
  expect(r.camada).toBe(true);
  expect(r.centro).toEqual([-43.85, -19.77]);
  expect(r.camadasUI).toContain('Sistema Viário');
  // "Trazer do DIAG" de novo não duplica
  await ms.evaluate(() => diagImportar());
  await ms.waitForTimeout(500);
  expect(await ms.evaluate(() => elements.filter(e => e.diagId).length)).toBe(2);

  // ── volta: uma intenção desenhada no editor → 💾 salvar → chega ao DIAG por postMessage
  await ms.evaluate(() => {
    elements.push({ id: newId(), type: 'arrow', x1: 0, y1: 0, x2: 0, y2: 0, cat: 'Eixo estruturante', color: '#15161A', layer: 'intencao', label: 'Eixo de pedestres até a praça', geo: { a: [-43.851, -19.77], b: [-43.848, -19.77] } });
    salvar();
  });
  expect(alertas).toEqual([]);                                             // sem "Erro ao salvar"
  await expect(ms.locator('#canvasHint')).toContainText('salvo no projeto do DIAG');
  await page.waitForFunction(() => state.ms_partido && state.ms_partido.intencoes.length === 1, null, { timeout: 10000 });
  const guardado = await page.evaluate(() => ({ n: state.ms_diagrama.elements.length, tipos: state.ms_diagrama.elements.map(e => e.type) }));
  expect(guardado.n).toBe(3);
  expect(guardado.tipos).toContain('arrow');
  await expect(page.locator('#ms-intencoes-lista')).toContainText('Eixo estruturante');
  await expect(page.locator('#ms-intencoes-lista')).toContainText('Eixo de pedestres até a praça');
  const n = await page.evaluate(() => msIntencoesParaDiretrizes());
  expect(n).toBe(1);
  expect(await page.evaluate(() => msIntencoesParaDiretrizes())).toBe(0);   // idempotente
  const d = await page.evaluate(() => state.dir_cats.urbana);
  expect(d.length).toBe(1);
  expect(d[0].text).toContain('Eixo estruturante: Eixo de pedestres até a praça');
  expect(d[0].origem).toMatch(/^ms:/);
  await ms.close();

  // ── o diagrama persiste no projeto: salvar → recarregar → reabrir o editor restaura tudo
  await page.evaluate(() => salvar());
  await page.reload();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (state.ms_diagrama || {}).elements.length)).toBe(3);
  await page.locator('#nav-10').click();
  await page.waitForTimeout(300);
  await expect(page.locator('#ms-intencoes-lista')).toContainText('Eixo estruturante');
  const { ms: ms2 } = await abrirEditor(page, context);
  await ms2.waitForFunction(() => typeof map !== 'undefined' && map && map.loaded(), null, { timeout: 30000 });
  await ms2.waitForTimeout(800);
  const r2 = await ms2.evaluate(() => ({ n: elements.length, arrow: elements.some(e => e.type === 'arrow' && e.layer === 'intencao'), diag: elements.filter(e => e.diagId).length }));
  expect(r2).toEqual({ n: 3, arrow: true, diag: 2 });    // restaurado, sem duplicar o SWOT
  await ms2.close();

  // relatório: rastreabilidade registra a diretriz do partido
  const out = await emitir(page);
  expect(out.some(l => l.includes('[Partido · Mapa-Síntese]  →  Eixo estruturante: Eixo de pedestres até a praça'))).toBe(true);
});
