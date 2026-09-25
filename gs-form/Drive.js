/**
 * Persistência de fotos no Google Drive.
 *
 * Estrutura de pastas:
 *   <DRIVE_ROOT_ID>/
 *     <slug>/
 *       <uuid.ext>   (todas as fotos na mesma pasta, nome UUID + extensão original)
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

  /** Marca o arquivo como público (leitura para qualquer pessoa com o link). */
  setPublic(file) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  },

  /** URL direta de download para o workflow. */
  downloadUrl(id) {
    return `https://drive.google.com/uc?export=download&id=${id}`;
  },

  /** Extensão preservada do nome original; fallback pelo MIME. */
  extension_(rawName, mime) {
    const byName = String(rawName || '').match(/\.([A-Za-z0-9]{1,10})$/);
    if (byName) return `.${byName[1].toLowerCase()}`;
    const byMime = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/heic': '.heic',
      'image/heif': '.heif',
      'image/gif': '.gif',
      'image/bmp': '.bmp',
    }[String(mime || '').split(';')[0]];
    return byMime || '.jpg';
  },

  /**
   * Salva uma foto recebida em base64 (payload { data, name, type }) na pasta do evento.
   * O nome no Drive é um UUID com a extensão original preservada.
   * Retorna { name, id }.
   */
  savePhoto(slug, payload) {
    const folder = Drive.folderFor(slug);
    const name = `${Utilities.getUuid()}${Drive.extension_(payload.name || '', payload.type || '')}`;
    const bytes = Utilities.base64Decode(String(payload.data || ''));
    const blob = Utilities.newBlob(bytes, String(payload.type || 'image/jpeg').split(';')[0], name);
    const file = folder.createFile(blob);
    file.setName(name);
    Drive.setPublic(file);
    return { name: file.getName(), id: file.getId() };
  },

  /** Remove (joga no lixo) o arquivo com o nome informado, se existir. */
  removePhoto(slug, name) {
    const folder = Drive.folderFor(slug);
    const it = folder.getFilesByName(String(name || ''));
    if (it.hasNext()) it.next().setTrashed(true);
  },
};