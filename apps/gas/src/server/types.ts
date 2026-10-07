/**
 * Tipos globais do servidor do painel.
 *
 * O GAS concatena todos os `.js` num escopo único — por isso estes arquivos
 * **não podem** usar `import`/`export` de topo (o build falha). Os tipos ficam
 * declarados no escopo global e valem para todos os módulos.
 */

interface FotoGaleria {
  name: string;
  id: string;
  label: string;
  bytes: number;
  clientId: string;
}

interface Evento {
  slug: string;
  couple: string;
  date: string;
  city: string;
  state: string;
  venue: string;
  description: string;
  excerpt: string;
  featured: boolean;
  tags: string[];
  cover_id: string;
  cover_name: string;
  gallery: FotoGaleria[];
  /** Estado da última publicação: `unpublished` ainda não foi publicado. */
  status: 'unpublished' | 'published';
  /**
   * Rascunho: a página é gerada, mas sai `noindex` e fora do sitemap. Nasce
   * `true` em eventos novos; é independente de `status` (publicar como rascunho
   * é "publicar só para revisar").
   */
  draft: boolean;
  created_at: string;
  updated_at: string;
  // Derivados, preenchidos em `rowToObject_`:
  ready?: 'ready' | 'pending';
  missed?: string[];
  // Texto cru da célula quando o JSON de `gallery`/`tags` não parseia — para
  // o Tools.repairJson conseguir reconstruir (nunca regravar `[]` em silêncio).
  gallery_raw?: string;
  tags_raw?: string;
}

interface ArquivosEvento {
  cover: { name: string; id: string } | null;
  photos: FotoGaleria[];
}

interface Checklist {
  status: 'ready' | 'pending';
  missed: string[];
}

interface PayloadFoto {
  data: string;
  name: string;
  type?: string;
  clientId?: string;
}

interface FotoPublicacao {
  filename: string;
  url: string;
}

/** JSON devolvido ao workflow — schema em `cms_spec.md` §9.1. */
interface Publicacao {
  slug: string;
  couple: string;
  date: string;
  city: string;
  state: string;
  venue?: string;
  description: string;
  excerpt: string;
  featured: boolean;
  draft: boolean;
  tags: string[];
  cover: { filename: string; url: string } | null;
  gallery: FotoPublicacao[];
}
