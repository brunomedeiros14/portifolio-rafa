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
   *   2. base-cidade
   *   3. base-2, base-3, ...
   */
  ensureUnique(base, city, existingSlugs) {
    const taken = new Set(existingSlugs || []);
    const candidates = [base];
    const citySlug = Slug.slugify(city);
    if (citySlug) candidates.push(`${base}-${citySlug}`);

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