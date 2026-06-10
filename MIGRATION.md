# MIGRATION.md — Como instalar e começar

Guia passo-a-passo para Windows. Cada passo tem o comando exato pra copiar e colar, e o que esperar ver.

## Pré-requisitos (você já tem)

- [x] Claude Code instalado (você já usa para o T01)
- [x] Git instalado
- [x] Node.js instalado (vem junto com o Claude Code)

## Passo 1 — Escolher onde a pasta vai morar

Onde está o T01 hoje? Provavelmente em algo como `C:\Users\Fernanda\Documents\atdau-t01\` ou similar.

A DIAG vai ficar como **pasta irmã**, no mesmo nível. Exemplo de organização final:

```
C:\Users\Fernanda\Documents\
    ├── atdau-t01\               (já existe)
    └── atdau-diag\              (vamos criar agora)
```

**Não coloque dentro do T01.** São projetos separados, com Git separado.

---

## Passo 2 — Criar a pasta e descompactar este zip

1. Abra o **Explorador de Arquivos** do Windows
2. Vá até a pasta onde está o T01 e suba um nível (clique em `..` ou no nome da pasta-pai na barra de endereço)
3. Clique direito → **Nova pasta** → digite `atdau-diag` → Enter
4. Entre na pasta `atdau-diag` recém-criada
5. Descompacte o conteúdo do `atdau-diag-pack.zip` aqui dentro

Depois disso a pasta deve ter:

```
atdau-diag\
    ATDAU_DIAG_interativo.html
    package.json
    .gitignore
    README.md
    MIGRATION.md
    tests\
        draw.spec.js
```

---

## Passo 3 — Abrir o terminal NA PASTA

**Modo fácil (recomendado):**

1. Abra a pasta `atdau-diag` no Explorador de Arquivos
2. Clique direito num espaço vazio dentro da pasta (não em cima de arquivo nenhum)
3. Escolha **"Abrir no Terminal"** ou **"Open in Terminal"**

Se essa opção não aparecer:

1. Pressione `Windows + R`
2. Digite `powershell` e Enter
3. No PowerShell, digite `cd "C:\caminho\completo\para\atdau-diag"` (use o caminho real)
4. Confirme que está na pasta certa rodando `dir` (deve listar os arquivos do passo 2)

---

## Passo 4 — Inicializar o Git

No terminal aberto na pasta, copie e cole cada linha abaixo, uma por vez, e dê Enter:

```powershell
git init
```

Esperado ver: `Initialized empty Git repository in ...`

```powershell
git add .
```

(sem saída, é normal)

```powershell
git commit -m "Estado inicial herdado do claude.ai (hash ae38453e)"
```

Esperado ver: algo como `[main (root-commit) abc1234] Estado inicial...` com lista de arquivos.

**Pronto. A DIAG agora está versionada.**

---

## Passo 5 — Instalar Playwright (para testes automatizados)

Ainda no mesmo terminal:

```powershell
npm install
```

Esperado ver: várias linhas correndo, depois algo tipo `added 4 packages in 3s`. Pode demorar 1-2 minutos na primeira vez.

```powershell
npx playwright install chromium
```

Esperado ver: download de ~150 MB do Chromium (navegador headless). Demora alguns minutos. Aguarde terminar.

**Se aparecer pergunta sobre permissão de rede, autorize.**

---

## Passo 6 — Rodar o primeiro teste

```powershell
npm test
```

Esperado ver:

```
Running 1 test using 1 worker
  ✓  tests/draw.spec.js:5:5 › DIAG abre e mostra botões de mapa (Xs)
  1 passed (Xs)
```

Se aparecer **✓ passed** = tudo funcionando. Pode pular para o passo 7.

Se aparecer **✗ failed** = me cole aqui o erro inteiro que eu te ajudo a corrigir.

---

## Passo 7 — Abrir o Claude Code na pasta

No mesmo terminal:

```powershell
claude
```

Vai abrir a interface do Claude Code (igual ao T01).

A primeira mensagem que você manda pra mim pode ser:

> "DIAG migrada. Estado: ae38453e. Quero validar que o sistema de desenho está funcionando de verdade no navegador. Por favor abra ATDAU_DIAG_interativo.html, encontre o sistema de block-map e me explique como vamos testar polígono."

A partir daí eu trabalho do mesmo jeito que faço no T01.

---

## Como ver a DIAG no navegador (durante o desenvolvimento)

Enquanto eu (Claude Code) edito o arquivo, você abre uma janela do navegador com o HTML local:

1. No Explorador de Arquivos, vá até `atdau-diag\`
2. Duplo clique em `ATDAU_DIAG_interativo.html`
3. Vai abrir no seu navegador padrão (Chrome/Edge)

**Toda vez que eu fizer uma edição,** você só precisa apertar **F5** ou **Ctrl+R** no navegador para recarregar e ver o resultado.

Para abrir o console de debug (DevTools), aperte **F12** no navegador. Aba "Console" mostra erros JavaScript em vermelho. Se algo quebrar, você copia a mensagem inteira e cola pra mim.

---

## Comandos do dia a dia

Depois de tudo configurado, no terminal dentro da pasta `atdau-diag\`:

| Quero... | Comando |
|---|---|
| Conversar com Claude Code | `claude` |
| Rodar todos os testes | `npm test` |
| Ver o que mudou desde o último commit | `git status` e `git diff` |
| Salvar mudanças no histórico | `git add . && git commit -m "descrição"` |
| Ver histórico de mudanças | `git log --oneline` |
| Voltar para versão anterior (cuidado) | `git checkout HASH_DO_COMMIT` |

---

## E se eu quiser desinstalar tudo?

Só apagar a pasta `atdau-diag\` inteira. Nada fica no sistema fora dela (exceto o Chromium do Playwright em `%USERPROFILE%\AppData\Local\ms-playwright\` que ocupa ~150 MB e pode ser deletado manualmente).

---

## Problemas comuns

**"comando não reconhecido" ao rodar `git` ou `npm`**
Significa que git ou Node não estão no PATH do sistema. Reinicie o terminal. Se persistir, reinstale Git e Node pelos sites oficiais (git-scm.com e nodejs.org).

**"EACCES" ou erro de permissão no `npm install`**
Tente rodar o PowerShell **como Administrador** (clique direito no PowerShell → Executar como administrador).

**Antivírus bloqueia download do Chromium**
Pause temporariamente o antivírus durante o `npx playwright install chromium` e reative depois.

**Playwright reclama que não acha o arquivo HTML**
Confirme que `ATDAU_DIAG_interativo.html` está na raiz da pasta `atdau-diag\` (não dentro de subpasta).

---

## Dúvidas?

Cole a dúvida ou o erro no Claude Code que eu te ajudo na hora.
