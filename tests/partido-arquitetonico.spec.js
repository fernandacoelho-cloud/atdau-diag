// tests/partido-arquitetonico.spec.js
// Onda Partido (typology-aware): em projeto ARQUITETÔNICO a intervenção é na escala do LOTE —
// NÃO há "peça do SEL". O popup oculta a peça e mostra verbos de lote (forma/volume/topografia/
// programa/paisagem), aplicáveis direto à feição. O partido (verbos sem peça) flui ao resumo.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Partido arquitetônico: sem peça SEL; verbos de lote aplicados direto e fluem ao resumo', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    state['proj-modulo'] = 'arquitetonico';   // escala do lote
    const c = _mlMap.getCenter(); const d = 0.001;
    _mlFeatures['livres'] = [{ id: 779, geom: { type: 'Polygon', coordinates: [[[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]]] }, props: {} }];
    mlRefreshSource('livres');
    mlOpenFeaturePopup('livres', 779, {}, c, ML_LAYERS.find(l => l.id === 'livres'), _mlMap);
  });
  await page.waitForTimeout(250);

  // peça oculta; verbos de lote presentes; verbos de SEL ausentes
  const r1 = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#popup-verbos-box .popup-verb-chip')].map(c => c.dataset.verb);
    return {
      pecaHidden: document.getElementById('popup-peca-box').style.display === 'none',
      hasForma: chips.includes('dilatar'),
      hasVolume: chips.includes('extrair'),
      hasSel: chips.some(v => v.startsWith('sel-')),
    };
  });
  console.log('arquitetônico:', r1);
  expect(r1.pecaHidden).toBe(true);
  expect(r1.hasForma).toBe(true);
  expect(r1.hasVolume).toBe(true);
  expect(r1.hasSel).toBe(false);

  // aplica um verbo SEM peça + motor + rótulo + salva
  const r2 = await page.evaluate(() => {
    document.querySelector('.popup-verb-chip[data-verb="dilatar"]').click();
    document.querySelector('#popup-verbo-motor').value = 'dilatar';
    document.querySelector('#popup-rotulo').value = 'Estar principal';
    document.querySelector('#popup-salvar').click();
    const f = _mlFeatures['livres'].find(x => String(x.id) === '779');
    return { peca: f.props.peca, verbos: f.props.verbos, motor: f.props.verboMotor, rotulo: f.props.rotulo };
  });
  expect(r2.peca == null).toBe(true);          // sem peça do SEL
  expect(r2.verbos).toEqual(['dilatar']);
  expect(r2.motor).toBe('dilatar');

  // flui ao resumo do partido mesmo sem peça
  const resumo = await page.evaluate(() => { renderPartidoResumo(); return document.getElementById('partido-resumo').textContent; });
  expect(resumo).toMatch(/Dilatar/);
  expect(resumo).toContain('Estar principal');
});
