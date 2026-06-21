// tests/pdf-footer.spec.js
// Regressão do rodapé do Relatório PDF: rodape(p) recebe o número da página e é
// carimbado UMA vez por página (só no loop final; novaPagina não chama mais rodape).
// Antes, rodape() usava getNumberOfPages() (o TOTAL) e era chamado em novaPagina E no
// loop → páginas 1..N saíam com número errado e sobreposto. jsPDF é CDN-only, então
// usamos um jsPDF falso que grava as chamadas text() (como em p0-relatorio-refs-prog).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Rodapé do PDF: um por página, com número correto e sem duplicação', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1300);

  const r = await page.evaluate(async () => {
    // texto longo → força várias páginas (a narrativa do SWOT entra no relatório)
    state.swot_narrativa = ('Lorem ipsum dolor sit amet consectetur adipiscing elit. ').repeat(400);

    const rec = { text: [], pages: 0 };
    class FakePDF {
      constructor() { this._pages = 1; this.internal = { getNumberOfPages: () => this._pages }; }
      setFont() { return this; } setFontSize() { return this; } setTextColor() { return this; }
      setDrawColor() { return this; } setLineWidth() { return this; } setFillColor() { return this; }
      text(t) { rec.text.push(String(t)); return this; }
      line() { return this; } rect() { return this; } circle() { return this; }
      // quebra por palavras p/ que textos longos virem muitas linhas → paginam
      splitTextToSize(s) {
        const out = []; let line = '';
        String(s).split(/\s+/).forEach(w => {
          if ((line + ' ' + w).length > 60) { out.push(line); line = w; }
          else line = line ? line + ' ' + w : w;
        });
        if (line) out.push(line);
        return out.length ? out : [''];
      }
      addPage() { this._pages++; return this; }
      addImage() { return this; }
      getImageProperties() { return { width: 100, height: 100 }; }
      getNumberOfPages() { return this._pages; }
      setPage() { return this; }
      save() { rec.pages = this._pages; return this; }
    }
    window.jspdf = { jsPDF: FakePDF };
    await gerarRelatorioPDF();

    const full = rec.text;
    const labelCount = full.filter(t => t === 'Suite ATDAU · Pré-Projeto (01-01)').length;
    const counts = [];
    for (let i = 1; i <= rec.pages; i++) counts.push(full.filter(t => t === ('pág. ' + i)).length);
    const totalPag = full.filter(t => /^pág\. \d+$/.test(t)).length;
    return { pages: rec.pages, labelCount, counts, totalPag };
  });
  console.log('footer:', r);

  expect(r.pages).toBeGreaterThanOrEqual(2);          // multipágina, p/ o teste ter sentido
  expect(r.labelCount).toBe(r.pages);                 // um rótulo de rodapé por página
  expect(r.counts.every(c => c === 1)).toBe(true);    // pág. 1..N — cada número exatamente uma vez
  expect(r.totalPag).toBe(r.pages);                   // nada duplicado
});
