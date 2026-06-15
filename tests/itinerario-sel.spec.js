// tests/itinerario-sel.spec.js
// Opção A (fiel a Berti): itinerário cultural NÃO é categoria solta — é leitura
// territorial dentro do Paisagismo (paisagem cultural). A categoria 'Paisagístico /
// SEL e paisagem cultural' reúne subtipos SEL + paisagem cultural; escolher um
// subtipo de itinerário (rota) faz cascata para recorte=rota + escopo Patrimonial/
// Cultural. O VUE foi movido p/ a Síntese (após o diagnóstico — Carta de Burra).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Paisagismo/paisagem cultural: itinerário como subtipo cascateia recorte=rota; sem categoria solta', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  // 'itinerario' deixou de ser categoria; Paisagístico reúne SEL + paisagem cultural
  const cat = await page.evaluate(() => {
    const opts = [...document.getElementById('proj-modulo').options].map(o => o.value);
    const sel = document.getElementById('proj-modulo'); sel.value = 'paisagistico'; sel.dispatchEvent(new Event('change'));
    return {
      temItinerario: opts.includes('itinerario'),
      label: [...sel.options].find(o => o.value === 'paisagistico').textContent,
      subs: [...document.getElementById('proj-tipo').options].map(o => o.textContent),
    };
  });
  expect(cat.temItinerario).toBe(false);
  expect(cat.label).toMatch(/paisagem cultural/i);
  expect(cat.subs).toContain('Parque linear');             // SEL
  expect(cat.subs).toContain('Itinerário cultural / rota'); // paisagem cultural

  // escolher subtipo de itinerário → cascata recorte=rota + escopo Patrimonial/Cultural + cartão
  const sub = await page.evaluate(() => {
    const t = document.getElementById('proj-tipo'); t.value = 'Itinerário cultural / rota'; t.dispatchEvent(new Event('change'));
    return {
      recorte: document.getElementById('proj-tipologia-recorte').value,
      escopo: document.getElementById('proj-escopo').value,
      card: /percurso/i.test(document.getElementById('recorte-orientacao').textContent || ''),
    };
  });
  expect(sub.recorte).toBe('rota');
  expect(sub.escopo).toBe('Patrimonial / Cultural');
  expect(sub.card).toBe(true);

  // VUE foi para a Síntese (painel-7), não está mais na Identificação (painel-0)
  const vue = await page.evaluate(() => ({
    inPanel7: !!document.querySelector('#panel-7 #vue-render'),
    inPanel0: !!document.querySelector('#panel-0 #vue-render'),
  }));
  expect(vue.inPanel7).toBe(true);
  expect(vue.inPanel0).toBe(false);
});
