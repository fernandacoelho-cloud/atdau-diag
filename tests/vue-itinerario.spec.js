// tests/vue-itinerario.spec.js
// Avaliação de potencial VUE (UNESCO/ICOMOS) para itinerários culturais: bloco na
// Identificação com 4 dimensões (Espacial/Temporal/Cultural/Propósito) × Baixo/
// Médio/Alto, radar SVG de 4 eixos + leitura textual; persiste via EXTRA_PERSIST_IDS.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('VUE: avaliar 4 dimensões gera radar + leitura e persiste no reload', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const r = await page.evaluate(() => {
    const set = (dim, v) => { const el = document.getElementById('vue-' + dim + '-nivel'); el.value = String(v); el.dispatchEvent(new Event('change')); };
    const jf = document.getElementById('vue-espacial-justif'); jf.value = 'capelas conectadas'; jf.dispatchEvent(new Event('input'));
    set('espacial', 3); set('temporal', 2); set('cultural', 3); set('proposito', 2);
    const host = document.getElementById('vue-render');
    return {
      svg: /<svg/.test(host.innerHTML),
      poligonos: host.querySelectorAll('polygon').length,
      media: /Média:\s*2\.50/.test(host.textContent || ''),
      alto: /Potencial ALTO/.test(host.textContent || ''),
    };
  });
  expect(r.svg).toBe(true);
  expect(r.poligonos).toBeGreaterThanOrEqual(4); // 3 anéis + 1 polígono de dados
  expect(r.media).toBe(true);
  expect(r.alto).toBe(true);

  // persiste no reload (EXTRA_PERSIST_IDS) e o radar é redesenhado no init
  await page.waitForTimeout(1400);
  await page.reload();
  await page.waitForTimeout(1500);
  const persist = await page.evaluate(() => ({
    nivel: document.getElementById('vue-espacial-nivel').value,
    justif: document.getElementById('vue-espacial-justif').value,
    radar: /<svg/.test((document.getElementById('vue-render') || {}).innerHTML || ''),
  }));
  expect(persist.nivel).toBe('3');
  expect(persist.justif).toBe('capelas conectadas');
  expect(persist.radar).toBe(true);
});
