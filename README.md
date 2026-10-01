# Rafael Dias — Fotografia de Casamento

Portfólio e site institucional de fotógrafo de casamento em Belo Horizonte e
Minas Gerais. Site estático gerado com [Astro](https://astro.build),
[MDCX](https://mdxjs.com/) para o conteúdo e Tailwind CSS v4 para o estilo.

- **Idioma:** pt-BR (único, sem i18n)
- **Saída:** 100% estática (`dist/`), sem servidor
- **Deploy:** Cloudflare Pages, build a partir de `main`
- **CMS:** Google Apps Script (`gs-form/`) publica casamentos via GitHub Actions

## Stack

| Camada            | Escolha                                  |
| ----------------- | ---------------------------------------- |
| Framework         | Astro 7 (`output: 'static'`)            |
| Conteúdo          | Content Collections + MDX (glob loader)  |
| Estilo            | Tailwind CSS v4 (`@tailwindcss/vite`)    |
| Imagens           | `astro:assets` / `sharp`                 |
| SEO               | `@astrojs/sitemap` + JSON-LD por página  |
| Transições        | `astro:transitions` (`ClientRouter`)     |
| Validação         | `astro check`                            |

## Comandos

| Comando          | Ação                                                |
| ---------------- | --------------------------------------------------- |
| `pnpm install`   | Instala as dependências                             |
| `pnpm dev`       | Servidor de desenvolvimento em `localhost:4321`      |
| `pnpm build`     | Build de produção em `dist/`                        |
| `pnpm preview`   | Serve o build local para conferência                |
| `pnpm check`     | Verificação de tipos de `.astro` e `.ts`            |
| `pnpm astro ...` | CLI do Astro (ex.: `pnpm astro info`)               |

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

public/                  # favicon, og-default, webmanifest, fonts/
scripts/                 # scripts Node (pipeline de publicação)
gs-form/                 # projeto Google Apps Script (CMS)
```

## Rotas

| Rota                    | Tipo   | Conteúdo                                   |
| ----------------------- | ------ | ------------------------------------------ |
| `/`                     | SSG    | Home, destaques e seleção editorial        |
| `/casamentos`           | SSG    | Índice do portfólio                        |
| `/casamentos/[slug]`   | SSG    | Detalhe de um casamento (`getStaticPaths`) |
| `/blog`                 | SSG    | Lista de artigos                           |
| `/blog/[slug]`          | SSG    | Artigo (`getStaticPaths`)                  |
| `/sobre`                | SSG    | Sobre o fotógrafo                          |
| `/experiencia`          | SSG    | Processo, do contato à entrega             |
| `/contato`              | SSG    | Canais de contato                          |
| `/404`                  | SSG    | Página de erro (`noindex`)                 |

## Publicar um casamento (CMS)

O `gs-form` é um painel em Google Apps Script que grava os dados numa Google
Sheet, sobe as fotos para o Drive e dispara o workflow de publicação.

1. No painel, preencha o evento, envie as fotos e marque no editor quais
   imagens são `cover`, quais são `story` e quais vão para a galeria.
2. **Executar automação** faz `repository_dispatch` com `publish-wedding`.
3. `.github/workflows/publish-wedding.yml` lê a publicação no GAS, roda
   `node scripts/generate-wedding.mjs publication.json` e faz commit das
   `index.mdx` geradas em `src/content/weddings/<slug>/`.
4. O push em `main` dispara o build no Cloudflare Pages.

### Variáveis

| Segredo               | Onde                     | Necessário para                       |
| --------------------- | ------------------------ | ------------------------------------- |
| `CMS_API_TOKEN`       | Repo + Script Properties | Calls autenticadas do GAS             |
| `GITHUB_OWNER/REPO/TOKEN` | Script Properties   | Disparar o `repository_dispatch`      |
| `SHEET_ID`, `DRIVE_ROOT_ID`, `MIN_GALLERY`, `SITE_URL` | Script Properties | Opcional (defaults no `gs-form/`) |

## Deploy

Cloudflare Pages, conectado ao repositório:

- **Build command:** `pnpm build`
- **Output directory:** `dist`
- **Branch:** `main`

`public/_headers` define cache e cabeçalhos de segurança; `public/_redirects`
trata slugs renomeados.

## Licença

Projeto privado. Todos os direitos das fotografias pertencem ao autor.