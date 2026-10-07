# Rafael Dias — Fotografia de Casamento

Portfólio e site institucional de fotógrafo de casamento em Belo Horizonte e
Minas Gerais. Monorepo gerenciado 100% com [Bun](https://bun.sh).

- **Idioma:** pt-BR (único, sem i18n)
- **Saída:** 100% estática (`dist/`), sem servidor
- **Deploy:** Cloudflare Pages, build a partir de `main`
- **CMS:** Google Apps Script (`apps/gas/`) publica casamentos via GitHub Actions
- **Painel (admin):** `/admin` embebe o CMS num iframe — especificação completa em `cms_spec.md`

## Stack

| Camada     | Escolha                                 |
| ---------- | --------------------------------------- |
| Runtime    | Bun (monorepo com Bun workspaces)       |
| Framework  | Astro 7 (`output: 'static'`)            |
| Conteúdo   | Content Collections + MDX (glob loader) |
| Estilo     | Tailwind CSS v4 (`@tailwindcss/vite`)   |
| Imagens    | `astro:assets` / `sharp`                |
| SEO        | `@astrojs/sitemap` + JSON-LD por página |
| Transições | `astro:transitions` (`ClientRouter`)    |
| Validação  | `astro check`                           |

## Comandos (Raiz do Monorepo)

| Comando             | Ação                                            |
| ------------------- | ----------------------------------------------- |
| `bun install`       | Instala as dependências de todos os workspaces  |
| `bun run dev`       | Servidor de desenvolvimento em `localhost:4321` |
| `bun run build`     | Build de produção do portfólio                  |
| `bun run preview`   | Serve o build local para conferência            |
| `bun run check`     | Verificação de tipos de todo o monorepo         |
| `bun run format`    | Formata o código com Prettier                   |
| `bun run gs:build`  | Transpila + audita o CMS em `apps/gas/dist/`    |
| `bun run gs:test`   | Testes do servidor GAS (`apps/gas/test/`)       |
| `bun run gs:check`  | Typecheck servidor+UI + testes + build do CMS   |
| `bun run gs:deploy` | `gs:build` + `clasp push` em `apps/gas/dist/`   |

> Em desenvolvimento, no workspace do portfólio (`apps/portifolio`), prefira rodar
> o servidor em segundo plano: `astro dev --background`, gerenciado com
> `astro dev stop`, `astro dev status` e `astro dev logs`.

## Estrutura do Monorepo

```text
apps/
├── portifolio/          # Projeto principal do site (Astro 7)
│   ├── public/          # favicon, webmanifest, robots.txt, fonts/
│   ├── scripts/         # scripts Bun (pipeline de publicação e downloads)
│   ├── src/             # componentes, páginas, estilos, layouts e conteúdo
│   ├── astro.config.mjs # configuração do Astro
│   └── package.json     # dependências e scripts exclusivos do portfólio
└── gas/                 # Painel admin e servidor Google Apps Script (CMS)
    ├── src/             # server/ (GAS) e ui/ (React 19 + TanStack Router)
    ├── test/            # testes de regressão do servidor GAS com Bun
    ├── vite.config.ts   # build e auditoria do bundle inline do Apps Script
    └── package.json     # dependências e scripts exclusivos do CMS
```

## Rotas do Portfólio

| Rota                 | Tipo | Conteúdo                                   |
| -------------------- | ---- | ------------------------------------------ |
| `/`                  | SSG  | Home, destaques e seleção editorial        |
| `/casamentos`        | SSG  | Índice do portfólio                        |
| `/casamentos/[slug]` | SSG  | Detalhe de um casamento (`getStaticPaths`) |
| `/blog`              | SSG  | Lista de artigos                           |
| `/blog/[slug]`       | SSG  | Artigo (`getStaticPaths`)                  |
| `/sobre`             | SSG  | Sobre o fotógrafo                          |
| `/experiencia`       | SSG  | Processo, do contato à entrega             |
| `/contato`           | SSG  | Canais de contato                          |
| `/admin`             | SSG  | Iframe do CMS (noindex, fora do sitemap)   |
| `/404`               | SSG  | Página de erro (`noindex`)                 |

## Publicar um casamento (CMS)

O `apps/gas` é um painel em Google Apps Script que grava os dados numa Google
Sheet, sobe as fotos para o Drive e dispara o workflow de publicação. Ele roda
embebido em `https://rafaeldiasfotos.com.br/admin` (iframe) e exige senha. Toda a
especificação (modelo, API, segurança, deploy) está em `cms_spec.md`.

1. Abra `/admin`, entre e preencha o evento, envie as fotos e marque uma delas
   como capa — as demais vão para a galeria.
2. **Executar automação** faz `repository_dispatch` com `publish-wedding`.
3. `.github/workflows/publish-wedding.yml` lê a publicação no GAS com Bun, roda
   `bun apps/portifolio/scripts/generate-wedding.ts publication.json` e faz commit das
   `index.mdx` geradas em `apps/portifolio/src/content/weddings/<slug>/`.
4. O push em `main` dispara o build no Cloudflare Pages.
5. O GAS é publicado com `bun run gs:deploy` (que atualiza o `apps/gas/dist/`) e
   o `/admin` embebe a URL `/exec` do Web App — defina `PUBLIC_CMS_URL` no build
   do site apontando para ela (ex.: `https://script.google.com/macros/s/<url_id>/exec`).
   Na publicação do Apps Script use acesso "Qualquer pessoa" + autenticação por
   senha (`ADMIN_PASSWORD_HASH`, §14) — em iframe cross-site a auth por conta
   Google não funciona.

### Variáveis

| Segredo                                    | Onde                     | Necessário para                                    |
| ------------------------------------------ | ------------------------ | -------------------------------------------------- |
| `CMS_API_TOKEN`                            | Repo + Script Properties | Calls autenticadas do GAS                          |
| `GITHUB_OWNER/REPO/TOKEN`                  | Script Properties        | Disparar o `repository_dispatch`                   |
| `ADMIN_PASSWORD_HASH`                      | Script Properties        | Login do painel (obrigatório p/ o iframe `ANYONE`) |
| `SHEET_ID`, `DRIVE_ROOT_ID`, `MIN_GALLERY` | Script Properties        | Opcional (defaults no `apps/gas/`)                 |
| `PUBLIC_CMS_URL`                           | Build do site            | `/admin` embutir o iframe (URL `/exec`)            |

## Deploy

Cloudflare Pages, conectado ao repositório:

- **Build command:** `bun run build`
- **Output directory:** `apps/portifolio/dist`
- **Branch:** `main`

`apps/portifolio/public/_headers` define cache e cabeçalhos de segurança; `_redirects`
trata slugs renomeados.

## Licença

Projeto privado. Todos os direitos das fotografias pertencem ao autor.
