/**
 * Funções globais chamadas pela interface via google.script.run.
 * (O cliente só consegue invocar funções no escopo global do projeto.)
 */

/** Lista eventos com prontidão calculada. */
function apiList() {
  return Events.all();
}

/** Retorna config de UI (minGallery, siteUrl). */
function apiConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    siteUrl: props.getProperty('SITE_URL') || 'https://rafaeldiasfotos.com.br',
    minGallery: Number(props.getProperty('MIN_GALLERY') || '8'),
  };
}

/** Cria um evento e devolve a linha salva (com slug gerado sem conflito). */
function apiCreate(payload) {
  if (!payload || !payload.couple) throw new Error('Informe ao menos o nome do casal.');
  return Events.create(payload);
}

/** Busca um evento pelo slug. */
function apiGet(slug) {
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  return event;
}

/** Salva todo o formulário de edição. */
function apiSave(slug, payload) {
  return Events.update(slug, payload);
}

/** Apaga a linha do evento. */
function apiDelete(slug) {
  Events.remove(slug);
  return { ok: true };
}

/** Upload individual de uma foto (payload base64 { data, name, type }).
 *  Salva na pasta única do evento com nome UUID + extensão original e entra
 *  como "gallery" por padrão. Retorna a lista atualizada de arquivos. */
function apiUploadPhoto(slug, payload) {
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  if (!payload || !payload.data || !payload.name) throw new Error('Selecione uma imagem.');
  const saved = Drive.savePhoto(s, payload);
  Events.appendPhoto(s, {
    name: saved.name,
    id: saved.id,
    label: String(payload.name || saved.name),
  });
  return Events.listFiles(s);
}

/** Marca/limpa a capa pelo nome da foto ('' limpa). */
function apiSetCover(slug, name) {
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  Events.setCover(s, String(name || ''));
  return Events.listFiles(s);
}

/** Remove uma foto (Drive + lista). Se era a capa, limpa. */
function apiRemovePhoto(slug, name) {
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  Drive.removePhoto(s, name);
  Events.removePhoto(s, name);
  return Events.listFiles(s);
}

/** Arquivos do evento ({cover, gallery, story}). */
function apiListFiles(slug) {
  return Events.listFiles(slug);
}

/** Texto da publicação (mesmo JSON enviado ao GitHub) para conferência. */
function apiPublication(slug) {
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  return Publish.buildPublication(event);
}

/**
 * Botão "Executar automação": valida prontidão e dispara o workflow no GitHub.
 */
function apiPublish(slug) {
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  const check = Events.computeStatus(event);
  if (check.missed.length > 0) {
    throw new Error(`Evento incompleto — falta: ${check.missed.join(', ')}`);
  }
  const result = Publish.dispatch(slug);
  if (!result.ok) {
    throw new Error(`GitHub respondeu HTTP ${result.code}: ${result.body}`);
  }
  Events.markPublished(slug);
  return { ok: true, slug };
}