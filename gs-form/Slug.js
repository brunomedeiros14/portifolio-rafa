/**
 * Geração de slug a partir do nome do casal, garantindo que nunca colide
 * com outro evento já salvo na planilha.
 */
const Slug = {
  /** "Marina e Pedro" -> "marina-e-pedro" (sem acentos, minúsculas, hífens). */
  slugify(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  /**
   * Candidatos em ordem de preferência:
   *   1. base (slug do casal)
   *   2. base-local
   *   3. base-2, base-3, ...
   *
   * O sufixo vem de `location`, que aceita cidade ("Ouro Preto") ou
   * estabelecimento ("Fazenda X, Nova Lima") — nos dois casos a slug fica
   * legível, porque `slugify` reduz qualquer texto ao formato de URL.
   */
  ensureUnique(base, location, existingSlugs) {
    const taken = new Set(existingSlugs || []);
    const candidates = [base];
    const locationSlug = Slug.slugify(location);
    if (locationSlug) candidates.push(`${base}-${locationSlug}`);

    for (const candidate of candidates) {
      if (candidate && !taken.has(candidate)) return candidate;
    }

    let i = 2;
    for (;;) {
      const candidate = `${base}-${i++}`;
      if (!taken.has(candidate)) return candidate;
    }
  },
};