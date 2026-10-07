/** Espelha os tipos do servidor (`src_gas/src/server/types.ts`). */
export interface FotoGaleria {
  name: string;
  id: string;
  label: string;
  bytes: number;
  clientId: string;
}

export interface Evento {
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
  status: 'unpublished' | 'published';
  draft: boolean;
  created_at: string;
  updated_at: string;
  ready?: 'ready' | 'pending';
  missed?: string[];
}

export interface ArquivosEvento {
  cover: { name: string; id: string } | null;
  photos: FotoGaleria[];
}

export interface Config {
  minGallery: number;
  email: string;
}

export interface Checklist {
  status: 'ready' | 'pending';
  missed: string[];
}
