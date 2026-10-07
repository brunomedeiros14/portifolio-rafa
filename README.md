# Rafael Dias — Fotografia de Casamento

Portfólio e site institucional de fotógrafo de casamento em Belo Horizonte e
Minas Gerais. Site estático gerado com [Astro](https://astro.build),
[MDCX](https://mdxjs.com/) para o conteúdo e Tailwind CSS v4 para o estilo.

- **Idioma:** pt-BR (único, sem i18n)
- **Saída:** 100% estática (`dist/`), sem servidor
- **Deploy:** Cloudflare Pages, build a partir de `main`
- **CMS:** Google Apps Script (`src_gas/`) publica casamentos via GitHub Actions
- **Painel (admin):** `/admin` embebe o CMS num iframe — especificação completa em `cms_spec.md`

## Stack

| Camada     | Escolha                                 |
| ---------- | --------------------------------------- |
| Framework  | Astro 7 (`output: 'static'`)            |
| Conteúdo   | Content Collections + MDX (glob loader) |
| Estilo     | Tailwind CSS v4 (`@tailwindcss/vite`)   |
| Imagens    | `astro:assets` / `sharp`                |
| SEO        | `@astrojs/sitemap` + JSON-LD por página |
| Transições | `astro:transitions` (`ClientRouter`)    |
| Validação  | `astro check`                           |

## Comandos

| Comando             | Ação                                            |
| ------------------- | ----------------------------------------------- |
| `bun install`       | Instala as dependências                         |
| `bun run dev`       | Servidor de desenvolvimento em `localhost:4321` |
| `bun run build`     | Build de produção em `dist/`                    |
| `bun run preview`   | Serve o build local para conferência            |
| `bun run check`     | Verificação de tipos de `.astro` e `.ts`        |
| `bun run astro ...` | CLI do Astro (ex.: `bun run astro info`)        |
| `bun run gs:build`  | Transpila + audita o CMS em `src_gas/dist/`     |
| `bun run gs:test`   | Testes do servidor GAS (`src_gas/test/`)        |
| `bun run gs:check`  | Typecheck servidor+UI + testes + build do CMS   |
| `bun run gs:deploy` | `gs:build` + `clasp push` em `src_gas/dist/`    |

> Em desenvolvimento, prefira rodar o servidor em segundo plano:
> `astro dev --background`, gerenciado com `astro dev stop`,
> `astro dev status` e `astro dev logs`.

## Estrutura

```text
src/
├── assets/              # imagens importadas pelo pipeline de assets
├── components/          # Header, Footer, Hero, Gallery, Lightbox, SEO…
├── content/
│   ├── blog/            # Collection `blog` (MDX + images/)
│   └── weddings/        # Collection `weddings` (um diretório por caso)
├── layouts/             # BaseLayout, BlogLayout, WeddingLayout
├── pages/               # Rotas (ver abaixo)
├── scripts/             # Helpers de runtime (reveal)
├── styles/global.css    # Tokens @theme, base, prosa, animações
├── content.config.ts    # Schemas das collections
├── site.config.ts       # SITE (marca, contato, áreas) e NAV_LINKS
└── utils/weddings.ts    # Descoberta/ordenação de imagens e legendas

public/                  # favicon, webmanifest, robots.txt, fonts/
scripts/                 # scripts Node (pipeline de publicação)
src_gas/                 # projeto Google Apps Script (CMS) — ver cms_spec.md
```

## Rotas

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

O `src_gas` é um painel em Google Apps Script que grava os dados numa Google
Sheet, sobe as fotos para o Drive e dispara o workflow de publicação. Ele roda
embebido em `https://rafaeldiasfotos.com.br/admin` (iframe) e exige senha. Toda a
especificação (modelo, API, segurança, deploy) está em `cms_spec.md`.

1. Abra `/admin`, entre e preencha o evento, envie as fotos e marque uma delas
   como capa — as demais vão para a galeria.
2. **Executar automação** faz `repository_dispatch` com `publish-wedding`.
3. `.github/workflows/publish-wedding.yml` lê a publicação no GAS, roda
   `node scripts/generate-wedding.mjs publication.json` e faz commit das
   `index.mdx` geradas em `src/content/weddings/<slug>/`.
4. O push em `main` dispara o build no Cloudflare Pages.
5. O GAS é publicado com `bun run gs:deploy` (que atualiza o `src_gas/dist/`) e
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
| `SHEET_ID`, `DRIVE_ROOT_ID`, `MIN_GALLERY` | Script Properties        | Opcional (defaults no `src_gas/`)                  |
| `PUBLIC_CMS_URL`                           | Build do site            | `/admin` embutir o iframe (URL `/exec`)            |

## Deploy

Cloudflare Pages, conectado ao repositório:

- **Build command:** `bun run build`
- **Output directory:** `dist`
- **Branch:** `main`

`public/_headers` define cache e cabeçalhos de segurança; `public/_redirects`
trata slugs renomeados.

## Licença

Projeto privado. Todos os direitos das fotografias pertencem ao autor.
