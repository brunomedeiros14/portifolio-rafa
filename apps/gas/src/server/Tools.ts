/**
 * Ferramentas administrativas (não disponíveis na UI): corrigir nomes de fotos
 * com o bug antigo `001-1.jpg`, republicar célula `status`, e reparar JSON
 * corrompido na célula. Preservam o texto cru — o `parseJSON_` do Events já
 * entrega `gallery_raw`/`tags_raw`, e Console doseadas.
 */

function repairPhotoNames() {
  const edited: string[] = [];
  let repairAtrasados = 0;
  Events.all().forEach((event) => {
    const list = Array.isArray(event.gallery) ? event.gallery : [];
    repairAtrasados += list.filter(
      (f) => f.name && !/^\d{3}\.(jpg|jpeg|png|webp)$/i.test(f.name),
    ).length;
    let changed = false;
    const fixed = list.map((f) => {
      if (!f.name || /^\d{3}\.(jpg|jpeg|png|webp)$/i.test(f.name)) return f;
      const m = String(f.name).match(/(\d{3})[._-]/);
      const ext = String(f.name).match(/\.(\w+)$/);
      const next =
        (m ? m[1] : ('' + (list.indexOf(f) + 1)).padStart(3, '0')) + '.' + (ext ? ext[1] : 'jpg');
      changed = true;
      return Object.assign({}, f, { name: next });
    });
    if (changed) {
      Events.setRow_(event.slug, { gallery: fixed });
      edited.push(event.slug);
    }
  });
  return { ok: true, edited, repairAtrasados };
}

/** Força `status` por célula (ex.: evento publicado manualmente antes do dispatch). */
function republishEvent(slug) {
  const event = Events.get(slug);
  if (!event) return { error: 'not_found' };
  Events.markPublished(slug);
  return { ok: true, slug };
}
