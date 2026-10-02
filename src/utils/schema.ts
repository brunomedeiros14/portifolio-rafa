import { SITE, absolute } from '../site.config';

/**
 * Identidade de uma entidade dentro do grafo de structured data.
 *
 * Sem `@id`, o Google vê cada bloco JSON-LD como uma entidade isolada: a
 * `Person` da home, a `publisher` de cada `BlogPosting` e o `provider` da
 * listagem de casamentos são estruturalmente iguais, mas não se conectam.
 * Usar o mesmo `@id` em todos os lugares permite que o buscador reconheça que
 * é a mesma pessoa e mescle as propriedades (o "sameAs" da home passa a
 * valer para o autor dos posts).
 */
export const ID = {
  person: `${absolute('/')}#person`,
  website: `${absolute('/')}#website`,
  business: `${absolute('/')}#business`,
} as const;

/** Entidade da pessoa, usada como autor/publisher/provider. */
export function personRef() {
  return {
    '@type': 'Person',
    '@id': ID.person,
    name: SITE.name.replace(/\s*-\s*Fotos$/, ''),
    url: absolute('/sobre'),
  };
}

/** Autor de um artigo, com o mesmo `@id` da home. */
export function authorRef(name?: string) {
  return {
    '@type': 'Person',
    '@id': ID.person,
    ...(name && name !== SITE.name ? { name } : {}),
    url: absolute('/sobre'),
  };
}

export function publisherRef() {
  return { '@type': 'Person', '@id': ID.person, name: SITE.name, url: absolute('/sobre') };
}

/**
 * Envelope padrão: sem `inLanguage` e `url`, os rich results ficam incompletos
 * e o Search Console não valida a entidade.
 */
export function node<T extends Record<string, unknown>>(data: T) {
  return {
    '@context': 'https://schema.org',
    inLanguage: SITE.language,
    ...data,
  };
}
