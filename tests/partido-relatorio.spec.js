// tests/partido-relatorio.spec.js
// Onda Partido — (B): peças do SEL + verbos operativos (+ verbo motor) entram no Relatório.
// Fecha o laço diagnóstico→partido no entregável. Testado via gerarRelatorioDOC (retorna HTML,
// offline) — o mesmo conteúdo vai ao PDF (emissor único _emitirRelatorio).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Partido no relatório: peças + verbos + verbo motor aparecem (.doc)', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('download', d => { try { d.cancel(); } catch (e) {} });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1300);

  const html = await page.evaluate(async () => {
    document.getElementById('proj-nome').value = 'Partido Teste';
    state['proj-modulo'] = 'paisagistico';   // projeto de SEL → título "sistema de espaços livres"
    _mlFeatures['livres'] = [
      { id: 1, geom: { type: 'Point', coordinates: [0, 0] }, props: { peca: 'conector', rotulo: 'Av. Verde', verbos: ['sel-conectar', 'sel-articular'], verboMotor: 'sel-conectar' } },
      { id: 2, geom: { type: 'Point', coordinates: [0, 0] }, props: { peca: 'corpodagua', rotulo: 'Lagoa', verbos: ['sel-demarcar'] } },
    ];
    return await gerarRelatorioDOC();
  });
  console.log('Partido rel:', { tem: /Partido — sistema de espa/.test(html), motor: /Verbo motor: Conectar/.test(html) });

  expect(html).toContain('Partido — sistema de espaços livres');
  expect(html).toContain('Verbo motor: Conectar');
  expect(html).toContain('Conector');           // peça
  expect(html).toContain('Av. Verde');          // rótulo da feição
  expect(html).toContain('Articular');          // 2º verbo (many-to-many)
  expect(html).toContain("Corpo d'água");       // peça 2
  expect(html).toContain('Demarcar');           // verbo da peça 2
});
