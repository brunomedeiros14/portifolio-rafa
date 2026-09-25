import type { ImageMetadata } from 'astro';

/** Descobre todas as imagens de um casamento a partir de `content/weddings/<slug>/images/`. */
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
export function getWeddingImages(slugOrFolder: string, excludeCover?: ImageMetadata): ImageMetadata[] {
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
    caption:
      custom?.[index] ??
      `${DEFAULT_CAPTIONS[index % DEFAULT_CAPTIONS.length]} — ${couple}`,
  }));
}

/** Proporção da imagem: ratio = largura / altura. */
export function aspectRatioOf(image: ImageMetadata): number {
  return image.width / image.height;
}

/** Escore de relevância entre casamentos (cidade + tags + estado). */
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