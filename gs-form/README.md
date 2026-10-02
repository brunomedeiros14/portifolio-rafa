# gs-form — Controle de Casamentos (Google Apps Script)

Interface web (Google Apps Script) para cadastrar, editar, enviar fotos e **publicar casamentos**
no repositório deste portfólio Astro. Os dados são persistidos em uma planilha, as fotos no Google
Drive e a publicação dispara um workflow no GitHub (`publish-wedding`).

## Fluxo

```
[UI: lista / criar / editar / fotos / publicar]
      │ botão "Executar automação"
      ▼
POST api.github.com/repos/{owner}/{repo}/dispatches   (event_type: publish-wedding)
      │
      ▼
workflow .github/workflows/publish-wedding.yml
      │ POST https://script.google.com/macros/s/<url_id>/exec  {action:"publication", token, publicationId}
      ▼
doPost → {"slug","title","couple","date",..., "cover":{...}, "gallery":[...]}
      │
      ▼
node scripts/generate-wedding.mjs publication.json
      │ download das fotos (link público do Drive) + escrita do MDX
      ▼
commit + push → build/deploy → nova URL /casamentos/<slug>
```

## Estrutura

| Arquivo                 | Papel                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `Code.js`               | `doGet` (interface) e `doPost` (endpoint do workflow)        |
| `Ui.js`                 | Entrega o HTML (`HtmlService`)                               |
| `Slug.js`               | Gera slug sem conflito (caso → caso+local → caso-2, 3, …)    |
| `Events.js`             | CRUD na planilha "Eventos" + checklist de prontidão          |
| `Drive.js`              | Upload individual em pasta única do evento (nome UUID + extensão)   |
| `Publish.js`            | Endpoint `publication` + disparo do repository_dispatch              |
| `Api.js`                | Funções globais chamadas pela UI (`google.script.run`)       |
| `index.html`            | Interface (lista, formulário, upload, publicar)            |
| `appsscript.json`       | Manifesto (escopos OAuth)                                    |
| `.clasp.json`           | Config do clasp (preencha o `scriptId`)                      |

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
   - Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**
   - Guarde a URL `/exec`; o ID dela (`/macros/s/<id>/exec`) é enviado
     automaticamente no `client_payload` do dispatch — não é secret.

4. **Configure as propriedades do script**
   Apps Script → _Configurações do projeto → Propriedades do script_:

   | Propriedade      | Obrigatório | Descrição                                                    |
   | ---------------- | ----------- | ------------------------------------------------------------ |
   | `GITHUB_OWNER`   | sim         | Dono do repositório (username ou org)                        |
   | `GITHUB_REPO`    | sim         | Nome do repositório (ex.: `portifolio-rafa`)                 |
   | `GITHUB_TOKEN`   | sim         | PAT com escopo `repo` (autentica o repository_dispatch)      |
   | `CMS_API_TOKEN`  | opcional    | Segredo do endpoint. Se vazio, um aleatório é gerado no 1º uso |
   | `SHEET_ID`       | opcional    | Gera/usa uma planilha "Casamentos — Controle de Publicação"  |
   | `DRIVE_ROOT_ID`  | opcional    | Pasta raiz no Drive ("Casamentos GS"). Cria se vazio         |
   | `MIN_GALLERY`    | opcional    | Mínimo de fotos na galeria p/ liberar publicação (default 8) |
   | `SITE_URL`       | opcional    | Usada nos links de preview (default site do `site.config`)   |

5. **Configure os secrets do workflow no GitHub**
   _Settings → Secrets and variables → Actions_:

   - `CMS_API_TOKEN`: o mesmo valor da propriedade de mesmo nome.
     (O ID da URL `/exec` viaja em `github.event.client_payload.url_id`, enviado
     pelo `Publish.dispatch` via `ScriptApp.getService().getUrl()`.)

## Uso

1. Abra o Web App (URL `/exec`).
2. **+ Novo evento** → informe o casal (slug gerado sem conflito).
3. **Editar** → preencha os campos: dados do casamento, `Description` (frase da
   intro), `Excerpt` (legenda curta dos cards) e, se quiser, os campos de SEO.
   Não há mais corpo de texto nem fotos de story.
4. **Fotos** → arraste ou selecione quantas quiser: cada foto sobe individualmente em segundo
   plano para a **mesma pasta** do evento (nome **UUID.ext** no Drive). Todas entram na
   **galeria**; marque **Capa** em uma. Enquanto há uploads em andamento, salvar/publicar
   ficam temporariamente bloqueados.
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
  "title": "Yara + Ataíde",
  "couple": "Yara e Ataíde",
  "date": "2026-09-26",
  "city": "Ouro Preto",
  "state": "MG",
  "venue": "Museu da Inconfidência",
  "description": "...",
  "excerpt": "...",
  "featured": true,
  "tags": ["casamento", "ouro-preto"],
  "seoTitle": "...",
  "seoDescription": "...",
  "cover": { "filename": "cover.jpg", "url": "https://drive.google.com/uc?export=download&id=..." },
  "gallery": [{ "filename": "01.jpg", "url": "..." }]
}
```

## Notas e limites

- Web apps do GAS **sempre respondem HTTP 200**; erros vêm no corpo (`error`). O
  `scripts/generate-wedding.mjs` valida o corpo e falha o workflow se algo estiver errado.
- Upload via UI funciona bem para JPGs otimizados. Cada request do Apps Script tem limite de
  payload (~50 MB); para fotos muito pesadas, otimize/crop antes de enviar.
- As fotos ficam **públicas com link** no Drive (necessário para o GitHub baixar).
- Na publicação, a foto marcada como capa vira `cover` e **todas** as outras vão para
  `gallery`. As fotos ficam na mesma pasta do evento com nome UUID + extensão original
  (evita colisão e preserva o tipo).
- O slug da pasta no repositório é igual ao slug do evento (URL pública).
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
  `HEADERS`. É idempotente: com o cabeçalho já correto não escreve nada. Depois da
  primeira execução, as colunas listadas em `Events.DROPPED_HEADERS` são apagadas
  da aba.