// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { SITE } from './src/site.config.ts';

/**
 * Data de última modificação por URL, extraída do frontmatter das entradas.
 *
 * O sitemap usava `lastmod: new Date()`, avaliado uma vez no boot do build. Isso
 * faz *todo* URL declarar "modificado agora" em cada deploy, para páginas que
 * não mudam há meses. O Google usa esse campo para decidir o que recrawler, e
 * um `lastmod` sempre atual anula o sinal: o site inteiro passa a
 * parecer recém-editado, o que baixa a prioridade dada a páginas realmente
 * novas.
 *
 * Aqui lemos só a primeira linha do arquivo de cada entrada — o suficiente para
 * casar o path com uma data, sem carregar o content layer inteiro no config.
 */
function buildLastmodMap() {
  /** @type {Map<string, Date>} */
  const map = new Map();
  /** Slugs de rascunho — não entram no sitemap. @type {Set<string>} */
  const drafts = new Set();

  /** @param {string} file @param {string} urlPath */
  const register = (file, urlPath) => {
    const head = readFileSync(file, 'utf8').slice(0, 2000);
    const dateMatch =
      head.match(/^updated:\s*["']?([\d-]{10})/m) ?? head.match(/^date:\s*["']?([\d-]{10})/m);
    if (!dateMatch) return;
    const date = new Date(`${dateMatch[1]}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return;
    const existing = map.get(urlPath);
    if (!existing || date > existing) map.set(urlPath, date);
  };

  const blogDir = new URL('./src/content/blog/', import.meta.url).pathname;
  for (const file of readdirSync(blogDir)) {
    if (!/\.mdx?$/.test(file)) continue;
    const slug = file.replace(/\.mdx?$/, '');
    register(join(blogDir, file), `/blog/${slug}`);
  }

  const weddingsDir = new URL('./src/content/weddings/', import.meta.url).pathname;
  for (const dir of readdirSync(weddingsDir)) {
    const full = join(weddingsDir, dir, 'index.mdx');
    try {
      statSync(full);
    } catch {
      continue;
    }
    // O slug publicado nem sempre é o nome da pasta: `amanda-e-joao` publica
    // como `amanda-e-joao-fazenda-x`.
    const head = readFileSync(full, 'utf8').slice(0, 2000);
    const slugMatch = head.match(/^slug:\s*["']?([^"'\n]+)/m);
    const slug = slugMatch ? slugMatch[1].trim() : dir;
    register(full, `/casamentos/${slug}`);

    if (/^draft:\s*true/m.test(head)) drafts.add(`/casamentos/${slug}`);
  }

  return { map, drafts };
}

const { map: lastmodByPath, drafts: draftPaths } = buildLastmodMap();

/** Arquivos que podem apontar para um asset de `_astro/`. */
const REFERENCEABLE = /\.(html|xml|json|txt|webmanifest|css|js)$/i;

/**
 * As duas formas de referência a um asset, e por que as duas são necessárias.
 *
 * A **absoluta** (`src="/_astro/x.jpg"`) é o que todo mundo escreve. A
 * **relativa** (`from "./lifecycle.C7m0AI1y.js"`) é como os chunks do Vite se
 * importam entre si: nenhum HTML aponta para eles, e ler só a absoluta fazia
 * `lifecycle` e `prefetch` parecerem órfãos. A poda os apagou, quebrando o
 * reveal por rolagem, o header e o roteador em toda página do `preview` —
 * enquanto `dev` seguia normal, porque nunca passa por `astro:build:done`.
 *
 * Note que a relativa só significa algo a partir de um arquivo que mora em
 * `_astro/`: em HTML, `./x` é relativo à URL da página, não ao arquivo.
 *
 * E note que nenhuma das duas é `[\w.$~-]+`: o Astro emite
 * `WhatsApp Image 2026-09-26 at 21.43.39 (1).jpeg` e o HTML cita isso
 * percent-encoded, com `%`, espaço e parênteses. Uma classe de caracteres
 * "segura" faz a referência da galeria inteira ser invisível para a varredura,
 * e as fotos saem como órfãs junto com os originais da câmera que a poda veio
 * remover. Por isso o padrão é "tudo até a próxima aspa ou espaço", e o nome é
 * decodificado na resolução.
 */
const REFERENCIA_ABSOLUTA = /\/_astro\/([^"'\s]+)/g;
const REFERENCIA_RELATIVA = /["'(](\.{1,2}\/[^"'()\s]+)["')]/g;

/**
 * Remove do `dist` os assets que nenhuma página gerada referencia.
 *
 * ## Por que a poda é necessária
 *
 * `getWeddingImages` lista as fotos de uma pasta com `import.meta.glob({ eager:
 * true })`, que é a única forma de varrer um diretório. O lado ruim do eager
 * glob é que ele vira um `import` de asset: o Vite copia cada original da
 * câmera para `dist/_astro/`. São 108 JPEG de 2–5 MB, e o build carregava 60 MB
 * que nenhuma página abre.
 *
 * O `astro:assets` tem a limpeza certa para isso — ele apaga o original de quem
 * não é referenciado fora do processamento de imagem, que é o que acontece com
 * `src/assets` — mas uma imagem que entrou no grafo de módulos conta como
 * referenciada, e é exatamente o caso das fotos de conteúdo. Por isso a poda
 * acontece aqui, depois da geração.
 *
 * Por que "não referenciado" e não "não parece imagem": a regra é verificável
 * a partir do próprio `dist`. Qualquer arquivo dentro de `_astro/` que nenhuma
 * página, feed, sitemap ou stylesheet referencia é, por construção,
 * inalcançável para um visitante. Se a regra deixar de valer, o sintoma é um
 * arquivo sumindo — por isso a poda roda em `astro:build:done`, quando todas as
 * páginas e todas as variantes já estão no disco, nunca sai de `_astro/`, e no
 * fim se audita contra o `dist` para não poder apagar referência viva.
 *
 * @returns {import('astro').AstroIntegration}
 */
function pruneUnreferencedAssets() {
  return {
    name: 'prune-unreferenced-assets',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const assetsDir = join(outDir, '_astro');
        if (!existsSync(assetsDir)) return;

        /** Caminhos absolutos dos arquivos referenciados. @type {Set<string>} */
        const referenciados = new Set();

        /**
         * Todos os arquivos do `dist` que um arquivo referencia.
         *
         * A poda e a auditoria usam esta mesma função de propósito. A auditoria
         * só tem valor se enxergar **exatamente** o que a poda enxerga: quando
         * cada uma tinha o seu próprio regex, a poda apagou coisas que a
         * auditoria não estava olhando — o pior arranjo possível, já que a
         * verificação que existe para pegar o erro passa por cima dele.
         *
         * @param {string} path
         * @returns {string[]}
         */
        const alvosDe = (path) => {
          const content = readFileSync(path, 'utf8');
          /** @type {string[]} */
          const alvos = [];
          /** `url(/_astro/x.jpeg)` captura o `)` do CSS; o nome é o resto. @type {(n: string) => string} */
          const nome = (n) => decodeURIComponent(n).replace(/\)$/, '');

          for (const match of content.matchAll(REFERENCIA_ABSOLUTA)) {
            alvos.push(join(outDir, '_astro', nome(match[1])));
          }
          // Só quem está dentro de `_astro/` importa por caminho relativo.
          if (path.startsWith(assetsDir + sep)) {
            for (const match of content.matchAll(REFERENCIA_RELATIVA)) {
              alvos.push(resolve(dirname(path), nome(match[1])));
            }
          }
          return alvos;
        };

        /**
         * @param {string} directory
         * @param {(path: string) => void} visitar
         */
        const scan = (directory, visitar) => {
          for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) {
              scan(path, visitar);
            } else if (REFERENCEABLE.test(entry.name)) {
              visitar(path);
            }
          }
        };
        scan(outDir, (path) => {
          for (const alvo of alvosDe(path)) referenciados.add(alvo);
        });

        let count = 0;
        let bytes = 0;
        /**
         * @param {string} directory
         */
        const podar = (directory) => {
          for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) {
              podar(path);
              continue;
            }
            if (referenciados.has(path)) continue;

            bytes += statSync(path).size;
            unlinkSync(path);
            count += 1;
          }
        };
        podar(assetsDir);

        /**
         * A poda se audita.
         *
         * "Não referenciado" é uma conclusão sobre o que a varredura viu, e a
         * varredura só enxerga a sintaxe que alguém lembrou de listar. Se sobrou
         * alguma forma de referência que ninguém previu, o sintoma é um 404
         * silencioso no `preview`: animação morta, menu quebrado, galeria
         * vazia, conteúdo preso atrás de `opacity: 0` — e nada no `dev`, que
         * nem passa por aqui, para denunciar.
         *
         * Por isso, depois de apagar, refazemos a varredura com a mesma função e
         * exigimos que todo alvo ainda exista. Uma referência quebrada
         * **derruba o build**.
         */
        /** @type {string[]} */
        const quebradas = [];
        scan(outDir, (path) => {
          for (const alvo of alvosDe(path)) {
            if (existsSync(alvo)) continue;
            quebradas.push(`${relative(outDir, path)} -> ${relative(outDir, alvo)}`);
          }
        });
        if (quebradas.length > 0) {
          throw new Error(
            `Poda do bundle: ${quebradas.length} referência(s) quebrada(s) no dist, ` +
              `o que significa que a varredura de referências está incompleta:\n  ` +
              quebradas.join('\n  '),
          );
        }

        if (count > 0) {
          logger.info(
            `Poda do bundle: ${count} arquivos sem referência removidos de _astro/ ` +
              `(${Math.round(bytes / 1e6)} MB)`,
          );
        }
      },
    },
  };
}

/**
 * Teto de peso do que sai para o navegador.
 *
 * ## Por que um teto automático e não uma olhada no bundle
 *
 * As fotos deste site são o problema conhecido: qualquer coisa que vire um
 * `import` de asset entra no `dist` inteira (ver a poda acima). O JavaScript,
 * pelo outro lado, cresce por descuido — um import a mais, uma dependência
 * arrastada, um polyfill. Nada disso aparece numa revisão de código, e o
 * Lighthouse de quem visita primeiro é que paga a conta.
 *
 * ## Como os números são medidos
 *
 * O tamanho é o do arquivo **comprimido com gzip**, que é o que o servidor
 * entrega. `gzipSync` nível 9 é uma aproximação do que GitHub Pages/CDN fazem
 * (nível 6 mais uns bytes de cabeçalho) — difere de alguns por cento, o bastante
 * para um limite de duas casas, não para uma auditoria de byte.
 *
 * Um limite estourado **derruba o build**. É proposital: um teto que só avisa
 * é ignorado no primeiro dia. Para subir um limite de verdade, mexa no número
 * aqui e deixe o motivo no commit — é isso que o valor documenta.
 *
 * Os números de hoje: 7 kB de JS e 8 kB de CSS por página, com folga de 5×.
 */
const BUDGET = {
  /** JS comprimido por página. */
  jsPerPage: 40 * 1024,
  /** CSS comprimido por página. */
  cssPerPage: 30 * 1024,
  /** HTML comprimido de uma página. */
  htmlPerPage: 40 * 1024,
  /**
   * Maior arquivo de imagem aceito.
   *
   * Não pode ser apertado como o resto: a única foto acima de 400 kB é a
   * variante de 1920 px do lightbox, e cortar ela por um teto significaria
   * entregar uma foto pior justamente na tela de Ampliar. O valor é pensado
   * para pegar o que ele precisa pegar — um original da câmera que voltou a ser
   * referenciado (1,3 MB a 4 MB) e um PNG de origem emitindo fallback sem
   * compressão.
   */
  maxImageBytes: 1024 * 1024,
  /** `dist` inteiro. Estouro aqui é aviso, não falha: o teto é do repositório. */
  distTotal: 80 * 1000 * 1000,
};

/** @param {string} file */
const gzippedSize = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

/**
 * Soma recursiva de bytes.
 *
 * O acumulador é passado por parâmetro de propósito. Na versão com `total +=`
 * numa closure, `total += f(dir)` lê `total`, a recursão o altera e a atribuição
 * externa sobrescreve a diferença com o valor lido antes — o resultado vinha
 * como "99 KB" para um `dist` de 63 MB.
 *
 * @param {string} directory
 * @param {number} [sum]
 * @returns {number}
 */
function dirSize(directory, sum = 0) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    sum = entry.isDirectory() ? dirSize(path, sum) : sum + statSync(path).size;
  }
  return sum;
}

/**
 * Confere o `dist` contra o `BUDGET`.
 *
 * @returns {import('astro').AstroIntegration}
 */
function enforceBundleBudget() {
  return {
    name: 'enforce-bundle-budget',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const assetsDir = join(outDir, '_astro');

        /** @type {string[]} */
        const errors = [];

        /** @param {number} bytes @param {number} limit @param {string} what */
        const over = (bytes, limit, what) =>
          `${what}: ${Math.round(bytes / 1024)} kB acima de ${Math.round(limit / 1024)} kB`;

        // --- por página: o que o visitante baixa antes de ver a foto -------
        /** @type {{ page: string, file: string }[]} */
        const pages = [];
        /** @param {string} directory */
        const walk = (directory) => {
          for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (entry.name.endsWith('.html'))
              pages.push({ page: relative(outDir, path), file: path });
          }
        };
        walk(outDir);

        for (const { page, file } of pages) {
          const html = readFileSync(file, 'utf8');
          /** @param {RegExp} pattern */
          const sumAssets = (pattern) => {
            const names = new Set([...html.matchAll(pattern)].map((match) => match[1]));
            let total = 0;
            for (const name of names) {
              const asset = join(assetsDir, name);
              if (existsSync(asset)) total += gzippedSize(asset);
            }
            return total;
          };

          const js = sumAssets(/\/_astro\/([\w.$~-]+\.js)/g);
          if (js > BUDGET.jsPerPage) errors.push(`${page} — ${over(js, BUDGET.jsPerPage, 'JS')}`);

          const css = sumAssets(/\/_astro\/([\w.$~-]+\.css)/g);
          if (css > BUDGET.cssPerPage)
            errors.push(`${page} — ${over(css, BUDGET.cssPerPage, 'CSS')}`);

          const self = gzippedSize(file);
          if (self > BUDGET.htmlPerPage)
            errors.push(`${page} — ${over(self, BUDGET.htmlPerPage, 'HTML')}`);
        }

        // --- imagens: uma foto de 3 MB na dist é sempre um bug --------------
        if (existsSync(assetsDir)) {
          for (const name of readdirSync(assetsDir)) {
            const path = join(assetsDir, name);
            if (!/\.(jpe?g|png|avif|webp|gif)$/i.test(name)) continue;
            const size = statSync(path).size;
            if (size > BUDGET.maxImageBytes) {
              errors.push(
                `_astro/${name} — imagem de ${Math.round(size / 1024)} kB, ` +
                  `teto de ${Math.round(BUDGET.maxImageBytes / 1024)} kB`,
              );
            }
          }
        }

        if (errors.length > 0) {
          throw new Error(
            `Orçamento de bundle estourado (${errors.length}):\n  - ${errors.join('\n  - ')}`,
          );
        }

        // --- dist inteira: aviso --------------------------------------------
        const total = dirSize(outDir);

        const message = `Orçamento de bundle ok (dist com ${Math.round(total / 1e6)} MB)`;
        if (total > BUDGET.distTotal)
          logger.warn(`${message} — acima dos ${BUDGET.distTotal / 1e6} MB`);
        else logger.info(message);
      },
    },
  };
}

// Páginas sem data própria não recebem `lastmod`: omitir o campo é honesto,
// enquanto `new Date()` seria uma afirmação falsa de modificação.
export default defineConfig({
  /**
   * Desligado de propósito, e é a única configuração aqui que não é sobre o
   * site: é sobre a Cloudflare.
   *
   * A ofuscação de e-mail da Cloudflare (Email Address Obfuscation, feature de
   * zona) se neutraliza por marcação — `<!--email_off-->` em volta do trecho —
   * e esse é o único opt-out que existe. O compressor de HTML do Astro remove
   * comentários, então no padrão o marcador morre antes de sair do build e a
   * proteção não existe, sem erro nenhum para denunciar.
   *
   * O preço é 5,2 kB de gzip em todo o site e 0,4 kB na maior página, contra
   * um teto de 40 kB por página. Em troca o HTML servido é o que está escrito
   * no fonte, sem regra implícita de colapso de espaço em volta dos elementos.
   *
   * Se a ofuscação for desligada na zona e continuar assim, voltar ao padrão
   * aqui é seguro — mas aí a proteção passa a depender de ninguém mexer no
   * toggle. Ver `src/components/EmailOff.astro`.
   */
  compressHTML: false,
  site: SITE.url,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    mdx({
      optimize: true,
      gfm: true,
    }),
    pruneUnreferencedAssets(),
    // Precisa vir depois da poda: o `dist` só é definitivo depois dela.
    enforceBundleBudget(),
    sitemap({
      changefreq: 'weekly',
      // Só páginas públicas navegáveis chegam ao sitemap por padrão. O
      // `/rss.xml` gerado também é um `.xml` e ficaria listado como página.
      filter: (page) =>
        !page.endsWith('/404') &&
        !page.includes('/_astro') &&
        !page.endsWith('.xml') &&
        !draftPaths.has(new URL(page).pathname.replace(/\/$/, '')),
      serialize(item) {
        const url = new URL(item.url);
        const date = lastmodByPath.get(url.pathname.replace(/\/$/, ''));
        return { ...item, ...(date ? { lastmod: date.toISOString() } : { lastmod: undefined }) };
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: true,
});
