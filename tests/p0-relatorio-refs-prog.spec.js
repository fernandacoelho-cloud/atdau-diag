// tests/p0-relatorio-refs-prog.spec.js
// Onda P0 — defeito de entrega: o Relatório PDF passa a incluir
//   (1) REFERÊNCIAS PROJETUAIS (panel-12): quadro comparativo + fichas + análise
//       gráfica decomposta (texto) + os diagramas/marcas sobre imagem (rasterizados);
//   (2) PROGRAMA (panel-13): além da lista viva, o PROGRAMA DIMENSIONADO
//       (state.prog_ambientes: ambiente/área/capacidade/requisitos + soma) e os
//       REQUISITOS (prog-req-func/desemp/econ).
//
// jsPDF vem de CDN (offline não carrega), então — como em relatorio-visual.spec.js —
// testamos o miolo sem depender da rede: (a) a rasterização SVG→PNG do diagrama
// diretamente; (b) gerarRelatorioPDF com um jsPDF FALSO que grava text()/addImage().
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

// PNG 2×2 válido (base-image do diagrama de análise gráfica)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ACzDhlR0YsgAlpwES8K5x7QAAAABJRU5ErkJggg==';

test('P0: rasterização SVG→PNG do diagrama de análise gráfica funciona offline', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  // expostos pelo refactor
  const fns = await page.evaluate(() => ({
    svg: typeof _diagramaSVGString, png: typeof _svgParaPNG, col: typeof _coletarDiagramasReferencias,
  }));
  expect(fns.svg).toBe('function');
  expect(fns.png).toBe('function');
  expect(fns.col).toBe('function');

  const out = await page.evaluate(async (png) => {
    const diag = { imagem: png, marks: [
      { tipo:'ponto',   pontos:[{x:500,y:350}], categoria:'forma', largura:3, simbolo:'circulo' },
      { tipo:'seta',    pontos:[{x:100,y:100},{x:400,y:300}], categoria:'forma', largura:4 },
      { tipo:'poligono',pontos:[{x:600,y:200},{x:800,y:200},{x:700,y:400}], categoria:'forma', largura:2 },
    ] };
    const svg = _diagramaSVGString(diag, 'pdfd-0');
    const r = await _svgParaPNG(svg, AG_W, AG_H);
    return r ? { ok:true, isPng:/^data:image\/png/.test(r.src), w:r.w, h:r.h, len:r.src.length } : { ok:false };
  }, PNG);
  console.log('rasterização:', { ok: out.ok, isPng: out.isPng, w: out.w, h: out.h, len: out.len });
  expect(out.ok).toBe(true);
  expect(out.isPng).toBe(true);
  expect(out.w).toBe(1000);
  expect(out.h).toBe(700);
  expect(out.len).toBeGreaterThan(1000);
});

test('P0: Relatório PDF inclui referências (quadro+ficha+análise+diagrama) e programa dimensionado+requisitos', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1400);

  const result = await page.evaluate(async (png) => {
    // ── 1) dados de referências (panel-12) ──
    state.analogas = [{
      id: 1, nome: 'OBRA_TESTE_REF', autor: 'Arq. Teste', local: 'Cidade X', fonte: 'FONTE_X',
      area: '1200', terreno: '800', pav: '3',
      programa: 'PROGRAMA_X', partido: 'PARTIDO_X', licao: 'LICAO_PROJETUAL_X',
      analise: {
        'elementos/circulacao': {
          desc: 'DESC_CIRCULACAO observada', esboco: '',
          diagrama: { imagem: png, marks: [
            { tipo:'ponto', pontos:[{x:500,y:350}], categoria:'forma', largura:3, simbolo:'circulo', cor:'#C95F3F' },
          ] },
        },
      },
    }];

    // ── 2) programa (panel-13): lista viva + relações + dimensionado + requisitos ──
    state.programa = [{ id: 11, item: 'ITEM_SALA', area: '40', obs: '' }, { id: 12, item: 'ITEM_COZINHA', area: '20', obs: '' }];
    state.prog_relacoes = { '11|12': 'obrig' };
    state.prog_ambientes = [{ id: 21, nome: 'AMBIENTE_DIM_X', area: '55', ocup: '30 pes.', req: 'REQ_VENTILACAO' }];
    // requisitos + enunciado vão para state via coletarDados (lê do DOM)
    document.getElementById('prog-req-func').value   = 'REQ_FUNC fluxos e setorização';
    document.getElementById('prog-req-desemp').value = 'REQ_DESEMP conforto NBR 15575';
    document.getElementById('prog-req-econ').value   = 'REQ_ECON orçamento e fases';
    document.getElementById('prog-enunciado').value  = 'ENUNCIADO do problema de projeto';

    // ── 3) jsPDF FALSO (grava chamadas; não depende de rede nem baixa arquivo) ──
    const rec = { text: [], addImage: 0, save: null, threw: null };
    class FakePDF {
      constructor(){ this._pages = 1; this.internal = { getNumberOfPages: () => this._pages }; }
      setFont(){ return this; } setFontSize(){ return this; } setTextColor(){ return this; }
      setDrawColor(){ return this; } setLineWidth(){ return this; } setFillColor(){ return this; }
      text(t){ rec.text.push(String(t)); return this; }
      line(){ return this; } rect(){ return this; } circle(){ return this; }
      splitTextToSize(s){ return String(s).split('\n'); }
      addPage(){ this._pages++; return this; }
      addImage(){ rec.addImage++; return this; }
      getImageProperties(){ return { width: 100, height: 100 }; }
      getNumberOfPages(){ return this._pages; }
      setPage(){ return this; }
      save(name){ rec.save = name; return this; }
    }
    window.jspdf = { jsPDF: FakePDF };

    try { await gerarRelatorioPDF(); } catch (e) { rec.threw = (e && e.message) || String(e); }
    return { text: rec.text.join('\n'), addImage: rec.addImage, save: rec.save, threw: rec.threw };
  }, PNG);

  console.log('relatório → addImage:', result.addImage, '· save:', result.save, '· threw:', result.threw);
  expect(result.threw).toBe(null);
  expect(typeof result.save).toBe('string');
  expect(result.save.endsWith('.pdf')).toBe(true);

  const T = result.text;
  // referências projetuais
  expect(T).toContain('Referências projetuais (obras análogas)');
  expect(T).toContain('Quadro comparativo');
  expect(T).toContain('OBRA_TESTE_REF');
  expect(T).toContain('TO aprox. 50%');           // 1200/3 = 400 de projeção; 400/800 = 50%
  expect(T).toContain('LICAO_PROJETUAL_X');
  expect(T).toContain('PARTIDO_X');
  expect(T).toContain('Análise gráfica decomposta');
  expect(T).toContain('DESC_CIRCULACAO observada');
  // programa de necessidades — dimensionado + requisitos
  expect(T).toContain('Programa de necessidades');
  expect(T).toContain('Itens do programa');
  expect(T).toContain('Programa dimensionado');
  expect(T).toContain('AMBIENTE_DIM_X');
  expect(T).toContain('Área útil programada');
  expect(T).toContain('Relações entre ambientes');
  expect(T).toContain('Requisitos do programa');
  expect(T).toContain('REQ_FUNC fluxos e setorização');
  expect(T).toContain('REQ_DESEMP conforto NBR 15575');
  expect(T).toContain('ENUNCIADO do problema de projeto');
  // o diagrama (marcas sobre imagem) entrou como imagem no registro visual
  expect(T).toContain('Registro visual — análise gráfica das referências');
  expect(result.addImage).toBeGreaterThanOrEqual(1);
});
