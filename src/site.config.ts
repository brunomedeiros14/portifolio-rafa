export const SITE = {
  /** Nome público / marca do fotógrafo */
  name: "Rafael Dias - Fotos",
  role: "Fotógrafo de casamento",
  /** URL canônica (troque pela produção real) */
  url: "https://rafaeldiasfotos.com.br",
  description:
    "Fotógrafo de casamento em Belo Horizonte e Minas Gerais. Fotografia natural, elegante e emocional, com estética cinematográfica e sem perder a verdade.",
  language: "pt-BR",
  locale: "pt_BR",
  city: "Belo Horizonte",
  state: "MG",
  /** Áreas atendidas — usadas no SEO local e na home */
  areas: [
    "Belo Horizonte",
    "Nova Lima",
    "Ouro Preto",
    "Tiradentes",
    "Lavras Novas",
    "Brumadinho",
    "muito além de Minas",
  ],
  email: "rafaelr7dias@hotmail.com",
  whatsapp: "55 31 99336-6755",
  whatsappUrl: "https://wa.me/5531993366755",
  instagram: "https://www.instagram.com/rafaeldias.foto",
  instagramHandle: "@rafaeldias.foto",
} as const;

export const NAV_LINKS = [
  { label: "Casamentos", href: "/casamentos" },
  { label: "Sobre", href: "/sobre" },
  { label: "Experiência", href: "/experiencia" },
  { label: "Blog", href: "/blog" },
  { label: "Contato", href: "/contato" },
] as const;

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(SITE.language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function absolute(href: string): string {
  if (href.startsWith("http")) return href;
  return new URL(href, SITE.url).toString();
}

/**
 * Normaliza um caminho interno para a URL que o servidor realmente serve.
 *
 * O build usa `build.format: 'directory'` (padrão), então `/blog/ensaio` vira
 * `dist/blog/ensaio/index.html` e é servido em `/blog/ensaio/`. O sitemap
 * emite essa forma com barra final, mas `absolute('/blog/ensaio')` produzia a
 * versão sem — e o canonical apontava para uma URL que redireciona, o que faz o
 * Google enxergar duas URLs para o mesmo conteúdo.
 *
 * Arquivos com extensão (`/rss.xml`, `/og-default.jpg`) ficam como estão.
 */
export function canonicalPath(href: string): string {
  if (href.startsWith("http")) return href;

  const [path, suffix] = href.split(/([?#].*)$/);
  if (!path.endsWith("/") && !/[^/]+\.[a-z0-9]+$/i.test(path)) {
    return `${path}/${suffix ?? ""}`;
  }

  return href;
}

/**
 * Define qual item do menu representa a página atual, para o `aria-current`.
 *
 * Igualdade exata deixava o menu sem nenhum item marcado em toda página
 * interna — em `/casamentos/amanda-e-joao-fazenda-x` nada correspondia a
 * `/casamentos`. A comparação por prefixo respeita a fronteira de segmento
 * para que `/casamentos` não case com `/casamentos-fazenda-x`.
 */
export function isCurrentPath(pathname: string, href: string): boolean {
  const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

  const current = normalize(pathname);
  const target = normalize(href);

  if (current === target) return true;
  if (target === "/") return false;

  return current.startsWith(`${target}/`);
}
