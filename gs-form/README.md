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
doPost → {"slug","title","couple","date",..., "cover":{...}, "gallery":[...], "story":{html,images}}
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
| `Slug.js`               | Gera slug sem conflito (caso → caso+cidade → caso-2, 3, …)   |
| `Events.js`             | CRUD na planilha "Eventos" + checklist de prontidão          |
| `Drive.js`              | Upload/publicação/remoção de arquivos no Google Drive        |
| `Publish.js`            | Endpoint `publication` + disparo do repository_dispatch      |
| `Api.js`                | Funções globais chamadas pela UI (`google.script.run`)       |
| `index.html`            | Interface (lista, formulário, WYSIWYG, upload, publicar)     |
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
3. **Editar** → preencha os dados obrigatórios. Use o **editor WYSIWYG** para a história
   (o texto vira o corpo do MDX) e "Inserir foto do story" para intercalar imagens.
4. **Fotos** → envie capa, galeria e story. Arquivos vão para o Drive como **públicos com link**.
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
  "slug": "marina-e-pedro-ouro-preto",
  "title": "Marina + Pedro",
  "couple": "Marina e Pedro",
  "date": "2026-05-30",
  "location": "Museu da Inconfidência",
  "city": "Ouro Preto",
  "state": "MG",
  "venue": "Praça Tiradentes",
  "description": "...",
  "excerpt": "...",
  "featured": true,
  "tags": ["casamento", "ouro-preto"],
  "vendors": [{ "role": "Espaço", "name": "Sobrado Imperial", "instagram": "sobradoimperial" }],
  "seoTitle": "...",
  "seoDescription": "...",
  "cover": { "filename": "cover.jpg", "url": "https://drive.google.com/uc?export=download&id=..." },
  "gallery": [{ "filename": "01.jpg", "url": "..." }],
  "story": {
    "html": "<p>...</p><figure><img data-story=\"abertura.jpg\">...</figure>",
    "images": [{ "filename": "abertura.jpg", "url": "..." }]
  }
}
```

## Notas e limites

- Web apps do GAS **sempre respondem HTTP 200**; erros vêm no corpo (`error`). O
  `scripts/generate-wedding.mjs` valida o corpo e falha o workflow se algo estiver errado.
- Upload via UI funciona bem para JPGs otimizados. Cada request do Apps Script tem limite de
  payload (~50 MB); para fotos muito pesadas, otimize/crop antes de enviar.
- As fotos ficam **públicas com link** no Drive (necessário para o GitHub baixar).
- O slug da pasta no repositório é igual ao slug do evento (URL pública).