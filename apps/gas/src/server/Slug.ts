/** Geração de slug sem colisão com outro evento já salvo na planilha. */
const Slug = {
  /** "Yara e Ataíde" -> "yara-e-ataide" (sem acentos, minúsculas, hífens). */
  slugify(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  /**
   * Candidatos em ordem: base (casal) → base-cidade → base-2, base-3, …
   * O sufixo da cidade desambigua "Yara e Ataíde" em Belo Horizonte e em
   * Ouro Preto; o sufixo numérico resolve o caso raro de repetição acima disso.
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
