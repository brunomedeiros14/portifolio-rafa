import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';

/**
 * Descobre todas as imagens de um casamento a partir de `content/weddings/<slug>/images/`.
 *
 * O glob com `eager` é o que faz o Astro copiar o arquivo original da câmera
 * para `dist/_astro` — 60 MB de JPEG que nenhuma página referencia. O
 * `astro:assets` remove o original de quem não é importado fora do
 * processamento de imagem (é o que ele faz com `src/assets`), mas uma imagem
 * que entra no grafo de módulos conta como referenciada e fica no bundle. Por
 * isso o original não some sozinho: `astro.config.mjs` poda, no fim do build,
 * os arquivos de `dist` que nenhuma página gerada referencia.
 */
const imageModules = import.meta.glob('../content/weddings/*/images/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
}) as unknown as Record<string, ImageMetadata>;

function baseName(src: string): string {
  const clean = src.split('?')[0];
  return clean.split('/').pop() ?? clean;
}

/** Identidade estável de uma imagem (mantém o nome original do arquivo quando disponível). */
function imageKey(image: ImageMetadata): string {
  if ('fsPath' in image && typeof (image as { fsPath?: string }).fsPath === 'string') {
    return baseName((image as { fsPath: string }).fsPath);
  }
  return baseName(image.src);
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Pasta física do casamento (nome do diretório) a partir do arquivo da entrada. */
export function weddingFolder(entry: { filePath?: string; data: { slug: string } }): string {
  const path = entry.filePath?.replace(/\\/g, '/') ?? '';
  const segments = path.split('/');
  return segments.at(-2) || entry.data.slug;
}

/**
 * Lista as imagens da pasta do casamento, ordenadas naturalmente,
 * com opção de excluir a imagem de capa (que já aparece no hero da página).
 */
export function getWeddingImages(
  slugOrFolder: string,
  excludeCover?: ImageMetadata,
): ImageMetadata[] {
  const prefix = `../content/weddings/${slugOrFolder}/images/`;
  const excluded = excludeCover ? imageKey(excludeCover) : null;

  return Object.entries(imageModules)
    .filter(([key]) => key.startsWith(prefix))
    .filter(([, image]) => imageKey(image) !== excluded)
    .sort(([a], [b]) => collator.compare(a, b) || a.localeCompare(b))
    .map(([, image]) => image);
}

export interface GalleryItem {
  image: ImageMetadata;
  caption: string;
}

/** Legendas contextuais padrão — uma sequência editorial curta por imagem. */
const DEFAULT_CAPTIONS = [
  'Preparativos',
  'Dentro das minhas lembranças',
  'Um instante que ficou',
  'Retratos',
  'Na sombra do casarão',
  'Segredos trocados antes do altar',
  'Cerimônia',
  'Um abraço apertado de todos',
  'A celebração depois do sim',
  'Momentos que a luz testemunhou',
  'Entre amigos e família',
  'O último olhar antes da entrada',
] as const;

export function getGalleryItems(
  images: ImageMetadata[],
  couple: string,
  custom?: string[],
): GalleryItem[] {
  return images.map((image, index) => ({
    image,
    caption: custom?.[index] ?? `${DEFAULT_CAPTIONS[index % DEFAULT_CAPTIONS.length]} — ${couple}`,
  }));
}

/**
 * Como o local é exibido na página do casamento: "Fazenda X, Nova Lima" quando
 * existe estabelecimento, "Nova Lima" quando não existe. Os cards usam só a
 * cidade, então não passam por aqui.
 */
export function weddingPlace(data: { venue?: string; city: string }): string {
  return data.venue ? `${data.venue}, ${data.city}` : data.city;
}

/**
 * Score de relevância entre casamentos (cidade + tags + estado).
 *
 * Compara pela cidade, não pelo estabelecimento: casamentos na mesma cidade
 * separem em lugares diferentes e ainda assim interessam mais ao mesmo leitor.
 */
export function weddingSimilarity(
  a: { data: { city: string; state: string; tags: string[] } },
  b: { data: { city: string; state: string; tags: string[] } },
): number {
  let score = 0;
  if (a.data.city === b.data.city) score += 3;
  if (a.data.state === b.data.state) score += 2;
  score += a.data.tags.filter((tag) => b.data.tags.includes(tag)).length;
  return score;
}

/**
 * Casamentos por página na listagem.
 *
 * 12 é o ponto em que a página deixa de ser "role para ver o resto" e vira
 * rolagem infinita: com a faixa editorial de uma linha por casamento, 12 itens
 * dão cerca de duas dobras de tela, o que é o que aguenta a leitura antes do
 * clique. Com 100 casamentos são 9 páginas.
 */
export const WEDDINGS_PAGE_SIZE = 12;

export interface WeddingPage<T> {
  /** Itens desta página. */
  items: T[];
  /** Começando em 1. A página 1 vive em `/casamentos`, as seguintes em `/casamentos/2`. */
  number: number;
  lastPage: number;
  /**
   * Índice do primeiro item **na listagem inteira**, base 0. É o que dá ao
   * `position` do `ItemList` e o número na margem do item: sem ele, a página 3
   * repetiria "01, 02, 03…" e o Google leria três listas que começam igual.
   */
  offset: number;
  total: number;
}

/** Divide a listagem em páginas, já com o deslocamento global de cada uma. */
export function paginateWeddings<T>(entries: T[], pageSize = WEDDINGS_PAGE_SIZE): WeddingPage<T>[] {
  const lastPage = Math.max(1, Math.ceil(entries.length / pageSize));
  return Array.from({ length: lastPage }, (_, index) => ({
    items: entries.slice(index * pageSize, (index + 1) * pageSize),
    number: index + 1,
    lastPage,
    offset: index * pageSize,
    total: entries.length,
  }));
}

/**
 * Nenhum casamento pode publicar num slug que seja só número.
 *
 * A listagem paginada usa `/casamentos/2`, `/casamentos/3`… e essas rotas
 * vencem a rota de detalhe na resolução do Astro. Um casal slugado `2024` seria
 * pedido pela página do casamento e atendido pela listagem — um 404 silencioso
 * num link que já foi compartido. Os slugs saem dos nomes, então é improvável,
 * e por isso a checagem é um build quebrado e não um aviso.
 */
export function assertPaginationSafe(entries: { data: { slug: string } }[]): void {
  const conflito = entries
    .filter(({ data }) => /^\d+$/.test(data.slug))
    .map(({ data }) => data.slug);
  if (conflito.length === 0) return;
  throw new Error(
    `Slug de casamento em conflito com a paginação: ${conflito.join(', ')}. ` +
      `Um slug só com dígitos seria resolvido por /casamentos/<n>.`,
  );
}

/** Caminho público de uma página da listagem. */
export function weddingPagePath(page: { number: number }): string {
  return page.number === 1 ? '/casamentos' : `/casamentos/${page.number}`;
}

/**
 * Casamentos publicados, do mais recente para o mais antigo, já paginados.
 *
 * É o único lugar que coleta a collection para a listagem, então a checagem de
 * slug numérico roda em todo build, sem depender de alguém lembrar de chamar.
 */
export async function listWeddingsPages(): Promise<WeddingPage<CollectionEntry<'weddings'>>[]> {
  const entries = await getCollection('weddings', ({ data }) => !data.draft);
  assertPaginationSafe(entries);
  const ordered = entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  return paginateWeddings(ordered);
}

/**
 * Título e descrição de uma página da listagem.
 *
 * A descrição das páginas 2+ cita os casamentos que estão nelas. Não é enfeite:
 * com 9 páginas(`/casamentos`, `/casamentos/2`…), o Google precisa saber que são
 * páginas diferentes — e não a mesma listagem com o rodapé cortado. Duas
 * descrições idênticas em URLs diferentes são o caminho curto para o conjunto
 * ser tratado como duplicata e Canônico sobre a página 1, o que enterraria 88
 * casamentos.
 */
export function weddingPageMeta<T extends { data: { couple: string } }>(
  page: WeddingPage<T>,
): {
  title: string;
  description: string;
} {
  const base =
    'Histórias reais de casamento fotografadas por Rafael Dias em Belo Horizonte, Nova Lima, Ouro Preto, Tiradentes e por todo Minas Gerais.';
  if (page.number === 1) {
    return { title: 'Casamentos', description: base };
  }

  const nomes = page.items.map(({ data }) => data.couple);
  const listagem =
    nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

  return {
    title: `Casamentos — página ${page.number} de ${page.lastPage}`,
    description: `${base} Página ${page.number} de ${page.lastPage}: ${listagem}.`,
  };
}
