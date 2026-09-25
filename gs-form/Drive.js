/**
 * Persistência de fotos no Google Drive.
 *
 * Estrutura de pastas:
 *   <DRIVE_ROOT_ID>/
 *     <slug>/
 *       cover/     (imagem de capa, 1 arquivo)
 *       gallery/   (fotos da galeria, várias)
 *       story/     (fotos inseridas no texto da história, várias)
 *
 * Todos os arquivos são compartilhados como "qualquer pessoa com o link"
 * para que o workflow do GitHub consiga baixar sem autenticação.
 */
const Drive = {
  root_() {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty('DRIVE_ROOT_ID');
    if (!id) {
      const folder = DriveApp.createFolder('Casamentos GS');
      id = folder.getId();
      props.setProperty('DRIVE_ROOT_ID', id);
    }
    return DriveApp.getFolderById(id);
  },

  folderFor(slug) {
    const root = Drive.root_();
    const it = root.getFoldersByName(slug);
    return it.hasNext() ? it.next() : root.createFolder(slug);
  },

  kindFolder(slug, kind) {
    const dir = Drive.folderFor(slug);
    const it = dir.getFoldersByName(kind);
    return it.hasNext() ? it.next() : dir.createFolder(kind);
  },

  /** Marca o arquivo como público (leitura para qualquer pessoa com o link). */
  setPublic(file) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  },

  /** URL direta de download para o workflow. */
  downloadUrl(id) {
    return `https://drive.google.com/uc?export=download&id=${id}`;
  },

  /**
   * Salva um upload recebido em base64 (payload { data, name, type }) dentro da pasta do evento.
   * Antes de salvar, remove um arquivo anterior com o mesmo nome pra impedir duplicidades.
   * Retorna { name, id }.
   */
  savePayload(slug, kind, payload) {
    const folder = Drive.kindFolder(slug, kind);
    const name = Drive.sanitizeName_(payload.name || '', payload.type || '');
    const bytes = Utilities.base64Decode(String(payload.data || ''));
    const blob = Utilities.newBlob(bytes, payload.type || 'image/jpeg', name);

    const existing = folder.getFilesByName(name);
    while (existing.hasNext()) existing.next().setTrashed(true);

    const file = folder.createFile(blob);
    file.setName(name);
    Drive.setPublic(file);
    return { name: file.getName(), id: file.getId() };
  },

  /** Remove (joga no lixo) o arquivo com o nome informado, se existir. */
  remove(slug, kind, name) {
    const folder = Drive.kindFolder(slug, kind);
    const it = folder.getFilesByName(name);
    if (it.hasNext()) it.next().setTrashed(true);
  },

  /** Garante um nome final de arquivo com extensão correta. */
  sanitizeName_(rawName, mime) {
    let name = rawName && String(rawName).trim() ? String(rawName).trim() : 'imagem';
    const extByName = /(\.[^.]+)$/.test(name) ? name.match(/(\.[^.]+)$/)[1] : '';
    const extByMime = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/heic': '.heic',
      'image/heif': '.heif',
    }[mime || ''];
    if (!extByName && extByMime) name = `${name}${extByMime}`;
    return name.replace(/[/\\]/g, '-').replace(/\.{2,}/g, '.').trim();
  },
};