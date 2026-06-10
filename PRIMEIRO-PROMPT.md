# Primeiro prompt para colar no Claude Code

Quando você abrir o Claude Code (`claude` no terminal dentro de `atdau-diag\`),
cole o texto abaixo como sua primeira mensagem para que eu chegue
contextualizada e pronta para trabalhar:

---

**INÍCIO DO PROMPT (copie tudo abaixo desta linha):**

Olá. Sou Fernanda Coelho. Acabei de migrar a Suite ATDAU DIAG do claude.ai
para desenvolvimento local.

Contexto:

- Estou na pasta atdau-diag/ no Windows
- Trabalho com o ATDAU T01 no Claude Code há meses
- DIAG é uma ferramenta web single-file (HTML+JS+CSS) de cerca de 1,2 MB
  para diagnóstico de pré-projeto arquitetônico, parte da Suite ATDAU
- Estado herdado: hash ae38453e (última versão produzida no claude.ai)
- Já temos Playwright configurado em tests/draw.spec.js

Antes de qualquer coisa, por favor:

1. Confirme que está vendo os arquivos da pasta (rode ls ou dir)
2. Rode npm test para validar o estado de partida
3. Cole o resultado pra mim
4. Aguarde minha próxima instrução antes de fazer qualquer edição

Não modifique nada ainda. Quero validar o ponto de partida primeiro.

**FIM DO PROMPT (não copie esta linha)**

---

## Depois disso

Quando o teste rodar e tudo estiver OK, podemos atacar os pendentes
do claude.ai que ainda precisam de validação real no navegador:

1. Sistema de desenho com polígono em todas as camadas
2. Editor de opacidade/espessura/tipo de linha por feature
3. Legenda flutuante que inicia oculta
4. Popup de bens tombados com 9 atalhos de pesquisa
5. Hillshade nos block-maps de topo/risco/água
