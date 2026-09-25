export const SITE = {
  /** Nome público / marca do fotógrafo */
  name: "Rafael Dias - Fotos",
  /** Nome curto usado no logo */
  brand: "Rafael",
  role: "Fotógrafo de casamento",
  /** URL canônica (troque pela produção real) */
  url: "https://rafaeldiasfotos.com.br",
  description:
    "Fotografia de casamento em Belo Horizonte, Nova Lima, Ouro Preto, Tiradentes e toda Minas Gerais. Imagens atemporais para histórias reais.",
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
  email: "rafaelr7dias@hotmail.com ",
  whatsapp: "55 31 99336-6755",
  whatsappUrl: "https://wa.me/5531993366755",
  instagram: "https://www.instagram.com/rafaeldias.foto",
  instagramHandle: "@rafaeldias.foto",
  socials: [
    {
      label: "Instagram",
      href: "https://www.instagram.com/rafaeldias.foto",
      external: true,
    },
    { label: "WhatsApp", href: "https://wa.me/5531993366755", external: true },
    {
      label: "E-mail",
      href: "mailto:rafaelr7dias@hotmail.com ",
      external: false,
    },
  ],
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
