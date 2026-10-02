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
  // O sharp não amplia: pedir 1200px para uma capa de 1080 devolve 1080. Como
  // as dimensões declaradas em `og:image:width/height` vêm daqui, devolver as
  // pedidas anunciava um arquivo maior do que o que existe — e o retrato, que
  // é quadrado, saía em 1080x630, proporção 1.71 em vez de 1.91.
  const width = Math.min(OG_WIDTH, cover.width);
  const height = Math.round(width / (OG_WIDTH / OG_HEIGHT));

  const out = await getImage({
    src: cover,
    width,
    height,
    fit: 'cover',
    position: 'attention',
    format: 'jpeg',
    quality: 80,
  });

  // As dimensões reais do arquivo, não as do pedido.
  return {
    src: out.src,
    width: out.attributes.width,
    height: out.attributes.height,
  };
}
