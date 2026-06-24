// tests/sel-verbos.spec.js
// Onda Partido — Etapa 3 (typology-aware): em tipologia de SEL (paisagístico/urbano) o popup
// mostra a PEÇA + os verbos SEL (Tardin) como chips múltiplos (many-to-many) + verbo motor.
// Os verbos NÃO dependem mais da peça (aparecem pelos grupos relevantes à tipologia).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Etapa3 (SEL): vários verbos por peça + verbo motor, persistem e reabrem', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(600);

  // tipologia de SEL + injeta feição e abre o popup
  await page.evaluate(() => {
    state['proj-modulo'] = 'paisagistico';
    const c = _mlMap.getCenter(); const d = 0.001;
    _mlFeatures['livres'] = [{ id: 778, geom: { type: 'Polygon', coordinates: [[[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]]] }, props: {} }];
    mlRefreshSource('livres');
    mlOpenFeaturePopup('livres', 778, {}, c, ML_LAYERS.find(l => l.id === 'livres'), _mlMap);
  });
  await page.waitForTimeout(250);

  // peça visível (SEL) + verbos SEL presentes (não dependem da peça)
  const r1 = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#popup-verbos-box .popup-verb-chip')];
    const sel = document.querySelector('#popup-peca'); if (sel) sel.value = 'conector';
    return {
      pecaVisible: document.getElementById('popup-peca-box').style.display !== 'none',
      verbs: chips.map(c => c.dataset.verb),
    };
  });
  console.log('Etapa3 SEL chips:', r1.verbs.slice(0, 8));
  expect(r1.pecaVisible).toBe(true);
  expect(r1.verbs).toContain('sel-conectar');
  expect(r1.verbs).toContain('sel-articular');

  // aplica 2 verbos + motor + salva
  const r2 = await page.evaluate(() => {
    document.querySelector('.popup-verb-chip[data-verb="sel-conectar"]').click();
    document.querySelector('.popup-verb-chip[data-verb="sel-articular"]').click();
    document.querySelector('#popup-verbo-motor').value = 'sel-conectar';
    document.querySelector('#popup-salvar').click();
    const f = _mlFeatures['livres'].find(x => String(x.id) === '778');
    return { peca: f.props.peca, verbos: (f.props.verbos || []).slice().sort(), motor: f.props.verboMotor };
  });
  expect(r2.peca).toBe('conector');
  expect(r2.verbos).toEqual(['sel-articular', 'sel-conectar']);
  expect(r2.motor).toBe('sel-conectar');

  // reabrir → chips ativos refletem o salvo
  await page.evaluate(() => {
    const c = _mlMap.getCenter();
    const f = _mlFeatures['livres'].find(x => String(x.id) === '778');
    mlOpenFeaturePopup('livres', 778, f.props, c, ML_LAYERS.find(l => l.id === 'livres'), _mlMap);
  });
  await page.waitForTimeout(250);
  const r3 = await page.evaluate(() => ({
    ativos: [...document.querySelectorAll('#popup-verbos-box .popup-verb-chip.active')].map(c => c.dataset.verb).sort(),
    motor: document.querySelector('#popup-verbo-motor')?.value,
  }));
  expect(r3.ativos).toEqual(['sel-articular', 'sel-conectar']);
  expect(r3.motor).toBe('sel-conectar');
});
