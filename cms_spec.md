# Spec — CMS de Casamentos (painel de publicação)

Especificação completa de uma aplicação para **cadastrar, editar, enviar fotos e publicar páginas de
casamentos** num portfólio estático. Este documento é auto-contido: serve como prompt de solicitação
para gerar a aplicação inteira em outro harness/stack, mantendo o mesmo comportamento.

---

## 1. Visão geral

**O que é:** um painel administrativo privado ("Casamentos — Controle de Publicação") onde um
fotógrafo registra casamentos, envia fotos e dispara a publicação da página pública
`/casamentos/<slug>` no site do portfólio.

**Onde roda:** Google Apps Script (GAS) Web App — HTML servido via `HtmlService` dentro de um iframe,
lógica de servidor em TypeScript transpilado, dados em **Google Sheet**, fotos em **Google Drive**.

**Por que GAS:** não há servidor próprio para manter. O Web App roda com a autoridade do dono
("Executar como: Eu"), então não existe backend tradicional, nem cookies, nem framework web.

**Publicação fora do painel:** o painel não gera HTML. Ele dispara um `repository_dispatch` no
GitHub; um workflow busca o JSON de publicação de volta ao GAS, gera o MDX da página, faz commit e o
site estático (Astro/Cloudflare Pages) publica.

```
UI (login/lista/criar/editar/fotos/publicar)
  │ botão "Executar automação"
  ▼
POST api.github.com/repos/{owner}/{repo}/dispatches   (event_type: publish-wedding)
  ▼
.github/workflows/publish-wedding.yml
  │ POST https://script.google.com/macros/s/<url_id>/exec
  │   {action:"publication", token, publicationId}
  ▼
doPost → JSON de publicação {slug, couple, date, ..., cover, gallery}
  ▼
script gerador: baixa as fotos do Drive + escreve src/content/weddings/<slug>/index.mdx
  ▼
commit + push → check + build → deploy → /casamentos/<slug>
```

**Idioma:** toda a UI, mensagens de erro e textos são **pt-BR**. `<html lang="pt-BR">`.

---

## 2. Stack e restrições de plataforma

| Camada                   | Escolha                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Runtime alvo             | Google Apps Script, V8, `HtmlService` web app                                                                        |
| Linguagem                | TypeScript estrito (`strict`), sem `emit` (build separado)                                                           |
| UI                       | React 19 + TanStack Router                                                                                           |
| Build da UI              | Vite + `@vitejs/plugin-react` + `vite-plugin-singlefile` → **1 HTML só**                                             |
| Transpilação do servidor | esbuild (`transformSync`, `platform: neutral`, `target: es2020`, `charset: utf8`), **arquivo a arquivo, sem bundle** |
| Deploy                   | `@google/clasp` (`rootDir: "dist"`)                                                                                  |
| Testes                   | `bun test`                                                                                                           |
| Estilo                   | Tailwind CSS v4 (tokens compartilhados com o site)                                                                   |
| Package manager          | bun                                                                                                                  |

### Restrições duras do GAS (a stack nasce delas)

1. **Semcookie/sessão HTTP.** `Session` só expõe `getActiveUser()`/`getEffectiveUser()`; `HtmlService`
   não permite `Set-Cookie`. Autenticação é por **token opaco** passado como argumento de função.
2. **Sem rotas HTTP no servidor.** Existem só `doGet(e)` e `doPost(e)`. Todo o resto são **funções
   globais** chamadas via `google.script.run` (RPC), executadas com a autoridade do dono — logo,
   **toda função global é publicamente chamável** e precisa do próprio gate de auth.
3. **`doGet`/`doPost` sempre respondem HTTP 200**; erros vão no corpo (`{error}`).
4. **Scripts são globais:** o GAS concatena todos os `.js` num escopo global. Portanto os arquivos do
   servidor **não podem ter `import`/`export` no topo** (o build falha se tiver). Não há bundle/IIFE
   no servidor — `const Events` de um arquivo precisa ser visível a outro.
5. **A UI roda num iframe** com host `*.googleusercontent.com`. **Proibido** usar `window.location`
   dentro dela (navega para o host do sandbox → página de erro do Drive). Navegação = roteador em
   memória.
6. **Payload por request ~50 MB** → upload de foto é um request por foto, base64 no corpo.
7. **Limites do Drive/Sheets:** célula do Sheets = 50k chars (por isso `tags`/`gallery` são JSON em
   uma célula, com teto de 400 fotos/evento).

---

## 3. Arquitetura do código

Duas metades compilam diferente porque o GAS as executa diferente:

```
apps/gas/
├── appsscript.json          # manifesto: escopos, timezone, bloco webapp
├── .clasp.json              # { scriptId, rootDir: "dist" }
├── vite.config.ts           # build da UI
├── vite-gas.ts              # plugin Vite "gasDeploy": monta dist/ inteiro + auditorias
├── tsconfig.server.json     # typecheck estrito do servidor (sem emit)
├── tsconfig.ui.json         # typecheck estrito da UI
├── src/                     # codebase (server/ ui/)
├── test/
└── dist/                    # SAÍDA = rootDir do clasp (gitignored)
```

O projeto do painel vive no workspace **`apps/gas`**: os scripts `gs:build`/`gs:check`/`gs:test`
do `package.json` da raiz delegam para ele via `bun --filter gas` — e `bun run check` roda
dentro do workflow `publish-wedding.yml`.

### As duas metades

**Servidor** — transpilado **arquivo a arquivo** (esbuild `transformSync`), um `.js` por `.ts`, sem
bundle. O GAS concatena no escopo global. O build **falha** se encontrar `import`/`export` de topo.

**UI** — `vite build` com `vite-plugin-singlefile`: **um** HTML com CSS e JS inline. Nenhum
`<script src>` ou `<link href>` pode sobrar (seria um request extra no boot de uma tela que escreve
na planilha).

---

## 4. Modelo de dados

### 4.1 Planilha (fonte de verdade)

Spreadsheet `"Casamentos — Controle de Publicação"`, aba **`Eventos`**, linha 1 congelada, **uma linha
por casamento**. Colunas na ordem exata (`Events.HEADERS`):

```
slug | couple | date | city | state | venue | description | excerpt |
featured | tags | cover_id | cover_name | gallery | status | draft | created_at | updated_at
```

- **`slug`** = chave primária (coluna A) e segmento da URL pública.
- **`tags`** e **`gallery`** são **JSON stringificado** numa única célula.
- **`gallery`**: `FotoGaleria[]` = `{name, id, label, bytes, clientId}` — todas as fotos do evento;
  `cover_name`/`cover_id` apontam para uma delas.
- **`status`**: persistido como `unpublished`/`published` (resultado da última publicação). Os
  estados `ready`/`pending` e a lista `missed[]` são **derivados**, nunca armazenados.
- **`draft`**: boolean. `true` = **rascunho** — a página é gerada mas sai `noindex`, fora do
  sitemap, e a publicação é permitida com a galeria abaixo de `MIN_GALLERY` (o gerador já trata
  `pub.draft`). `false` = página pública indexável. **Nasce `true`** em eventos novos: nada é
  indexável por acidente. É **separado** de `status` — um evento pode estar `published` como
  rascunho (publicado só para revisar) e depois ser republicado sem rascunho.
- **`date`**: sempre `YYYY-MM-DD` ou string vazia — nunca texto cru (anti-XSS: o valor vira frontmatter
  do MDX).
- `created_at`/`updated_at`: ISO na timezone do script.

Tipos (espelhados em `src/server/types.ts` e `src/ui/lib/tipos.ts`):

```ts
interface FotoGaleria {
  name: string;
  id: string;
  label: string;
  bytes: number;
  clientId: string;
}

interface Evento {
  slug: string;
  couple: string;
  date: string;
  city: string;
  state: string;
  venue: string;
  description: string;
  excerpt: string;
  featured: boolean;
  tags: string[];
  cover_id: string;
  cover_name: string;
  gallery: FotoGaleria[];
  status: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
  // derivados, preenchidos em rowToObject_:
  ready: 'ready' | 'pending';
  missed: string[];
}

interface ArquivosEvento {
  cover: { name: string; id: string } | null;
  photos: FotoGaleria[];
}
interface Checklist {
  status: 'ready' | 'pending';
  missed: string[];
}
interface PayloadFoto {
  data: string;
  name: string;
  type?: string;
  clientId?: string;
}
```

**Migração idempotente:** `Events.alignHeaders_()` roda em **todo** acesso à planilha e reordena
cabeçalhos antigos para o layout atual, lendo por nome de coluna (ex.: um legado `location` único é
quebrado pela última vírgula em `venue` + `city`; colunas aposentadas são apagadas). Sem isso,
`rowToValues_()` (posicional) corromperia a linha seguinte.

### 4.2 Drive (fotos)

```
<DRIVE_ROOT_ID>/            pasta "Casamentos GS" (criada se vazia)
  └── <slug>/               renomeada junto quando o slug muda
        ├── 001.jpg
        ├── 002.png
        └── ...
```

- Nome **sequencial de 3 dígitos** (`001.ext`) — a ordem alfabética da pasta **é** a ordem de exibição.
- Invariante (testada): `serialDe_(nomeSerial_(n, ext)) === n` para n 1..999 e as extensões
  permitidas; o scanner de próximo número lê `/^(\d{3})\./` (sem hífen — bug antigo gerava `001.jpg`
  para sempre).
- Arquivo nasce **privado**; só vira "qualquer pessoa com link pode ver" **depois** de a planilha
  aceitar a linha. Se a escrita na planilha falhar, o arquivo vai para o lixo (nunca fica público e
  órfão).

### 4.3 Configuração (Script Properties — não há `.env`)

| Propriedade           | Obrigatória          | Comportamento                                                                                                |
| --------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ADMIN_PASSWORD_HASH` | para login por senha | formato `sha256:<hex>`; se ausente, painel fechado e a tela de login mostra instruções de setup              |
| `GITHUB_OWNER`        | para publicar        | dono do repo                                                                                                 |
| `GITHUB_REPO`         | para publicar        | nome do repo                                                                                                 |
| `GITHUB_TOKEN`        | para publicar        | PAT com escopo `repo`                                                                                        |
| `CMS_API_TOKEN`       | para publicar        | segredo compartilhado com o workflow; **auto-gerado** (`Utilities.getUuid()`) no 1º `ensureSetup()` se vazio |
| `SHEET_ID`            | opcional             | auto-cria a planilha se vazio                                                                                |
| `DRIVE_ROOT_ID`       | opcional             | auto-cria a pasta raiz se vazio                                                                              |
| `MIN_GALLERY`         | opcional             | mínimo de fotos na galeria para publicar; **default 8**, clamp 1–60, cache 600 s                             |

Secret do GitHub Actions: `CMS_API_TOKEN` (mesmo valor da propriedade).

---

## 5. Endpoints HTTP (`Code.ts`)

### `doGet(e)`

1. `?health=1` → JSON `{ok: true, service: 'portfolio-cms'}`.
2. Detecta sessão (`Auth.authorized_('')` — token em `parameter.token` ou conta Google restrita).
   Se autenticado, roda `Events.ensureSetup()` (provisiona planilha/pasta/token) e serve o painel;
   senão, serve o login.
3. Servem o mesmo HTML com `<title>` diferente (`'Casamentos — Controle de Publicação'` vs
   `'Casamentos — acesso'`), `XFrameOptionsMode.ALLOWALL`, viewport meta.

**Por que `ALLOWALL` (e não `DEFAULT`):** o painel é embebido num iframe do portfólio
(`/admin`, §16). `DEFAULT` só permite framing em domínios Google — o iframe no seu domínio
receberia a página de erro do Drive/Google. O custo é qualquer site poder embebar o painel
(clickjacking); a mitigação é o gate de senha obrigatório (§6) — sem sessão, o iframe só
mostra a tela de login, que não faz nada por si. Não há estado mutável em GET.

### `doPost(e)` — endpoint programático do workflow

Corpo JSON: `{ "action": "publication", "token": "<CMS_API_TOKEN>", "publicationId": "<slug>" }`.

- Token comparado em **tempo constante**; `action` deve ser `"publication"`.
- Sucesso → HTTP 200 com o JSON de publicação (schema §9.1).
- Erro → HTTP 200 com `{"error": "unauthorized" | "invalid_action" | "not_found" | "invalid_json" | "internal"}`.
- **Nunca deixa exceção escapar** (a stack vai para Cloud Logging via `console.error` +
  `exceptionLogging: STACKDRIVER`), porque o workflow só valida o corpo.

---

## 6. Autenticação e autorização

**Modelo: token opaco por sessão** (não cookie — impossível na plataforma).

1. `apiLogin(senha)` compara com `ADMIN_PASSWORD_HASH` em **tempo constante** → devolve token
   (dois UUIDs concatenados). No `CacheService` só vai o **SHA-256 do token** como chave
   (`auth_sess_<hex>`), TTL 7 dias.
2. A UI guarda o token em `sessionStorage['gs_token']` (conveniência: evita pedir senha no F5; se o
   storage estiver bloqueado no iframe, basta entrar de novo — não é falha).
3. **Toda função `api*`** recebe o token como **primeiro argumento** e começa com
   `Auth.requireAuth_(token)` — necessário porque `google.script.run` não passa por `doGet`.
4. `apiLogin` é a única função que **não** recebe token.
5. **Alternativa paralela:** deployment restrito ("apenas minha conta") → `Session.getActiveUser()`
   devolve email; o gate aceita esse caminho também (`via: 'conta'`), o botão "Sair" some, e o login
   por senha é dispensado. Os dois caminhos convivem. **Cuidado no iframe (§16):** quando o painel é
   embebido em `rafaeldiasfotos.com.br`, a sessão da conta Google depende de cookie de terceiros no
   subframe — com o bloqueio atual de cookies isso costuma falhar e cair no login por senha. Para o
   iframe, o deployment é "Qualquer pessoa" + `ADMIN_PASSWORD_HASH` obrigatório (ver §12); o caminho
   por conta continua válido abrindo o `/exec` direto, sem iframe.
6. **Expiração de sessão:** quando o servidor responde "Sessão expirada", a UI limpa o token e o
   roteador navega para `/login` (callback registrado — nunca `window.location`).
7. **Freio de força bruta:** contador de falhas (chave = email ou `'anon'`), backoff
   `min(600, 2^count * 5)` s, contador com teto 12; a checagem roda **antes** de comparar a senha.
8. `apiLogout` apaga a entrada do cache.

**Segurança de publicação:** um Web App anônimo expõe qualquer função global; sem o gate, qualquer
um chamaria `apiPublish` (usa o PAT) ou `apiDelete`. Daí o `requireAuth_` ser inegociável.

---

## 7. Superfície de API (funções `api*` — contrato UI↔servidor)

Todas (exceto `apiAuthStatus`/`apiLogin`) recebem `token` como arg #1. A UI as chama por um Proxy
tipado (`src/ui/lib/gas.ts`) sobre `google.script.run`; um **audit de build** falha se a UI chamar
uma `api*` que o servidor não define.

| Função                                            | Assinatura (pós-token)                       | Efeito                                                         |
| ------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `apiAuthStatus()`                                 | `→ {authenticated, email, via, hasPassword}` | sonda sessão                                                   |
| `apiLogin(password)`                              | `→ {ok, email, token}`                       | valida senha, emite token, roda `ensureSetup()`                |
| `apiLogout()`                                     | `→ {ok}`                                     | derruba sessão                                                 |
| `apiList()`                                       | `→ Evento[]`                                 | todas as linhas + prontidão computada                          |
| `apiConfig()`                                     | `→ {minGallery, email}`                      | config para a UI                                               |
| `apiCreate(payload)`                              | `→ Evento`                                   | exige `couple`; `Slug.ensureUnique`; append (sob lock)         |
| `apiGet(slug)`                                    | `→ Evento`                                   | busca uma linha                                                |
| `apiSave(slug, payload)`                          | `→ Evento`                                   | patch com whitelist; renomeia pasta do Drive se slug mudar     |
| `apiDelete(slug)`                                 | `→ {ok}`                                     | apaga a linha (fotos no Drive ficam)                           |
| `apiUploadPhoto(slug, {data,name,type,clientId})` | `→ ArquivosEvento`                           | Drive → planilha → tornar público (§8.2)                       |
| `apiSetCover(slug, name)`                         | `→ ArquivosEvento`                           | `''` limpa a capa                                              |
| `apiRemovePhoto(slug, name)`                      | `→ ArquivosEvento`                           | remove da planilha + lixo no Drive                             |
| `apiListFiles(slug)`                              | `→ {cover, photos}`                          | dados da grade                                                 |
| `apiPublication(slug)`                            | `→ Publicacao`                               | preview do JSON que iria ao GitHub                             |
| `apiChecklist(slug)`                              | `→ Checklist`                                | recalcula a partir dos dados salvos                            |
| `apiPublish(slug)`                                | `→ {ok, slug}`                               | valida → dispatch → `markPublished` (**tudo sob script lock**) |

**Erros:** sempre `throw new Error(mensagem pt-BR)`; a ponte converte a rejection do
`google.script.run` em `textoDeErro(e, fallback)` para o toast.

**Pontes de transporte na UI:**

- Proxy `SUPORTE` em `gas.ts` injeta o token como arg #1 (menos em `apiLogin`).
- Espera o sandbox instalar `google.script.run`: polling de 25 ms, até 200 tentativas (5 s).
- `PainelProvider.run()` (com loader global, debounce 120 ms) vs `runQuiet()` (uploads, sem loader).

---

## 8. Regras de negócio

### 8.1 Validação (camadas)

**1. HTML:** `required`, `type=date`, `maxLength=220` no excerpt.

**2. Whitelist do servidor** (`Events.EDITABLE`) — campos aceitos do formulário:

```
slug, couple, date, city, state, venue, description, excerpt, featured, tags, draft
```

`cover_id`, `cover_name`, `gallery`, `status`, `created_at`, `updated_at` são
**descartados** se enviados: sem a whitelist, uma chamada direta trocaria a capa por um id de Drive
arbitrário — e esse id acaba no JSON público. `draft` **só** aceita booleano (`true`/`false`); um
string vindo de chamada direta é descartado.

**3. Normalização/tetos do servidor:**

| Campo         | Teto                    | Regra                                                                                                            |
| ------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `couple`      | 120                     | obrigatório → `'Informe o nome do casal.'`                                                                       |
| `date`        | —                       | `normalizeDate_` → `YYYY-MM-DD` **ou vazio** (datas inválidas, incl. `31/02` e `29/02` não-bissexto, viram `''`) |
| `city`        | 80                      | obrigatório                                                                                                      |
| `state`       | 40                      | obrigatório                                                                                                      |
| `venue`       | 120                     | opcional                                                                                                         |
| `description` | 5000                    | —                                                                                                                |
| `excerpt`     | 220                     | — (bate com `scripts/generate-wedding.mjs` e o schema do Astro: `excerpt.max(220)`)                              |
| `tags`        | 20 tags / 40 chars cada | split por vírgula, trim, dedupe                                                                                  |

Texto: trim + corte no teto (`Events.text_`). Célula do Sheets tem 50k chars — sem teto, um textarea
gigante trava a planilha.

**4. Fotos (`Files.decode_`):**

```
ALLOWED_MIME = ['image/jpeg','image/png','image/webp','image/avif']
MAX_BYTES    = 30 MB
MAX_PHOTOS   = 300   (protege o limite de 50k chars da célula gallery)
label        ≤ 120 chars
clientId     ≤ 64 chars
name         ≤ 100 chars
```

Por que 300 e não 400: `gallery` é JSON numa célula de 50k chars. Com `label` ≤ 120 e
`clientId` ≤ 64, uma foto custa ~250 chars → estouro em ~379 fotos **sem** os caps; com 400 o
teto ficava acima do ponto de estouro e o evento ficava permanentemente ineditível (todo
`setRow_` regrava a linha inteira e falhava). `appendPhoto` valida os caps **antes** de gravar e
lança `Galeria cheia (300 fotos) — remova fotos antes de enviar mais.` (erro legível, não o
`setValues` cru do Sheets).
MIME declarado pelo cliente só é aceito se estiver na lista; senão, fallback para MIME derivado da
extensão (que também precisa ser imagem). Base64 → bytes → checagem de tamanho → erro legível.

**5. Checklist de prontidão** (`Events.computeStatus`, autoridade no servidor):

```ts
const textFields = ['couple', 'date', 'city', 'state', 'description', 'excerpt'];
for (f of textFields) if (blank(event[f])) missed.push(f);
if (blank(event.cover_id)) missed.push('cover');
galleryCount = fotos.filter((p) => p.name !== event.cover_name).length;
if (galleryCount < minGallery) missed.push(`gallery (${galleryCount}/${minGallery})`);
status = missed.length === 0 ? 'ready' : 'pending';
```

**6. Gate de publicação:** `apiPublish` **reexecuta** `computeStatus` sob lock e lança
`Evento incompleto — falta: ...` se algo faltar. **Exceção do rascunho:** com `draft: true`, as
faltas de galeria (`gallery (n/m)`) **não bloqueiam** — é justamente o caso "publicar incompleto
para revisar". As faltas de texto e de capa **sempre bloqueiam**, inclusive em rascunho: o
gerador exige `slug,couple,date,city,state,description,excerpt,cover` e abortaria o workflow com
o evento já marcado como publicado.

### 8.2 Upload de fotos

**Cliente (`fila.ts` — `useFila(slug)`):**

- Fila com **um upload por vez** (limites de execução do GAS + lock de arquivo no Drive).
- Redimensionamento antes de enviar: `MAX_EDGE = 2400`, JPEG quality `0.88`;
  `createImageBitmap(file, {imageOrientation:'from-image'})` → canvas (fundo branco) → `toBlob`.
  Se decode/canvas falhar ou o resultado não for menor, envia o original.
- `FileReader.readAsDataURL` → strip do prefixo → `{data, name, type, clientId}`.
- `clientId` **estável por arquivo** → reenvio é idempotente (dedupe no servidor).
- Filtra não-imagens na entrada. Drag-and-drop + click + teclado no dropzone.
- Enquanto `pendentes > 0`: **salvar e publicar ficam bloqueados**; barra mostra
  `Enviadas: n · Fila: n · Falhas: n`.
- Uploads passam por `runQuiet` (sem loader global); object URLs são revogadas.

**Servidor (`Api.apiUploadPhoto`):**

```ts
const saved = Files.savePhoto(s, payload);      // 1. arquivo privado <root>/<slug>/NNN.ext
try {
  Events.appendPhoto(s, {...});                 // 2. linha na célula gallery (lock, dedupe por clientId)
} catch (err) {
  Files.discard_(saved.id);                     // 3a. lixo se a planilha recusou
  throw err;
}
Files.publish_(saved.id);                       // 3b. SÓ AGORA: qualquer pessoa com link vê
return Events.listFiles(s);
```

**Capa/remoção:** `apiSetCover` compara por `name`; `apiRemovePhoto` remove da lista e move o arquivo
do Drive para o lixo (se o `name` não bate, nada é apagado — nunca remove "o evento inteiro").

### 8.3 Slug

`Slug.slugify` (lowercase, sem acentos, hífens) + `Slug.ensureUnique`: tenta `casal-cidade`; se
colidir, `casal-cidade-2`, `-3`, … . Ao mudar o slug no editor, a **pasta do Drive é renomeada junto**
(sem isso uploads seguintes criariam pasta nova e as fotos antigas sumiriam da UI).

### 8.4 Concorrência

Toda escrita read-modify-write na planilha passa por `Lock.withScriptLock_(fn)`
(`create`, `update`, `remove`, `setCover`, `appendPhoto`, `removePhoto`, `apiPublish`).
Provisionamento e `Tools.repairPhotoNames` usam `withDocumentLock_`. Sem lock, dois uploads
simultâneos partem do mesmo snapshot e um patch se perde **sem erro** — a foto some da galeria.

---

## 9. Fluxo de publicação

### 9.1 JSON de publicação (`Publish.buildPublication`)

```json
{
  "slug": "yara-e-ataide-ouro-preto",
  "couple": "Yara e Ataíde",
  "date": "2026-09-26",
  "city": "Ouro Preto",
  "state": "MG",
  "venue": "Museu da Inconfidência",
  "description": "...",
  "excerpt": "...",
  "featured": true,
  "draft": false,
  "tags": ["casamento", "ouro-preto"],
  "cover": {
    "filename": "001.jpg",
    "url": "https://drive.google.com/uc?export=download&confirm=t&id=..."
  },
  "gallery": [{ "filename": "002.jpg", "url": "https://..." }]
}
```

- `venue` omitido se vazio. Capa sai de `cover`; **todas** as outras vão para `gallery`.
- **`draft` é obrigatório no JSON** (`true`/`false`): o gerador usa para decidir se pula o
  mínimo de galeria e escreve o frontmatter `draft:` (noindex). Um evento `draft: true` publicado
  incompleto vira página gerada mas fora do sitemap e do Google.
- URLs do Drive **com `?confirm=t`** (sem ele o `fetch` do Bun recebe a página interstitial de
  "arquivo grande" em vez de bytes, e o gerador gravaria HTML em `images/`).
- Guarda: bytes totais das fotos ≤ `MAX_EVENT_BYTES = 400 MB`.
- `apiPublication(slug)` devolve exatamente este JSON (preview no painel).

### 9.2 Dispatch (`Publish.dispatch`)

```ts
// ANTES de dispatch, sob lock: url_id obrigatório (o workflow aborta sem ele)
const url_id = ScriptApp.getService().getUrl().match(/\/macros\/s\/([^/]+)\/exec$/)?.[1];
if (!url_id) throw new Error('Não consegui identificar a URL /exec do Web App — implante o app pela UI e tente de novo.');

// FORA do lock, com timeout — o lock é só para escrita na planilha
POST https://api.github.com/repos/${owner}/${repo}/dispatches   TimeoutApp: 15000 ms
Headers: Authorization: Bearer <GITHUB_TOKEN>, Accept: application/vnd.github+json,
         User-Agent: portfolio-cms
Body: { "event_type": "publish-wedding",
        "client_payload": { "publication_id": <slug>, "url_id": <id da URL /exec> } }
ok = (status === 204)
```

`url_id` vem de `ScriptApp.getService().getUrl()` (não é secret; o workflow falha com mensagem
clara se ele faltar). O fetch do GitHub **roda fora do `withScriptLock_`** e com timeout: um
GitHub lento não pode segurar uploads por 30 s (o lock do GAS tem janela curta e os demais
escritores falhariam com "Outro processo ainda está gravando").

### 9.3 `Api.apiPublish`

Três passos, cada um com seu lock — o fetch **nunca** roda dentro de lock:

1. `withScriptLock_` → recarrega a linha → `computeStatus` (bloqueia se incompleto, respeitando a
   exceção do rascunho §8.1.6) → valida `url_id` → libera o lock.
2. Fora do lock: `Publish.dispatch` (timeout 15 s).
3. `withScriptLock_` → `Events.markPublished(slug)` → libera.

### 9.4 Workflow GitHub (fora desta app, mas parte do contrato)

`publish-wedding.yml`: recebe o dispatch → `POST <url>/exec` com `{action:"publication", token:
secrets.CMS_API_TOKEN, publicationId}` → grava `publication.json` → **aborta se o corpo for
`{"error": ...}`** (hoje o gerador já falha com a mensagem, mas o check explícito dá o erro na
hora, no passo certo) → `bun apps/portifolio/scripts/generate-wedding.ts publication.json`
(valida campos obrigatórios `slug,couple,date,city,state,description,excerpt,cover`; regex de data;
excerpt ≤ 220; baixa fotos com checagens; escreve `apps/portifolio/src/content/weddings/<slug>/index.mdx`
atomicamente via staging) → `bun run check` + `bun run build` → commit/push → deploy do site →
`/casamentos/<slug>`.

---

## 10. UI

### 10.1 Rotas (TanStack Router, **memory history**)

| Rota     | Arquivo             | Comportamento                                |
| -------- | ------------------- | -------------------------------------------- |
| `/`      | `routes/index.tsx`  | redirect: token → `/admin`, senão `/login`   |
| `/login` | `routes/login.tsx`  | título `Casamentos — acesso`                 |
| `/admin` | `routes/admin.tsx`  | título `Casamentos — Controle de Publicação` |
| raiz     | `routes/__root.tsx` | só `<Outlet/>`                               |

**Por que memory history:** o painel roda no iframe do `HtmlService`; a URL real é sempre a do Web
App (`/exec`). Com history do browser, `pushState('/admin')` apontaria para um endereço que o
servidor não responde e um F5 cairia em 404 no `doGet`. Em memória, rota é estado interno.

**Dentro de `/admin` não há rotas** — três **telas** em `useState`
(`{nome:'lista'} | {nome:'criar'} | {nome:'editar', slug}`), deliberadamente não-routáveis: nunca
existiu URL, então não existe deep link sem autenticação.

### 10.2 Telas

**Login (`login/App.tsx`)** — 3 estados:

- `entrando`: form de senha (input `type=password`, autofocus, botão "Entrando…/Entrar"). Sucesso →
  `gravarToken` + `navigate('/admin')` **sem recarregar a página**.
- `sem senha`: mostra `Instrucoes` — como definir `ADMIN_PASSWORD_HASH` e `CMS_API_TOKEN` em
  Propriedades do Script, com o comando bun que gera o hash.
- `enviando`: submissão em andamento.

**Painel (`admin/App.tsx`)** — gate (`apiAuthStatus`), header sticky com email, botões `Lista`,
`Sair` (oculto na auth por conta Google), `+ Novo evento`; switcher de telas; `#toast` (pílula fixa,
auto-dismiss 3600 ms) e `#loader` (spinner com debounce 120 ms); busca `minGallery` em `apiConfig`.

**Lista (`Lista.tsx`)** — tabela: casal (+★ se featured), dica de slug, `Falta: …` (missed),
venue/city/state, data, badge (`publicado` / `pronto` / `incompleto`), botões Editar/Publicar (ambos
abrem o editor).

**Criar (`Criar.tsx`)** — form mínimo: couple*, date, city*, state*, venue. Slug gerado no servidor.
Sucesso → toast + navega para o editor.

**Editar (`Editar.tsx`)** — form completo + card de Fotos + card de Automação + salvar/excluir/
publicar. Sub-componente `Checklist` renderiza ✓/✗ a partir **dos dados salvos** (`evento`, não o
rascunho) + `evento.missed` do servidor.

Estado deliberadamente separado: `evento` (verdade salva) vs `campos` (rascunho controlado) — para o
checklist nunca mentir sobre o que está gravado.

| Campo       | Input                              | Restrição client     |
| ----------- | ---------------------------------- | -------------------- |
| slug        | text readOnly + botão "Gerar novo" | —                    |
| couple      | text                               | —                    |
| date        | `type=date`                        | formato do browser   |
| city        | text                               | label com `*`        |
| state       | text                               | label com `*`        |
| venue       | text                               | opcional             |
| description | textarea rows=3                    | —                    |
| excerpt     | textarea rows=2                    | `maxLength=220`      |
| featured    | checkbox                           | —                    |
| draft       | checkbox "Rascunho (noindex)"      | —                    |
| tags        | text                               | separado por vírgula |

**Fotos (`Fotos.tsx`)** — dropzone (click/teclado/drag-drop) → grade de `Tile` (thumb do Drive via
`lh3.googleusercontent.com/d/<id>=w400`, estados skeleton/ok/fail, chip "capa", × e "Capa") +
`TileUpload` (pendente/enviando/erro, × e "Reenviar") + `BarraUpload`.

### 10.3 Estado

Sem Redux/react-query: React state local + 1 context (`PainelProvider`):

- `toast(msg)` / `aviso` (auto-dismiss), `carregando`/`carregandoMsg` (contador em ref, delay 120 ms
  para chamadas rápidas não piscarem), `run()` (loader + converte expiração de sessão em
  `ErroSessao`, sem toast), `runQuiet()`.

### 10.4 Estilo

**Tailwind CSS v4** (mesma versão do site), com os tokens de `src/styles/tokens.css` importados
no CSS do painel — a paleta (`--accent`, `--ok`, `--danger`…) é literalmente a do portfólio, e
trocar um token muda site e painel juntos. Três pontos de entrada de CSS:

- `src/ui/styles/painel.css`: `@import 'tokens.css'` + `@import 'tailwindcss'` + utilitários
  locais (`#toast`, `#loader`, `.dropzone`, `.photo-tile`, `.badge`, `.checklist`);
- variações de estado (hover/focus/disabled) via classes Tailwind nos componentes;
- `@media (prefers-reduced-motion: reduce)` desliga shimmer/animações.

**Sem seletores genéricos** (`button`, `input`, `h1` sem escopo): login e painel vivem no mesmo
bundle — no Tailwind isso é natural (utility-first, sem reset global), e é a razão pela qual a
solução de "3 folhas de CSS puro com prefixo `.tela-login`" foi descartada.

### 10.5 SEO/meta

Mínimo e deliberado — é painel autenticado, não página pública: charset, viewport, `<base
target="_top">`, título por tela (`useTitulo` + título servido pelo `doGet`), sem OG/Twitter/
canonical/robots/JSON-LD (isso fica no site Astro).

---

## 11. Build, auditorias e testes

### Scripts (package.json da raiz do monorepo)

```
gs:build  = bun --filter gas build
gs:test   = bun --filter gas test
gs:check  = bun --filter gas check
check     = bun --filter portifolio check && bun --filter gas check && bun run format:check
gs:deploy = bun --filter gas deploy
```

### Pipeline do build

Plugin `gasDeploy` (`vite-gas.ts`, `enforce: 'post'`) roda em `generateBundle` **antes** de o Vite
escrever qualquer coisa — auditoria reprovada ⇒ `dist/` intocado. Ele:

1. transpila cada `apps/gas/src/server/*.ts` com esbuild → `apps/gas/dist/*.js` (saídas vazias como
   `types.js` puladas);
2. audita e grava `dist/index.html` (HTML único com bundle inline) + `dist/login.html` (cópia) +
   `dist/appsscript.json`.

### O build **falha** quando (todas as checagens são obrigatórias)

1. alguma tag de bloco fica sem fechar; falta `<!doctype html>` ou `<html lang="pt-BR">`;
2. sobra `<script src>` ou `<link href>` (tem que ser tudo inline);
3. o bundle inline **não faz parse** — checagem com `new Function(code)` (parser do V8). Existe
   porque a auditoria original só contava tags: um IIFE com a abertura comida passava e chegava ao
   navegador como `SyntaxError`, página em branco, sem pista;
4. o `type="module"` some da tag do script — é ele que dá `defer` implícito e garante que o script
   rode depois do `#root` existir (remover o atributo "consertando" o SyntaxError deixava a tela
   em branco sem erro);
5. o bundle não começa com `(function () {` e termina com `})();` (IIFE), nem tem `import`/`export`/
   `await` de topo;
6. HTML passa de **`BUDGET_HTML = 400 KiB`** (atual ≈ 324 KiB);
7. arquivo do servidor contém `import`/`export` de topo (quebraria o escopo global do GAS);
8. a UI chama uma `api*` que o servidor não define (`conferirApi` — sem isso o erro seria
   "is not a function" só no console de quem abriu o painel).

### Testes

- Harness `test/gas.ts`: como os scripts são globais (sem exports), lê os `.ts`, transpilha com o
  **mesmo esbuild** do build, concatena e avalia via `new Function(...names, js + ';return {…}')` —
  os testes exercitam o código real. Inclui `pastaFake()` emulando o iterador do Drive
  (`hasNext()/next()`).
- `test/files.test.ts`: regressão do bug em que toda foto recebia `001.jpg` (scanner `/^(\d{3})-/`
  com hífen espúrio): round-trip serial 1–999 × 4 extensões; zeros à esquerda; nome não-serial → 0;
  pasta vazia → `001.jpg`; **regressão**: pasta com `001.jpg` → `002.jpg`; extensões misturadas não
  zeram a contagem; teto `999.jpg`; `MAX_PHOTOS` existe e está em (0, 400].

---

## 12. Deploy e configuração (uma vez)

1. Criar projeto no Apps Script → colar `Script ID` em `apps/gas/.clasp.json`.
2. `clasp login` → `bun run gs:build` → `clasp push` (envia **só** `dist/` por `rootDir`).
3. Publicar como Web App **pela UI** (só a UI preserva a URL `/exec`):
   - **Executar como: Eu** (crítico — sem isso cada visitante pede consentimento OAuth e o iframe
     não monta);
   - **Quem tem acesso: _Qualquer pessoa_** — para o painel embebido no `/admin` (§16) a auth por
     conta Google não é confiável (cookie de terceiros no iframe), então aqui **`ADMIN_PASSWORD_HASH`
     é obrigatória**. O caminho "apenas minha conta" (sem senha) continua válido só se o painel for
     aberto direto no `/exec`, fora do iframe;
   - manifesto declara `"webapp": {"executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS"}` —
     fonte de verdade só na criação do deployment; alterações depois exigem republicar.
4. **Anote o `deploymentId`** (está em _Implantar → Gerenciar implantações_). Para **novos deploys
   de código**, rode `bun run gs:deploy` (executa `gs:build` + `clasp deploy -i <deploymentId>`):
   `clasp push` sozinho atualiza o código na nuvem **mas não reimplanta** — o `/exec` de produção
   fica servindo a versão anterior até você publicar uma nova, e a URL tem que se manter a mesma
   porque o workflow depende do `url_id`. Nunca crie um deployment novo como "Nova implantação"
   (isso gera um `url_id` novo e quebra o workflow).
5. Propriedades do script: tabela §4.3. Gerar hash:
   `bun -e "console.log('sha256:'+require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" 'SENHA'`
6. Secret do Actions: `CMS_API_TOKEN` = propriedade homônima.
7. Escopos OAuth (`appsscript.json`): `spreadsheets`, `drive`, `script.external_request`,
   `userinfo.email`; timezone `America/Sao_Paulo`; `exceptionLogging: STACKDRIVER`.
8. `setXFrameOptionsMode(XFrameOptionsMode.ALLOWALL)` no `doGet` (§5) — sem isso o iframe do
   `/admin` não monta.

---

## 13. Manutenção (`Tools.ts` — não exposta à UI)

Funções globais que **não** começam com `api` (o Proxy da UI só as chama se existirem no contrato;
na prática só rodam coladas no editor do Apps Script):

- `repairPhotoNames(slug?, aplicar=false)` — **dry-run por padrão**; renomeia fotos por Drive `id`
  para o padrão `NNN.ext`, reporta `atual -> alvo` por evento, preserva a ordem encontrada na
  planilha, zera capa órfã. Idempotente.
- `republishEvent(slug)` — torna público o que ficou privado quando `Files.publish_` falhou
  (o apply do reparo **não** publica nada).
- `repairJson(slug?)` — reescreve a célula `gallery`/`tags` corrompida. Sempre que o `parseJSON_`
  falha, `Events` **preserva o texto cru** e loga `console.error` (nunca mais regrava `[]` em
  silêncio); esta ferramenta lê as entradas de `File[]` legíveis do Drive para reconstruir
  `gallery` por `id`, dry-run por padrão.

---

## 14. Dívidas conhecidas (comportamento documentado, não para "corrigir" em silêncio)

Os débitos **críticos/altos** da auditoria (publicação com foto privada, nome sequencial fora do
lock, `alignHeaders_` não-locked, corrupção de célula engolida, throttle global travando o painel)
foram **incorporados à implementação** desta spec — não estão aqui. O que resta:

1. **Sessão curta:** TTL efetivo de **6 h** (teto do `CacheService`; pode evictar antes). Renovação
   deslizante prolonga, mas um dia de abandono pede senha de novo.
2. **Freio de força bruta global em deployment anônimo:** sem identidade do visitante, o contador é
   único e o cooldown (teto 120 s) atrasa tentativas erradas de todos. A senha **certa sempre
   passa**. Com deployment restrito o contador é por email e o efeito desaparece.
3. `MAX_EVENT_BYTES` (400 MB) é effectively morto (a UI redimensiona para 2400 px; o gerador rejeita
   > 20 MB/foto e < 1600 px).
4. `SITE_URL` documentado mas nunca lido.
5. Health probe (`?health=1`) responde antes do auth (oráculo pequeno de "deployment existe").
6. Deployment anônimo: quem tem a senha lê/escreve a planilha inteira (sem filtro por email em
   `Events`).
7. `Files.folderFor`/`root_` fazem read-then-create sem lock: duas execuções simultâneas podem
   criar a pasta raiz duplicada (o código usa a primeira; a órfã fica vazia).
8. `Events.update` grava o slug na planilha antes de renomear a pasta do Drive; se a renomeação
   falhar, o retry não repara e as fotos ficam órfãs (o editor mostra o erro).
9. `Events.remove` apaga a linha mas **não** a pasta do Drive (por segurança: dados não somem de
   vez sem confirmação extra).
10. `ensureSetup_` cria planilha/pasta/token sem lock: na primeira execução, duas abas podem criar
    recursos órfãos — a corrida do `CMS_API_TOKEN` invalidaria o workflow silenciosamente.
11. `Files.decode_` checa o tamanho **depois** de decodificar (a base64 de 30 MB aloca toda antes da
    guarda) e o `base64Decode` não está em `try` (entrada malformada levanta exceção crua do GAS).
12. `Publish.dispatch` cola o corpo de erro do GitHub no toast (mensagem crua, sem truncar).
13. `Auth.constantTimeEquals_` vaza o comprimento e compara hex cru (não-explorável aqui, mas
    inconsistente com o digest do `Publish`).

## 15. Critérios de aceite (para validar uma reimplementação)

1. `bun run gs:check` passa: dois typechecks estritos, testes e build auditado.
2. Abrir o `/exec` sem sessão mostra login; com sessão (token ou conta restrita) mostra o painel;
   `?health=1` responde `{"ok":true,...}`.
3. Login errado → mensagem + backoff; senha ausente → tela de instruções de setup.
4. Criar evento gera slug único (`casal-cidade`, `-2`, …) e **nasce com `draft: true`**; salvar muda
   a linha **e** renomeia a pasta do Drive.
5. Upload: fotos chegam como `001.ext`, `002.ext`, … na pasta do evento; só ficam públicas depois
   de aceitas na planilha; reenvio da mesma foto (mesmo `clientId`) não duplica; bloquear
   salvar/publicar enquanto há fila.
6. Checklist bloqueia publicação com campo faltando ou capa faltando; com galeria abaixo de
   `MIN_GALLERY` bloqueia **só se `draft: false`**; com tudo pronto, publicar dispara
   `repository_dispatch` e marca `published`. Sem `url_id` disponível → não dispara, erro claro.
7. `POST /exec` com token errado → `{"error":"unauthorized"}`; com token certo e slug existente →
   JSON de publicação conforme §9.1 (capa em `cover`, resto em `gallery`, URLs com `confirm=t`,
   `draft` presente); com slug inexistente → `{"error":"not_found"}`. **Sempre HTTP 200.**
8. Nenhum `window.location` na UI; nenhum `import`/`export` no servidor; HTML final < 400 KiB,
   100% inline.
9. Duas escritas simultâneas não perdem dados (todo write sob `withScriptLock_`).
10. UI inteira em pt-BR; `<html lang="pt-BR">`.
11. `/admin` no site serve o painel num iframe (monta sem erro de framing), fica **fora do sitemap**
    e do `robots.txt` (`Disallow`), com cache `no-store`.
12. Publicar com `draft: true` e galeria < `MIN_GALLERY` → workflow roda, MDX sai com
    `draft: true` e a página não aparece no sitemap da próxima build.

---

## 16. Página `/admin` no site (hospedagem do iframe)

O painel vive no Apps Script; o site só **embebe**:

```
rafaeldiasfotos.com.br/admin     (Astro: src/pages/admin.astro)
   └── <iframe src="https://script.google.com/macros/s/<url_id>/exec"
          title="Painel de publicação" loading eager referrerpolicy="no-referrer">
          (min-height: 100vh; width: 100%; border: 0)
```

Regras obrigatórias:

- **Framing:** o GAS precisa de `XFrameOptionsMode.ALLOWALL` (§5). O CSP do site
  (`frame-ancestors`) não impede embebar terceiros; se quiser endurecer, adicione
  `frame-src 'self' https://script.google.com https://*.googleusercontent.com` ao
  `Content-Security-Policy` do `public/_headers` (regra apenas para `/admin`).
- **SEO:** `<meta name="robots" content="noindex, nofollow">` na página e `Disallow: /admin` no
  `robots.txt`; filtrar `/admin` no `serialize`/`filter` do `@astrojs/sitemap` (senão a URL entra
  no sitemap).
- **Cache:** regra `/admin` no `public/_headers` com `Cache-Control: no-store` (o iframe carrega o
  `/exec`, mas o HTML do wrapper não deve ficar em cache).
- **Acesso:** a autenticação é inteiramente do GAS (senha §6). O wrapper Astro **não** armazena
  segredo nenhum — o `CMS_API_TOKEN` e o `GITHUB_TOKEN` nunca passam por este repositório.
- **Subdomínio (opcional):** se um dia quiser `admin.rafaeldiasfotos.com.br`, a alternativa sem
  infra nova é redirecionar (302) o subdomínio para `rafaeldiasfotos.com.br/admin`; não consiga
  CNAME para `script.google.com` (o Host header não bate).
