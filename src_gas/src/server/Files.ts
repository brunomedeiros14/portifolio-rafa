/**
 * Persistência de fotos no Google Drive.
 *
 *   <DRIVE_ROOT_ID>/<slug>/NNN.ext
 *
 * Nome **sequencial de 3 dígitos**: a ordenação alfabética da pasta é a ordem
 * de exibição na galeria, e o scanner de próximo número lê `/^(\d{3})\./` (sem
 * hífen — um bug histórico gerava `001.jpg` para sempre). Os arquivos nascem
 * privados e só viram "qualquer pessoa com o link" DEPOIS de a planilha aceitar
 * a linha; marcar antes deixava JPEG órfão acessível em caso de falha de escrita.
 */
const Files = {
  ALLOWED_MIME: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],

  /** Teto por arquivo — acima disso o payload base64 estoura o limite do GAS. */
  MAX_BYTES: 30 * 1024 * 1024,

  /**
   * Teto de fotos por evento. Protege a célula `gallery` (~50k chars): com
   * `label` ≤ 120 e `clientId` ≤ 64, estourar em menos de 300 fotos deixava o
   * evento permanentemente ineditável (todo `setRow_` regrava a linha inteira).
   */
  MAX_PHOTOS: 300,

  MAX_LABEL: 120,
  MAX_CLIENT_ID: 64,
  MAX_NAME: 100,

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

  mb_(bytes) {
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  },

  /** Memoizado por execução; perde a corrida de criação sem lock (§14 #7). */
  root_() {
    const props = PropertiesService.getScriptProperties();
    const cached = props.getProperty('DRIVE_ROOT_ID');
    if (cached) return DriveApp.getFolderById(cached);
    const folder = DriveApp.createFolder('Casamentos GS');
    props.setProperty('DRIVE_ROOT_ID', folder.getId());
    return folder;
  },

  folderFor(slug) {
    const root = Files.root_();
    const it = root.getFoldersByName(String(slug || ''));
    return it.hasNext() ? it.next() : root.createFolder(String(slug));
  },

  setPublic(file) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  },

  /**
   * URL de download para o workflow. `confirm=t` pula o interstitial de
   * "arquivo grande" do Drive — sem ele o `fetch` do Node receberia HTML
   * onde esperava bytes e o gerador gravaria HTML em `images/`.
   */
  downloadUrl(id) {
    return `https://drive.google.com/uc?export=download&confirm=t&id=${id}`;
  },

  /**
   * Valida e decodifica o payload ANTES de tocar o Drive. O comprimento da
   * base64 é checado antes de decodificar (decodificar os 30 MB inteiros para
   * só então recusar alocava lixo por tentativa) e o `base64Decode` fica num
   * `try` (entrada malformada viraria exceção crua do GAS).
   */
  decode_(payload) {
    const mime = String(payload.type || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const rawName = String(payload.name || '');

    const byExt = rawName.match(/\.([A-Za-z0-9]{1,10})$/);
    const extMime = byExt ? Files.EXT_MIME[byExt[1].toLowerCase()] : undefined;
    const resolved = Files.ALLOWED_MIME.indexOf(mime) >= 0 ? mime : extMime;

    if (!resolved) {
      throw new Error(`"${rawName}" não é uma imagem suportada (JPEG, PNG, WebP ou AVIF).`);
    }

    const data = String(payload.data || '');
    if (!data) throw new Error('Imagem vazia.');
    const base64 = data.replace(/^data:[^;]+;base64,/, '');

    // `len * 3 / 4` é o teto do binário decodificado; checando antes evitamos
    // alocar os bytes de um upload gigante só para recusá-lo depois.
    if (Math.floor((base64.length * 3) / 4) > Files.MAX_BYTES) {
      throw new Error(`"${rawName}" excede o limite de ${Files.mb_(Files.MAX_BYTES)} MB por foto.`);
    }

    let bytes;
    try {
      bytes = Utilities.base64Decode(base64);
    } catch (err) {
      throw new Error(`Não foi possível ler a imagem enviada ("${rawName}").`);
    }
    if (!bytes || !bytes.length) throw new Error('Não foi possível ler a imagem enviada.');

    return { bytes, mime: resolved, ext: Files.MIME_EXT[resolved] || '.jpg' };
  },

  /** Próximo nome sequencial na pasta (`NNN.ext`, 3 dígitos). */
  nextName_(folder, ext) {
    let max = 0;
    const it = folder.getFiles();
    while (it.hasNext()) {
      const name = it.next().getName();
      const m = String(name).match(/^(\d{3})\./);
      if (m) max = Math.max(max, Number(m[1]));
    }
    const serial = Math.min(999, max + 1);
    return `${String(serial).padStart(3, '0')}${ext}`;
  },

  /**
   * Grava a foto na pasta do evento e devolve `{ name, id, mime, bytes }`.
   * O arquivo nasce privado; quem chama só o torna público depois que a
   * planilha aceitou a linha.
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

  /** Torna público um arquivo já registrado, com retentativas (Drive às vezes 503). */
  publish_(id) {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        Files.setPublic(DriveApp.getFileById(id));
        return;
      } catch (err) {
        lastErr = err;
        Utilities.sleep(500 * attempt);
      }
    }
    const message =
      lastErr instanceof Error
        ? lastErr.message
        : lastErr !== undefined
          ? String(lastErr)
          : 'erro desconhecido';
    throw new Error(
      `A foto foi salva na galeria, mas não consegui tornar o link público: ${message}. ` +
        `Use a ferramenta republishEvent depois.`,
    );
  },

  /** Lixeira por `id` — o caminho seguro (nunca remove "o evento inteiro"). */
  trashById(id) {
    try {
      if (id) DriveApp.getFileById(id).setTrashed(true);
    } catch (err) {
      console.error(
        'Files.trashById falhou para ' +
          id +
          ': ' +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  },

  /** Fallback do Tools/remoção por nome quando o `id` não está registrado. */
  trashByName(slug, name) {
    const folder = Files.folderFor(slug);
    const it = folder.getFilesByName(String(name || ''));
    while (it.hasNext()) it.next().setTrashed(true);
  },

  /** Lixeira de arquivo recém-criado cujo registro na planilha não entrou. */
  discard_(id) {
    Files.trashById(id);
  },

  renameFolder_(fromSlug, toSlug) {
    const root = Files.root_();
    const it = root.getFoldersByName(String(fromSlug || ''));
    if (!it.hasNext()) return false;
    it.next().setName(String(toSlug));
    return true;
  },
};
