# ATDAU DIAG — projeto local

Suite ATDAU · Ferramenta de Diagnóstico para Pré-Projeto Arquitetônico.
Migrado do claude.ai para desenvolvimento local em Claude Code.

## Como usar este projeto no dia a dia

1. **Editar:** abrir o terminal nesta pasta e rodar `claude` (igual ao T01)
2. **Ver o resultado:** abrir `ATDAU_DIAG_interativo.html` no navegador (duplo clique)
3. **Testar:** `npm test` (roda Playwright e valida funcionalidades)
4. **Versionar:** `git add . && git commit -m "descrição do que mudou"`

## Estrutura

```
atdau-diag/
├── ATDAU_DIAG_interativo.html      # arquivo principal (1.2 MB)
├── package.json                    # dependências (só Playwright pra testes)
├── src/
│   └── mapa-sintese.html           # FONTE do editor Mapa-Síntese (embutido no DIAG em base64)
├── tools/
│   └── embed-ms.py                 # re-embute src/mapa-sintese.html no DIAG (window.MS_B64)
├── tests/
│   └── *.spec.js                   # Playwright: fluxo, mapas, relatório, pictogramas, integrações
├── .gitignore                      # ignora node_modules e backups
├── MIGRATION.md                    # passo-a-passo de instalação (LEIA PRIMEIRO)
└── README.md                       # este arquivo
```

## Como funciona a estratégia "single-file"

O ATDAU_DIAG é mantido como **um único arquivo HTML** para que:

- Você possa enviar por email/WhatsApp para alunos sem precisar de servidor
- Funcione offline (todos os recursos no arquivo)
- Não dependa de build ou bundler

No futuro, se quisermos modularizar (separar JS em arquivos), criamos um script que reúne tudo no final em um único `.html`. Mas por enquanto editamos o arquivo direto.

## Editor Mapa-Síntese (fonte em `src/`)

O editor de partido vive embutido no DIAG (`window.MS_B64`). Para alterá-lo, edite
`src/mapa-sintese.html` e rode:

```bash
python tools/embed-ms.py
```

(`python tools/embed-ms.py --extract` faz o caminho inverso.) Nunca edite o base64 à mão.

A ponte DIAG ↔ editor não usa `localStorage`: aberta de um arquivo (`file://`), a página do editor
nasce de um Blob com origem `null`. O DIAG injeta o pacote do diagnóstico no HTML do editor
(`window.DIAG_HANDOFF`) e o editor devolve o diagrama e as intenções por `postMessage`
(`state.ms_diagrama` / `state.ms_partido`, que vão no "Salvar projeto").
