# gs-form — Controle de Casamentos (Google Apps Script)

Interface web (Google Apps Script) para cadastrar, editar, enviar fotos e **publicar casamentos**
no repositório deste portfólio Astro. Os dados são persistidos em uma planilha, as fotos no Google
Drive e a publicação dispara um workflow no GitHub (`publish-wedding`).

## Fluxo

```
[UI: login / lista / criar / editar / fotos / publicar]
      │ botão "Executar automação"
      ▼
POST api.github.com/repos/{owner}/{repo}/dispatches   (event_type: publish-wedding)
      │
      ▼
workflow .github/workflows/publish-wedding.yml
      │ POST https://script.google.com/macros/s/<url_id>/exec  {action:"publication", token, publicationId}
      ▼
doPost → {"slug","couple","date",..., "cover":{...}, "gallery":[...]}
      │
      ▼
node scripts/generate-wedding.mjs publication.json
      │ download das fotos (link público do Drive) + escrita do MDX
      ▼
commit + push → build/deploy → nova URL /casamentos/<slug>
```

## Estrutura

| Arquivo           | Papel                                                             |
| ----------------- | ----------------------------------------------------------------- |
| `Code.js`         | `doGet` (login ou painel) e `doPost` (endpoint do workflow)       |
| `Auth.js`         | Gate: senha → token de sessão, conta Google, freio de força bruta |
| `Lock.js`         | `LockService` para as escritas read-modify-write da planilha      |
| `Slug.js`         | Gera slug sem conflito (caso → caso+local → caso-2, 3, …)         |
| `Events.js`       | CRUD na planilha "Eventos" + checklist de prontidão               |
| `Files.js`        | Fotos no Drive: pasta do evento, nome sequencial, permissões      |
| `Publish.js`      | Endpoint `publication` + disparo do repository_dispatch           |
| `Api.js`          | Funções globais chamadas pela UI (`google.script.run`)            |
| `index.html`      | Painel (lista, formulário, upload, publicar)                      |
| `login.html`      | Tela de login                                                     |
| `appsscript.json` | Manifesto (escopos OAuth)                                         |
| `deploy.mjs`      | Cria/atualiza a implantação do Web App via API                    |
| `.clasp.json`     | Config do clasp (preencha o `scriptId`)                           |

## Autenticação

Um Web App do GAS roda como "executar como eu / qualquer pessoa" — o único modo sem servidor.
Isso significa que **qualquer pessoa que abra a URL pode chamar qualquer função global**, incluindo
`apiPublish` (dispara o workflow no GitHub com o seu PAT) e `apiDelete` (apaga linhas da planilha).
Autorizar por URL não é autorização, então todo acesso passa por `Auth.requireAuth_()`.

### Por que não cookie

O servidor **não consegue ler cookie**: `Session` só expõe `getActiveUser()`,
`getEffectiveUser()`, `getScriptTimeZone()` e `getTemporaryActiveUserKey()`. Devolver um
`Set-Cookie` também não existe — `HtmlService` não monta headers de resposta. Um esquema de cookie
exigiria a senha de novo em _cada_ requisição, porque o browser não reenviaria nada sozinho.

### O modelo

1. `doGet` sem sessão devolve `login.html` em vez do painel.
2. `apiLogin` compara a senha com o SHA-256 em Script Properties e devolve um **token opaco**.
   Só o SHA-256 do token vai para o `CacheService`, com validade de 7 dias.
3. Toda função `api*` recebe o token como primeiro argumento e chama `Auth.requireAuth_(token)`.
   Um `google.script.run` não passa por `doGet`, então um gate só no front-end não protegeria nada.

O token fica em `sessionStorage` só por conveniência (evita pedir a senha num F5). Num iframe com
storage de terceiros bloqueado o painel abre normalmente e basta entrar de novo.

### Alternativa recomendada: restringir o deployment

Se o deployment estiver em _Quem tem acesso: apenas \<sua conta\>_, o Google já autoriza e
`Session.getActiveUser()` devolve o email: o painel abre sem senha e sem token, e o botão "Sair"
fica oculto. Os dois caminhos convivem — o gate aceita qualquer um dos dois.

Essa é a opção com menos superfície de ataque. A senha existe para quando o deployment precisa
ficar "qualquer pessoa".

### Limite conhecido

Num deployment "qualquer pessoa" não há identidade do visitante, então o contador do freio de
força bruta é **global**: um atacante também consegue travar o painel por até 10 minutos. Com o
deployment restrito o contador passa a ser por email e o efeito desaparece.

## Pré-requisitos

- Conta Google (cria planilha e pastas no Drive automaticamente).
- Node.js + [clasp](https://github.com/google/clasp) (`npm i -g @google/clasp`).
- Um **Personal Access Token** do GitHub com escopo `repo` (usado para disparar o
  repository_dispatch). Crie em _Settings → Developer settings → Personal access tokens_.

## Configuração (uma vez)

1. **Crie o projeto no Apps Script**
   - https://script.google.com → _Novo projeto_ → cole o `Script ID` em `gs-form/.clasp.json`.

2. **Conecte o clasp** (na pasta `gs-form/`):

   ```bash
   cd gs-form
   clasp login
   clasp push
   ```

3. **Deploy como Web App**
   - Apps Script → _Implantar → Nova implantação → Aplicativo da web_
   - Executar como: **Eu**. Quem tem acesso: **apenas sua conta** (preferível) ou
     **Qualquer pessoa** (nesse caso defina `ADMIN_PASSWORD_HASH`).
   - Guarde a URL `/exec`; o ID dela (`/macros/s/<id>/exec`) é enviado
     automaticamente no `client_payload` do dispatch — não é secret.

4. **Configure as propriedades do script**
   Apps Script → _Configurações do projeto → Propriedades do script_:

   | Propriedade           | Obrigatório                          | Descrição                                                      |
   | --------------------- | ------------------------------------ | -------------------------------------------------------------- |
   | `GITHUB_OWNER`        | para publicar                        | Dono do repositório (username ou org)                          |
   | `GITHUB_REPO`         | para publicar                        | Nome do repositório (ex.: `portifolio-rafa`)                   |
   | `GITHUB_TOKEN`        | para publicar                        | PAT com escopo `repo` (autentica o repository_dispatch)        |
   | `CMS_API_TOKEN`       | para publicar                        | Segredo do endpoint. Se vazio, um aleatório é gerado no 1º uso |
   | `ADMIN_PASSWORD_HASH` | só se o deploy for "qualquer pessoa" | `sha256:<hex>` da senha. Sem ela o painel fica fechado         |
   | `SHEET_ID`            | opcional                             | Gera/usa uma planilha "Casamentos — Controle de Publicação"    |
   | `DRIVE_ROOT_ID`       | opcional                             | Pasta raiz no Drive ("Casamentos GS"). Cria se vazio           |
   | `MIN_GALLERY`         | opcional                             | Mínimo de fotos na galeria p/ liberar publicação (default 8)   |
   | `SITE_URL`            | opcional                             | Usada nos links de preview (default site do `site.config`)     |

   Gere o hash da senha:

   ```bash
   node -e "console.log('sha256:'+require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" 'SUA SENHA'
   ```

   O `_` na propriedade indica ausência de valor; uma string vazia conta como definida.

5. **Configure os secrets do workflow no GitHub**
   _Settings → Secrets and variables → Actions_:

   - `CMS_API_TOKEN`: o mesmo valor da propriedade de mesmo nome.
     (O ID da URL `/exec` viaja em `github.event.client_payload.url_id`, enviado
     pelo `Publish.dispatch` via `ScriptApp.getService().getUrl()`.)

## Uso

1. Abra o Web App (URL `/exec`) e entre com a senha (ou direto, se o deployment estiver restrito).
2. **+ Novo evento** → informe o casal (slug gerado sem conflito).
3. **Editar** → preencha os campos: dados do casamento, `Description` (frase da
   intro) e `Excerpt` (legenda curta dos cards).
   Não há mais corpo de texto, SEO nem fotos de story.
4. **Fotos** → arraste ou selecione quantas quiser: cada foto sobe individualmente em segundo
   plano para a **mesma pasta** do evento (nome **NN-seq.ext** no Drive, em ordem de envio).
   Todas entram na **galeria**; marque **Capa** em uma. Enquanto há uploads em andamento,
   salvar/publicar ficam temporariamente bloqueados.
5. Quando o checklist mostrar "Tudo pronto", clique em **Executar automação**.
6. O workflow gera `src/content/weddings/<slug>/` com `index.mdx` + imagens, valida
   (`pnpm check`) e faz commit/push.

## Endpoint programático

O workflow chama `POST https://script.google.com/macros/s/<url_id>/exec` com:

```json
{ "action": "publication", "token": "<CMS_API_TOKEN>", "publicationId": "<slug>" }
```

Resposta (200, sempre — erros vêm no corpo):

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
  "tags": ["casamento", "ouro-preto"],
  "cover": {
    "filename": "001.jpg",
    "url": "https://drive.google.com/uc?export=download&confirm=t&id=..."
  },
  "gallery": [{ "filename": "002.jpg", "url": "..." }]
}
```

## Notas e limites

- Web apps do GAS **sempre respondem HTTP 200**; erros vêm no corpo (`error`). O
  `scripts/generate-wedding.mjs` valida o corpo e falha o workflow se algo estiver errado.
  Por isso `Code.doPost` nunca deixa a exceção escapar — a stack vai para o Cloud Logging.
- Upload via UI funciona bem para JPGs otimizados. Cada request do Apps Script tem limite de
  payload (~50 MB); para fotos muito pesadas, otimize/crop antes de enviar.
- As fotos ficam **públicas com link** no Drive (necessário para o GitHub baixar), mas só
  _depois_ que a planilha aceitou a linha. Se a escrita falhar, o arquivo é jogado no lixo em vez
  de ficar público e órfão.
- `?confirm=t` na URL de download evita a página interstitial de "o arquivo é grande demais,
  verifique a senha" do Drive: sem ele o `fetch` do Node receberia HTML onde esperava bytes e o
  script gravaria esse HTML em `images/`.
- Na publicação, a foto marcada como capa vira `cover` e **todas** as outras vão para
  `gallery`. Os nomes são sequenciais na pasta do evento, então a ordenação natural do Drive
  vira a ordem de exibição.
- O slug da pasta no repositório é igual ao slug do evento (URL pública). Ao renomear o slug, a
  pasta do Drive é renomeada junto — sem isso os uploads seguintes criariam uma pasta vazia e as
  fotos antigas sumiriam do painel.
- O local tem três campos: `city` e `state` são obrigatórios, `venue` (o
  estabelecimento — fazenda, museu, igreja, hotel) é **opcional**. Com `venue`
  preenchido a página mostra `Fazenda X, Nova Lima, MG`; vazio, mostra só
  `Nova Lima, MG`. Os cards das listagens mostram sempre apenas `city` + `state`,
  e o slug usa a cidade (`yara-e-ataide-ouro-preto`), nunca o estabelecimento.
- **Migração da planilha:** `Events.alignHeaders_()` roda em todo acesso e reordena
  uma aba antiga para o layout novo, lendo por nome de coluna e desfazendo o
  `location` único: quebra o texto pela última vírgula, então
  `Fazenda X, Nova Lima` volta a ser `venue` + `city`. Sem isso a escrita seguinte
  corromperia a linha, já que `rowToValues_()` posiciona os valores pela ordem de
  `HEADERS`. É idempotente: com o cabeçalho já correto não escreve nada. As colunas
  que saíram (`vendors`, `historia_html`, `story`, `seoTitle`, `seoDescription`,
  `title`) são apagadas da aba — o motivo de cada uma está no comentário de
  `Events.HEADERS`.
- **Concorrência:** toda escrita passa por `Lock.withScriptLock_()`. As operações são
  read-modify-write da planilha inteira, e sem lock dois uploads simultâneos partem do
  mesmo snapshot e um dos patches se perde sem erro — a foto some da galeria sem aviso.
