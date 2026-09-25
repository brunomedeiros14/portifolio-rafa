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

/** Faz upload da capa (único arquivo, input name="cover"). */
function apiUploadCover(slug, cover) {
  if (!cover || !cover.getName) throw new Error('Selecione uma imagem de capa.');
  const saved = Drive.saveBlob(slug, 'cover', cover, cover.getName());
  Events.setCover(slug, saved);
  return Events.listFiles(slug);
}

/** Upload em lote de galeria ou story (input name="files"). */
function apiUploadFiles(slug, kind, files) {
  if (!['gallery', 'story'].includes(kind)) throw new Error(`Tipo inválido: ${kind}`);
  const blobList = (Array.isArray(files) ? files : [files]).filter((f) => f && f.getName);
  if (blobList.length === 0) throw new Error('Selecione ao menos uma imagem.');
  const saved = [];
  for (const blob of blobList) {
    saved.push(Drive.saveBlob(slug, kind, blob, blob.getName()));
  }
  Events.appendFiles(slug, kind, saved);
  return Events.listFiles(slug);
}

/** Remove um arquivo (Drive + referência na planilha). */
function apiRemoveFile(slug, kind, name) {
  Drive.remove(slug, kind, name);
  Events.removeFile(slug, kind, name);
  return Events.listFiles(slug);
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