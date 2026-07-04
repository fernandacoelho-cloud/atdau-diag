// tests/save-indicator.spec.js
// Regra de design (descobribilidade/feedback): o salvamento automático deixa de ser silencioso.
// Indicador persistente na topbar (#save-indic): "✓ salvo HH:MM"; mostra % de armazenamento
// quando alto (fotos/áudios base64 enchem o localStorage) e estado de erro acionável quando
// o salvar falha (quota). Também: ação importante nunca é só-ícone ("✏️ desenhar").
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Indicador de salvamento: hora + quota alta + estado de erro', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);

  // existe na topbar, ao lado do botão Salvar
  await expect(page.locator('#save-indic')).toHaveCount(1);

  // salvar → "✓ salvo HH:MM"
  await page.evaluate(() => salvar());
  const t1 = await page.locator('#save-indic').textContent();
  expect(t1).toMatch(/✓ salvo \d{2}:\d{2}/);

  // quota alta (força _lsUsagePct) → alerta de armazenamento no indicador
  await page.evaluate(() => { window._lsUsagePct = () => 85; salvar(); });
  const t2 = await page.locator('#save-indic').textContent();
  expect(t2).toContain('armazenamento 85%');
  expect(t2).toContain('⚠');

  // falha de quota → estado de erro com a ação a tomar (salvar em arquivo)
  await page.evaluate(() => {
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    try { salvar(); } finally { localStorage.setItem = orig; }
  });
  const t3 = await page.locator('#save-indic').textContent();
  expect(t3).toContain('não salvo');
  expect(t3).toContain('Salvar projeto');

  // volta ao normal no próximo salvar bem-sucedido
  await page.evaluate(() => { window._lsUsagePct = () => 10; salvar(); });
  expect(await page.locator('#save-indic').textContent()).toMatch(/^✓ salvo \d{2}:\d{2}$/);

  // regra "nunca só-ícone": o botão de desenhar da análise gráfica tem rótulo de texto
  expect(await page.content()).toContain('✏️ desenhar');
});
