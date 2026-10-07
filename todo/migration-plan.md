# Migração do painel do Apps Script

> **Status: superseded.** Este plano descrevia o `gs-form/` antigo (apagado no
> commit `dfe149f`) e a portagem para TS/Preact. O painel foi reespecificado do
> zero — **`src_gas/`, React 19 + TanStack Router + Tailwind v4, ver `cms_spec.md`**
> — e as correções de auditoria marcadas aqui como "planejada" foram absorvidas
> como requisito da nova spec (§8). O que não foi absorvido está listado em
> `cms_spec.md` §14.

Objetivo: levar o painel de `gs-form` (servidor em JS solto na raiz + painel em
`innerHTML` manual) para **TypeScript estrito em `src/server/*.ts`**, **UI em
Preact**, **Tailwind v4** e saída compilada em **`gs-form/dist/`**.

O Apps Script não compila TypeScript e não faz bundle de módulos: o servidor é
transpilado arquivo a arquivo, preservando `const X = {...}` no escopo global. O
cliente é o único que vira bundle (`iife`), porque `google.script.run` exige
`function api*` no topo.

## Estado do build

```
gs-form/
  src/
    server/   Api.ts Auth.ts Code.ts Events.ts Files.ts Lock.ts Publish.ts Slug.ts Tools.ts
    ui/
      admin/  main.tsx app.tsx components/ views/ lib/gas.ts admin.css index.html
      login/  main.tsx login.css index.html
    shared/   theme.css
  dist/       rootDir do clasp: *.js, index.html, login.html, appsscript.json
  build.mjs   esbuild -> tailwind -> inline -> dist/
```

Comandos:

```
bun run gs:build    # compila tudo para gs-form/dist/
bun run gs:check    # typecheck estrito + typecheck da UI + prettier + build --check
```

`dist/` não é commitado. O `clasp push` envia só ele, via `"rootDir": "dist"` no
`.clasp.json`.

## Decisões

- **bun** de vez: `pnpm-lock.yaml` e `pnpm-workspace.yaml` removidos,
  `packageManager` fora do `package.json`, `allowBuilds` virando
  `trustedDependencies`.
- **Preact com `strict: true`** no servidor e na UI.
- **`deploy.mjs` reescrito** como validar + `clasp push`. Não cria mais versão
  pela API do Apps Script (o script antigo criava uma versão órfã e saía com
  erro em 100% das execuções).
- Tokens de cor/fonte **compartilhados com o site**: `src/shared/theme.css`
  importa `src/styles/tokens.css`. Alterar uma cor muda o site e o painel.

## Bug corrigido que causou o incidente

### `Files.nextName_` nunca casava com o próprio output

O scanner de serial usava `/^(\d{3})-/`, com um hífen que o nome gerado
(`${serial}${ext}` → `001.jpg`) não tem. O padrão nunca casava, `max` ficava `0`
para sempre e **toda** foto do evento recebia o nome `001.jpg`.

Como o nome é a chave de tudo, um único defeito produziu seis sintomas:

| Onde                       | Efeito com N fotos de mesmo nome                                         |
| -------------------------- | ------------------------------------------------------------------------ |
| `Events.computeStatus`     | `filter(p => p.name !== cover_name)` → `0` → "não tenho foto adicionada" |
| `Publish.buildPublication` | mesmo filtro → `gallery: []` na publicação                               |
| `uploadedTile` (UI)        | `cover.name === p.name` → todas as tiles marcadas como capa              |
| `Events.setCover`          | `filter(...)[0]` → sempre a primeira, nunca a escolhida                  |
| `Events.removePhoto`       | `filter(f => f.name !== name)` → remove todas as entradas                |
| `Files.removePhoto`        | `getFilesByName` em `while` → **lixeira todas as fotos do Drive**        |

Corrigido para `/^(\d{3})\./`. Coberto por teste de regressão.

### `clientId` nunca era enviado pelo painel

`readPayload` montava `{data, name, type}` e o `Api.js` esperava `clientId` para
o dedup de reenvio. Sem ele, `Events.appendPhoto` nunca reconhecia um reenvio e
cada "Reenviar" criava um segundo arquivo no Drive com outra entrada na
galeria. Agora cada arquivo da fila ganha um `clientId` estável no navegador.

## Débito conhecido (Fase 0, ainda não feita)

Dano nos dados do evento com 22 fotos: as 22 estão chamadas `001.jpg` na
planilha e no Drive.

- **Não clicar "Remover"** nesse evento até o reparo: `Files.removePhoto` usa
  `getFilesByName` e joga todas no lixo.
- A capa registrada aponta para a primeira entrada da lista, não para a foto
  escolhida.

O reparo é `repairPhotoNames(slug?, aplicar?)`: percorre a galeria na ordem do
JSON, renomeia cada arquivo **pelo `id`** (nunca por nome) e regrava a linha.
Idempotente, com dry-run por padrão e relatório no console. Está implementado em
`src/server/Tools.ts` e valida o dry-run no editor antes de gravar:

```
repairPhotoNames()                       // só relata
repairPhotoNames(null, true)             // aplica em todos
repairPhotoNames('yara-e-ataide', true)  // aplica em um
```

`republishEvent(slug)` cobre o outro caso: foto registrada na galeria e ainda
privada no Drive, por `Files.publish_` ter falhado.

## Débito de auditoria (Fase 0, ainda não feita)

Achados da auditoria completa do servidor, em ordem de gravidade. Todos em
`src/server/*.ts` agora; a linha muda a cada commit, então o símbolo é o
referência estável.

### Crítico

- **`Api.apiUploadPhoto`** — `Files.publish_` fica fora do `try`. Se falhar, a
  entrada fica na galeria e o arquivo privado: o site é publicado com imagem 403. O retry reusa o mesmo `clientId`, cai no dedup silencioso de
  `Events.appendPhoto` e **nunca repara** a entrada original. _Correção
  planejada: pre-flight do dedup antes de criar no Drive; `appendPhoto` devolve
  `{appended}`; `publish_` com retentativas e erro explícito; `Tools.republishEvent_`._
- **`Api.apiUploadPhoto`** — `Files.savePhoto` roda fora do lock. Duas abas leem
  `max=5`, criam dois `006.jpg` e a galeria fica com nomes repetidos (o que
  religa todos os sintomas da tabela acima). _Correção planejada: um único
  `Lock.withScriptLock_` por upload cobrindo nome + `createFile` + `appendPhoto`,
  com `Events.appendPhotoLocked_` interno._
- **`Events.sheet_`** — `alignHeaders_` roda no caminho de leitura e faz
  `setValues` + `deleteColumns` sem lock. Duas execuções concorrentes reconstroem
  contra `lastCol` obsoleto e podem deslocar ou apagar dados. _Correção
  planejada: sai de `sheet_()`, vai para `ensureSetup_()` sob
  `getDocumentLock`, chamada do `doGet`; `sheet_()` memoiza a aba por execução._

### Alto

- **Limite de 50.000 caracteres por célula** — `gallery` é JSON numa célula só.
  A 400 fotos dá ~52.800 caracteres e o `setValues` lança. Como `setRow_`
  regrava a linha inteira, o evento fica **permanentemente ineditável**: update,
  troca de capa e status falham para sempre. Estouro em ~379 fotos com nome
  típico. `Files.MAX_PHOTOS = 400` está acima do ponto de estouro. _Correção
  planejada: `label` ≤ 120 e `clientId` ≤ 64, `MAX_PHOTOS` lowered, e guarda
  explícita no `appendPhoto` com erro legível no lugar do estouro do Sheets._
- **Trava do painel por ataque** — o throttle é global em deployment anônimo
  (`failureKey_` cai num contador único). `2^7 * 5 = 640`, com teto de 600 s:
  **7 requisições travam o painel por 10 minutos**. O comentário em
  `Auth.login` está errado: `assertNotThrottled_` roda _antes_ de comparar a
  senha, então nem a senha certa passa, e `clearFailedLogins_` é inalcançável
  durante o cooldown. _Correção planejada: senha correta sempre passa; o cooldown
  só trava tentativa errada; teto cai para 120 s e a contagem decai com o tempo._
- **Sessão morre em 6 h** — `CacheService.put` tem teto de 21.600 s, não 30 dias
  como está escrito em `Auth.SESSION_TTL_S`. A sessão de 7 dias é impossível e
  pode ser despejada antes. _Correção planejada: TTL = 21600 com renovação
  deslizante a cada chamada autenticada._
- **Célula corrompida perde galeria e tags em silêncio** — `Events.parseJSON_`
  engole o erro de `JSON.parse` e devolve `[]`. O próximo `setRow_` regrava a
  célula com `[]` e o evento perde a galeria sem erro e sem log; os arquivos no
  Drive continuam lá. _Correção planejada: guardar o texto cru e regravar o cru,
  `console.error`, e `Tools.repairJson_`._

### Médio

- `Events.removePhoto` e `Files.removePhoto` cascateiam por nome. _Plano:
  lixeira por `id`, nome como fallback._
- `Events.remove` apaga a linha mas nunca apaga a pasta do Drive. _Plano:
  lixeira a pasta junto._
- `Files.folderFor` e `Files.root_` são read-then-create sem lock: duas execuções
  criam pastas duplicadas com o mesmo nome, e o código usa só a primeira.
- `Events.update` grava o slug na planilha antes de renomear a pasta; se a
  renomeação falhar, o retry nunca repara e as fotos ficam órfãs.
- `ensureSetup_` cria planilha, pasta e `CMS_API_TOKEN` sem lock: duas abas
  abertas na primeira execução criam recursos órfãos, e perder a corrida do
  token invalida o workflow silenciosamente.
- `Publish.dispatch` roda **dentro** do lock de script, sem timeout no
  `UrlFetchApp.fetch`. GitHub lento bloqueia toda escrita na planilha por até
  30 s e os uploads falham com "Outro processo ainda está gravando". Além disso
  `url_id` é best-effort e não é validado: pode reportar sucesso com
  `url_id: ''`. _Plano: dispatch fora do lock, validar `url_id`._
- `Events.markPublished` é o único método mutante sem `withScriptLock_` próprio.
- Validação de slug inconsistente: `apiGet` e `apiListFiles` não normalizam o
  slug, então `apiListFiles(null)` devolve `null` com HTTP 200 e o painel trata
  um upload bem-sucedido como falha. _Plano: normalizador único._

### Baixo

- `Files.decode_` checa o tamanho **depois** de decodificar: o `base64Decode`
  aloca os 30 MB inteiros antes de qualquer guarda. `base64Decode` também não
  está em `try`, então entrada malformada levanta exceção crua do GAS em vez da
  mensagem amigável. _Plano: checar o comprimento da base64 antes de decodificar e
  envolver o `base64Decode`._
- `payload.name` não tem teto de tamanho e vira `label` e nome de arquivo no
  Drive — alimenta direto o estouro de célula.
- `Events.all` faz uma leitura de `CacheService` por linha para `minGallery_`;
  o comentário afirma que o cache eliminou a chamada por linha.
- `Publish.buildPublication` não confere se o arquivo ainda existe ou está
  público. _Plano: verificação opcional, só no preview do painel._
- `Publish.dispatch` coloca o corpo de erro do GitHub na mensagem que vai para o
  toast. _Plano: truncar._
- `Code.doGet` chama `Auth.authorized_` antes do health check, então `?health=1`
  responde `auth: !!auth` a qualquer visitante (oráculo de autenticação pequeno).
  `doPost` não tem guarda de método nem de taxa.
- `Auth.constantTimeEquals_` vaza comprimento e compara hex cru; a versão de
  `Publish` faz digest antes. Inconsistente, embora não explorável aqui.
- `deploy.mjs` (reescrito) lia `~/.clasprc.json` e `.clasp.json` fora de
  `try/catch`, produzindo stack crua em vez das mensagens amigáveis.

## Ordem de execução

| #   | Etapa                                                                   | Estado       |
| --- | ----------------------------------------------------------------------- | ------------ |
| 1   | este arquivo                                                            | feito        |
| 2   | bun: lockfiles, `trustedDependencies`, `README.md`                      | feito        |
| 3   | servidor → `src/server/*.ts` com `strict: true`                         | feito        |
| 4   | `build.mjs` → `dist/`, `rootDir` no `.clasp.json`, sai o `.claspignore` | feito        |
| 5   | `theme.css` com Tailwind v4 compartilhando tokens do site               | feito        |
| 6   | login em Preact + Tailwind                                              | feito        |
| 7   | admin em Preact + Tailwind                                              | **pendente** |
| 8   | `deploy.mjs`: validar + `clasp push`                                    | feito        |
| 9   | `bun run check` + teste de regressão do `nextName_`                     | feito        |

### O que falta na etapa 7

O painel ainda é o `src/admin.js` original (1.307 linhas de DOM imperativo):
1.307 linhas de `innerHTML`, `data-action` e uma fila de upload com `canvas` para
redimensionar. Ele **funciona** — o `build.mjs` trata `.js` e `.tsx` na mesma
linha de bundle — e está marcado como provisório em `src/ui/admin/painel.css`.

A portagem é a maior peça que resta e a de maior risco: é a tela que publica o
site. Quando sair, `src/admin.js`, `src/admin.css`, `src/tokens.css`,
`src/globals.d.ts`, `src/login.*` e os `tsconfig.json`/`tsconfig.admin.json`
antigos somem.

### Arquivos obsoletos na raiz de `gs-form/`

`Api.js`, `Auth.js`, `Code.js`, `Events.js`, `Files.js`, `Lock.js`, `Publish.js`,
`Slug.js`, `index.html` e `login.html` na raiz eram a fonte e os artefatos do
pipeline antigo. Não sobem mais: o `.clasp.json` aponta para `dist/`. Ficaram
versionados e são uma segunda cópia do servidor — a que tem o regex do bug.

## Verificação manual

Depois de publicar:

- entrar com a senha
- criar evento, subir 3+ fotos, confirmar que os nomes no Drive são distintos
- marcar uma foto como capa e conferir que **só** ela aparece como capa
- "Ver JSON da publicação" e conferir que `gallery` traz todas menos a capa
- checklist com `gallery (N/M)` coerente
- "Executar automação" e o workflow gerar `/casamentos/<slug>`
