import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/**
 * Dimensões que o Facebook/X/LinkedIn esperam para um preview grande.
 * Qualquer coisa fora dessa proporção é recortada ou apresentada com barras.
 */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export interface OgImage {
  src: string;
  width: number;
  height: number;
}

/**
 * Gera a imagem de compartilhamento a partir da capa do ensaio.
 *
 * Antes, `og:image` apontava para `data.cover.src`, ou seja, o arquivo original
 * da câmera. Isso quebrava o requisito de proporção do Open Graph: as capas são
 * 3:2 (1600x1067) e uma delas é vertical (4016x6016), contra os 1.91:1 das
 * plataformas. O Facebook ainda tenta renderizar, mas com barra lateral ou
 * corte central mal escolhido — no caso da capa da Sara, um retrato, o
 * enquadramento perde os lados inteiros da cena.
 *
 * Pior, a URL original também arrastava o JPEG de 2,5 MB para o `dist/`.
 */
export async function ogImageFrom(cover: ImageMetadata): Promise<OgImage> {
  const out = await getImage({
    src: cover,
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fit: 'cover',
    position: 'attention',
    format: 'jpeg',
    quality: 80,
  });

  return {
    src: out.src,
    width: OG_WIDTH,
    height: OG_HEIGHT,
  };
}
