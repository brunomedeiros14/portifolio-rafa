/**
 * Persistência de fotos no Google Drive.
 *
 * Estrutura de pastas:
 *   <DRIVE_ROOT_ID>/
 *     <slug>/
 *       <NN-serial.ext>   (todas as fotos na mesma pasta)
 *
 * O nome é sequencial em vez de UUID: a ordenação natural da pasta vira a ordem
 * de exibição na galeria, e o nome legível ajuda a achar o arquivo no Drive
 * quando algo precisa ser conferido na mão. A sequência só é única dentro da
 * pasta do evento, que é a única forma como ele é usado.
 *
 * Os arquivos são compartilhados como "qualquer pessoa com o link" para que o
 * workflow do GitHub consiga baixar sem autenticação — mas **só depois** que a
 * planilha aceitou a linha (ver `savePhoto`): marcar antes deixava JPEG órfão
 * acessível por qualquer um sempre que a escrita falhasse.
 */
const Files = {
  /**
   * Prefixo aceito por upload. O `payload.type` vai para dentro do
   * `Utilities.newBlob`, ou seja, um MIME inventado pelo cliente viraria o
   * Content-Type do arquivo público.
   */
  ALLOWED_MIME: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],

  /** Teto por arquivo. Acima disso o payload base64 estoura o limite do GAS. */
  MAX_BYTES: 30 * 1024 * 1024,

  /** Teto de fotos por evento — corta uploads duplicados antes de encher o Drive. */
  MAX_PHOTOS: 400,

  MIME_EXT: {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
  },

  EXT_MIME: {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
  },

  /** Aproximação só para a mensagem de erro (o MIME não é confiável). */
  mb_(bytes) {
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  },

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
    const root = Files.root_();
    const it = root.getFoldersByName(slug);
    return it.hasNext() ? it.next() : root.createFolder(slug);
  },

  /** Marca o arquivo como público (leitura para qualquer pessoa com o link). */
  setPublic(file) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  },

  /**
   * URL de download para o workflow.
   *
   * `confirm=t` evita a página interstitial de "o arquivo é grande demais,
   * verifique a senha" que o Drive serve para arquivos acima de ~100 MB: o
   * `fetch` do Node receberia HTML onde esperava bytes, e o script gravaria
   * esse HTML em `images/`.
   */
  downloadUrl(id) {
    return `https://drive.google.com/uc?export=download&confirm=t&id=${id}`;
  },

  /**
   * Valida e decodifica o payload antes de tocar o Drive.
   * Lança com mensagem legível — é a mensagem que aparece no toast do painel.
   */
  decode_(payload) {
    const mime = String(payload.type || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const rawName = String(payload.name || '');

    // O MIME declarado pelo cliente é aceito só se for de imagem; senão cai para
    // o deduzido pela extensão do nome, que também precisa ser imagem.
    const byExt = rawName.match(/\.([A-Za-z0-9]{1,10})$/);
    const extMime = byExt ? Files.EXT_MIME[byExt[1].toLowerCase()] : undefined;
    const mimeOk = Files.ALLOWED_MIME.indexOf(mime) >= 0;
    const resolved = mimeOk ? mime : extMime;

    if (!resolved) {
      throw new Error(`"${rawName}" não é uma imagem suportada (JPEG, PNG, WebP ou AVIF).`);
    }

    const data = String(payload.data || '');
    if (!data) throw new Error('Imagem vazia.');

    const bytes = Utilities.base64Decode(data.replace(/^data:[^;]+;base64,/, ''));
    if (!bytes || !bytes.length) throw new Error('Não foi possível ler a imagem enviada.');

    if (bytes.length > Files.MAX_BYTES) {
      throw new Error(
        `"${rawName}" tem ${Files.mb_(bytes.length)} MB; o limite é ${Files.mb_(Files.MAX_BYTES)} MB.`,
      );
    }

    return { bytes, mime: resolved, ext: Files.MIME_EXT[resolved] || '.jpg' };
  },

  /** Próximo nome sequencial na pasta (`NN-serial.ext`, 3 dígitos). */
  nextName_(folder, ext) {
    let max = 0;
    const it = folder.getFiles();
    while (it.hasNext()) {
      const name = it.next().getName();
      const m = String(name).match(/^(\d{3})-/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    const serial = Math.min(999, max + 1);
    return `${String(serial).padStart(3, '0')}${ext}`;
  },

  /**
   * Grava a foto na pasta do evento e devolve `{ name, id, mime }`.
   *
   * O arquivo nasce **privado**: quem chama (`Api.apiUploadPhoto`) só o torna
   * público depois que `Events.appendPhoto` confirmou a linha. Marcar aqui
   * deixava JPEG órfão acessível por qualquer um sempre que a escrita na
   * planilha falhasse.
   */
  savePhoto(slug, payload) {
    const decoded = Files.decode_(payload);
    const folder = Files.folderFor(slug);
    const name = Files.nextName_(folder, decoded.ext);
    const blob = Utilities.newBlob(decoded.bytes, decoded.mime, name);
    const file = folder.createFile(blob);
    file.setName(name);
    return {
      name: file.getName(),
      id: file.getId(),
      mime: decoded.mime,
      bytes: decoded.bytes.length,
    };
  },

  /** Torna público o arquivo que já está registrado na planilha. */
  publish_(id) {
    Files.setPublic(DriveApp.getFileById(id));
  },

  /** Remove (joga no lixo) o arquivo com o nome informado, se existir. */
  removePhoto(slug, name) {
    const folder = Files.folderFor(slug);
    const it = folder.getFilesByName(String(name || ''));
    while (it.hasNext()) it.next().setTrashed(true);
  },

  /**
   * Acompanha a renomeação do slug. As pastas do Drive são nomeadas pelo slug;
   * sem isto, trocar o slug criaria uma pasta vazia e as fotos existentes
   * "sumiriam" do painel.
   */
  renameFolder_(fromSlug, toSlug) {
    const root = Files.root_();
    const it = root.getFoldersByName(String(fromSlug || ''));
    if (!it.hasNext()) return false;
    it.next().setName(String(toSlug));
    return true;
  },

  /** Lixeira um arquivo recém-criado cujo registro na planilha não entrou. */
  discard_(id) {
    try {
      if (id) DriveApp.getFileById(id).setTrashed(true);
    } catch (err) {
      console.error(
        'Files.discard_ falhou para ' + id + ': ' + String((err && err.message) || err),
      );
    }
  },
};
