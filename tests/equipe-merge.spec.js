// tests/equipe-merge.spec.js
// Equipe Fatia 2 (merge): junta o arquivo .atdau.json de um colaborador ao projeto
// COMBINANDO POR RESPONSAVEL — traz os campos dos blocos sob responsabilidade dele
// (identificado por "eu sou" no arquivo, casado por nome) + une comentarios e
// anotacoes de campo. Sem servidor.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Equipe merge: traz campos do bloco do colaborador + une comentarios e anotacoes', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);

  // projeto base: Ana e Bia; o bloco do l-ca atribuido a Bia; l-ca vazio
  const setup = await page.evaluate(() => {
    equipeAddColab('Ana'); equipeAddColab('Bia');
    const bia = _equipe().colaboradores.find(c => c.nome === 'Bia');
    _escopoAtribuirIds();
    const escId = document.getElementById('l-ca').closest('[data-escopo-id]').getAttribute('data-escopo-id');
    equipeSetResp(escId, bia.id);
    document.getElementById('l-ca').value = '';
    return { escId };
  });

  // arquivo do colaborador (Bia): l-ca preenchido + comentario + anotacao
  const colabFile = JSON.stringify({
    formato: 'atdau-projeto', versao: 1,
    stores: {
      'atdau-diag-v1': JSON.stringify({ 'l-ca': '2.5', equipe: { colaboradores: [{ id: 'z9', nome: 'Bia' }], euSou: 'z9', comentarios: { [setup.escId]: [{ autor: 'Bia', data: '15/06/2026', texto: 'revisar CA' }] } } }),
      'atdau-diag-mapa-anotado': JSON.stringify({ annotations: [{ id: 'ma-merge-1', category: 'foto', title: 'Ponto da Bia', coords: [-43.8, -19.7] }] }),
    },
  });
  await page.setInputFiles('#equipe-merge-file', { name: 'bia.atdau.json', mimeType: 'application/json', buffer: Buffer.from(colabFile, 'utf8') });
  await page.waitForTimeout(700);

  const r = await page.evaluate((escId) => ({
    lca: document.getElementById('l-ca').value,
    comentario: (state.equipe.comentarios[escId] || []).some(c => /revisar CA/.test(c.texto)),
    anotacao: MapaAnotadoStore.getAll().some(a => a.id === 'ma-merge-1'),
  }), setup.escId);
  expect(r.lca).toBe('2.5');         // campo do bloco da Bia foi trazido
  expect(r.comentario).toBe(true);   // comentario unido
  expect(r.anotacao).toBe(true);     // anotacao unida
});
