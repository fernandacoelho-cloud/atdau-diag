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
├── tests/
│   └── draw.spec.js                # teste do sistema de desenho
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
