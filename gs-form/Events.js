/**
 * Camada de dados: planilha "Eventos" — uma linha por casamento.
 *
 * Campos:
 *  - Colunas escalares (couple, date, ...) viram célula de texto.
 *  - Colunas estruturais (tags, gallery) são JSON stringified.
 *
 * O campo obrigatório de frontmatter `slug` é também a chave da linha (coluna A).
 *
 * O local vive em três colunas: `city` e `state` são obrigatórias, `venue`
 * (o estabelecimento) é opcional. Como a planilha é posicional, `alignHeaders_`
 * reescreve uma aba antiga no layout novo — sem ela, cada gravação seguinte
 * jogaria `state` na coluna `city` e empurraria o resto da linha.
 *
 * Toda escrita passa por `Lock.withScriptLock_`: as operações abaixo são
 * read-modify-write da planilha inteira, e sem lock dois uploads simultâneos
 * partem do mesmo snapshot e um dos patches se perde sem erro. Ver Lock.js.
 */
const Events = {
  HEADERS: [
    'slug',
    'couple',
    'date',
    'city',
    'state',
    'venue',
    'description',
    'excerpt',
    'featured',
    'tags',
    'cover_id',
    'cover_name',
    'gallery',
    'status',
    'created_at',
    'updated_at',
  ],

  /**
   * Campos que `update` aceita. `cover_id`, `cover_name`, `gallery`, `status`,
   * `created_at` e `updated_at` ficam de fora de propósito: são mantidos por
   * `setCover`/`appendPhoto`/`removePhoto`/`markPublished`. Sem a whitelist, o
   * formulário (ou qualquer chamada direta) trocaria a capa por um id de Drive
   * arbitrário — e esse id acaba no JSON público da publicação.
   */
  EDITABLE: [
    'slug',
    'couple',
    'date',
    'city',
    'state',
    'venue',
    'description',
    'excerpt',
    'featured',
    'tags',
  ],

  /** Tetos por campo de texto: uma célula do Sheets segura 50 mil caracteres,
   * e sem teto um `<textarea>` com 2 MB trava a planilha inteira. */
  MAX_LEN: {
    couple: 120,
    city: 80,
    state: 40,
    venue: 120,
    description: 5000,
    excerpt: 300,
  },

  MAX_TAGS: 20,
  MAX_TAG_LEN: 40,

  ensureSetup() {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('SHEET_ID')) Events.sheet_();
    if (!props.getProperty('DRIVE_ROOT_ID')) Files.root_();
    if (!props.getProperty('CMS_API_TOKEN')) {
      props.setProperty('CMS_API_TOKEN', Utilities.getUuid());
    }
    return {
      sheetId: props.getProperty('SHEET_ID'),
      driveRootId: props.getProperty('DRIVE_ROOT_ID'),
      cmsToken: props.getProperty('CMS_API_TOKEN'),
    };
  },

  sheet_() {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty('SHEET_ID');
    if (!id) {
      const ss = SpreadsheetApp.create('Casamentos — Controle de Publicação');
      id = ss.getId();
      props.setProperty('SHEET_ID', id);
    }
    const ss = SpreadsheetApp.openById(id);
    let sheet = ss.getSheetByName('Eventos');
    if (!sheet) {
      sheet = ss.insertSheet('Eventos');
      sheet.appendRow(Events.HEADERS);
      sheet.setFrozenRows(1);
    }
    Events.alignHeaders_(sheet);
    return sheet;
  },

  /**
   * Deixa a linha 1 igual a `HEADERS`, preservando os dados por nome de coluna.
   *
   * Roda em toda leitura/escrita. É idempotente: quando o cabeçalho já bate,
   * não escreve nada. Só reescreve quando falta alguma coluna nova ou sobra
   * alguma antiga, inclusive desfazendo o `location` único: o texto
   * "Fazenda X, Nova Lima" volta a virar `venue` + `city`.
   *
   * Colunas que saíram ao longo do tempo, na ordem: `vendors` (bloco de
   * fornecedores removido do site), `historia_html`/`story` (texto editorial),
   * `seoTitle`/`seoDescription` (título e descrição passaram a vir de `couple`
   * e `excerpt`) e `title` (nunca lido — virava duplicata de `couple`).
   */
  alignHeaders_(sheet) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 1 || lastCol < 1) return false;

    const oldHeader = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    const alreadyAligned =
      oldHeader.length === Events.HEADERS.length &&
      Events.HEADERS.every((name, i) => oldHeader[i] === name);
    if (alreadyAligned) return false;

    const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const oldIdx = {};
    oldHeader.forEach((name, i) => {
      if (oldIdx[name] === undefined) oldIdx[name] = i;
    });
    const oldValue = (row, name) => {
      const i = oldIdx[name];
      return i === undefined ? '' : row[i];
    };

    // Desfaz o `location` único. A cidade é sempre o último trecho separado por
    // vírgula ("Fazenda X, Nova Lima" → venue "Fazenda X" + city "Nova Lima");
    // sem vírgula o texto todo é a cidade e o local fica vazio.
    const splitLocation = (row) => {
      const raw = String(oldValue(row, 'location') || '').trim();
      const legacyCity = String(oldValue(row, 'city') || '').trim();
      if (legacyCity) {
        const venue = raw.toLowerCase() === legacyCity.toLowerCase() ? '' : raw;
        return { city: legacyCity, venue };
      }
      if (!raw) return { city: '', venue: '' };
      const parts = raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length < 2) return { city: parts[0] || '', venue: '' };
      // "Igreja de São Francisco, Tiradentes, MG": a sigla que já está em
      // `state` não é cidade, então fica fora da quebra.
      const state = String(oldValue(row, 'state') || '').trim();
      if (
        parts.length > 2 &&
        state &&
        parts[parts.length - 1].toLowerCase() === state.toLowerCase()
      ) {
        parts.pop();
      }
      return { city: parts[parts.length - 1], venue: parts.slice(0, -1).join(', ') };
    };

    const width = Events.HEADERS.length;
    const rebuilt = [Events.HEADERS.slice()];
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      rebuilt.push(
        Events.HEADERS.map((name) => {
          const place = splitLocation(row);
          if (name === 'city') return place.city;
          if (name === 'venue') return place.venue;
          return oldValue(row, name);
        }),
      );
    }

    sheet.getRange(1, 1, rebuilt.length, width).setValues(rebuilt);
    // Colunas que sobraram à direita do layout novo ficariam com o valor
    // antigo visível ao lado dos dados.
    if (lastCol > width) {
      sheet.getRange(1, width + 1, lastRow, lastCol - width).clearContent();
      sheet.deleteColumns(width + 1, lastCol - width);
    }
    return true;
  },

  columnIndex_(headerRow) {
    const idx = {};
    Events.HEADERS.forEach((name) => (idx[name] = headerRow.indexOf(name)));
    return idx;
  },

  /** Índice (0-based, dentro de `values`) da linha do slug, ou -1. */
  rowOf_(values, slug) {
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][0]) === String(slug)) return r;
    }
    return -1;
  },

  /** Lista todos os eventos, com campos de prontidão calculados. */
  all() {
    const sheet = Events.sheet_();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];
    const idx = Events.columnIndex_(values[0]);
    const rows = [];
    for (let r = 1; r < values.length; r++) {
      const event = Events.rowToObject_(idx, values[r]);
      if (!event.slug) continue;
      rows.push(event);
    }
    return rows;
  },

  get(slug) {
    const sheet = Events.sheet_();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return null;
    const r = Events.rowOf_(values, slug);
    if (r < 0) return null;
    return Events.rowToObject_(Events.columnIndex_(values[0]), values[r]);
  },

  slugs_() {
    const sheet = Events.sheet_();
    const data = sheet.getDataRange().getValues();
    const slugs = [];
    for (let r = 1; r < data.length; r++) if (data[r][0]) slugs.push(String(data[r][0]));
    return slugs;
  },

  create(payload) {
    const input = payload || {};
    if (Events.blank_(input.couple)) throw new Error('Informe o nome do casal.');

    return Lock.withScriptLock_(() => {
      const slug = Slug.ensureUnique(Slug.slugify(input.couple), input.city, Events.slugs_());
      const now = new Date().toISOString();
      const event = {
        slug,
        couple: Events.text_(input.couple, Events.MAX_LEN.couple),
        date: Events.normalizeDate_(input.date),
        city: Events.text_(input.city, Events.MAX_LEN.city),
        state: Events.text_(input.state, Events.MAX_LEN.state),
        venue: Events.text_(input.venue, Events.MAX_LEN.venue),
        description: Events.text_(input.description, Events.MAX_LEN.description),
        excerpt: Events.text_(input.excerpt, Events.MAX_LEN.excerpt),
        featured: !!input.featured,
        tags: [],
        cover_id: '',
        cover_name: '',
        gallery: [],
        status: 'draft',
        created_at: now,
        updated_at: now,
      };
      Events.sheet_().appendRow(Events.rowToValues_(event));
      return Events.get(slug);
    });
  },

  update(slug, payload) {
    return Lock.withScriptLock_(() => {
      const current = Events.get(slug);
      if (!current) throw new Error(`Evento não encontrado: ${slug}`);

      // Whitelist: campos desconhecidos ou gerenciados por outra rota
      // (capa, galeria, status) são descartados em vez de aceitos.
      const input = payload || {};
      const patch = {};
      Events.EDITABLE.forEach((name) => {
        if (Object.prototype.hasOwnProperty.call(input, name)) patch[name] = input[name];
      });

      if (patch.couple !== undefined) {
        if (Events.blank_(patch.couple)) throw new Error('Informe o nome do casal.');
        patch.couple = Events.text_(patch.couple, Events.MAX_LEN.couple);
      }
      if (patch.date !== undefined) patch.date = Events.normalizeDate_(patch.date);
      ['city', 'state', 'venue', 'description', 'excerpt'].forEach((name) => {
        if (patch[name] !== undefined)
          patch[name] = Events.text_(patch[name], Events.MAX_LEN[name]);
      });
      if (patch.featured !== undefined) patch.featured = !!patch.featured;
      if (patch.tags !== undefined) patch.tags = Events.normalizeTags_(patch.tags);

      let target = String(slug);
      if (patch.slug !== undefined) {
        const next = Slug.slugify(patch.slug || current.couple || current.slug);
        if (next && next !== target) {
          if (Events.get(next)) throw new Error(`Já existe um evento com o slug "${next}".`);
          patch.slug = next;
          target = next;
        } else {
          patch.slug = target;
        }
      }

      Events.setRow_(slug, patch);

      // A pasta do Drive é nomeada pelo slug: sem renomear junto, os uploads
      // seguintes criariam uma pasta vazia e as fotos antigas sumiriam.
      if (target !== String(slug)) Files.renameFolder_(slug, target);

      return Events.get(target);
    });
  },

  remove(slug) {
    Lock.withScriptLock_(() => {
      const sheet = Events.sheet_();
      const values = sheet.getDataRange().getValues();
      const r = Events.rowOf_(values, slug);
      if (r < 0) throw new Error(`Evento não encontrado: ${slug}`);
      sheet.deleteRow(r + 1);
    });
  },

  /** Marca uma foto (por nome) como capa; '' limpa. */
  setCover(slug, name) {
    Lock.withScriptLock_(() => {
      const current = Events.get(slug);
      if (!current) throw new Error(`Evento não encontrado: ${slug}`);
      const photo = String(name || '')
        ? (current.gallery || []).filter((f) => f.name === name)[0]
        : null;
      if (String(name || '') && !photo) {
        throw new Error(`A capa precisa ser uma foto da galeria: ${name}`);
      }
      Events.setRow_(slug, {
        cover_id: photo ? photo.id : '',
        cover_name: photo ? photo.name : '',
      });
    });
  },

  /**
   * Adiciona uma foto à lista única do evento (gallery = todas as fotos).
   *
   * Ignora o reenvio com o mesmo `clientId`: se a resposta se perde e o painel
   * tenta de novo, o retry não pode criar uma segunda entrada — o usuário
   * veria a mesma foto duplicada na galeria publicada.
   */
  appendPhoto(slug, saved) {
    Lock.withScriptLock_(() => {
      const current = Events.get(slug);
      if (!current) throw new Error(`Evento não encontrado: ${slug}`);

      const list = Array.isArray(current.gallery) ? current.gallery : [];
      if (saved.clientId && list.some((f) => f.clientId === saved.clientId)) return;

      if (list.length >= Files.MAX_PHOTOS) {
        throw new Error(`Limite de ${Files.MAX_PHOTOS} fotos por evento.`);
      }

      Events.setRow_(slug, { gallery: list.concat([saved]) });
    });
  },

  /** Remove a foto da lista; limpa a capa se ela era a capa. */
  removePhoto(slug, name) {
    Lock.withScriptLock_(() => {
      const current = Events.get(slug);
      if (!current) throw new Error(`Evento não encontrado: ${slug}`);
      const patch = {
        gallery: (current.gallery || []).filter((f) => f.name !== name),
      };
      if (current.cover_name === name) {
        patch.cover_id = '';
        patch.cover_name = '';
      }
      Events.setRow_(slug, patch);
    });
  },

  listFiles(slug) {
    const e = Events.get(slug);
    if (!e) return null;
    const photos = Array.isArray(e.gallery) ? e.gallery : [];
    return {
      cover: e.cover_id ? { name: e.cover_name, id: e.cover_id } : null,
      photos,
    };
  },

  markPublished(slug) {
    Events.setRow_(slug, { status: 'published' });
  },

  /**
   * Checklist de prontidão. Retorna { status: 'ready'|'pending', missed: string[] }.
   * Um evento só vira 'ready' quando todos os campos obrigatórios estão preenchidos,
   * a capa foi enviada e a galeria atingiu o mínimo.
   */
  computeStatus(event) {
    const missed = [];
    const textFields = ['couple', 'date', 'city', 'state', 'description', 'excerpt'];
    for (const field of textFields) {
      if (Events.blank_(event[field])) missed.push(field);
    }
    if (Events.blank_(event.cover_id)) missed.push('cover');

    const minGallery = Events.minGallery_();
    const photos = Array.isArray(event.gallery) ? event.gallery : [];
    const galleryCount = photos.filter((p) => p.name !== event.cover_name).length;
    if (galleryCount < minGallery) missed.push(`gallery (${galleryCount}/${minGallery})`);
    return { status: missed.length === 0 ? 'ready' : 'pending', missed };
  },

  /**
   * Mínimo de fotos da galeria, com cache.
   *
   * `computeStatus` roda uma vez por linha dentro de `all()`, e ler
   * PropertiesService por linha custava uma chamada de rede por evento — a
   * lista do painel ficava visivelmente lenta com a planilha grande.
   */
  minGallery_() {
    const cache = CacheService.getScriptCache();
    const hit = cache.get('min_gallery');
    if (hit !== null) return Math.max(1, Math.min(60, Number(hit)));

    const raw = Number(PropertiesService.getScriptProperties().getProperty('MIN_GALLERY'));
    const value = Math.max(1, Math.min(60, raw > 0 ? raw : 8));
    cache.put('min_gallery', String(value), 600);
    return value;
  },

  blank_(value) {
    return value === null || value === undefined || String(value).trim() === '';
  },

  /** Texto de célula: sempre string, sem espaços nas pontas, com teto de tamanho. */
  text_(value, maxLen) {
    const s = String(value === undefined || value === null ? '' : value).trim();
    const cap = maxLen || 5000;
    return s.length > cap ? s.slice(0, cap) : s;
  },

  /** Lista de strings limpa, sem repetidas e sem vazias. */
  normalizeTags_(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(',');
    const out = [];
    raw.forEach((item) => {
      const tag = Events.text_(item, Events.MAX_TAG_LEN);
      if (tag && out.indexOf(tag) < 0) out.push(tag);
    });
    return out.slice(0, Events.MAX_TAGS);
  },

  /**
   * Normaliza a data para "YYYY-MM-DD" (formato do <input type=date> e do frontmatter).
   * O Sheets converte células reconhecidas como data para Date; sem isso o valor
   * voltaria como "Sat May 30 2026 ...", quebrado no editor e no MDX gerado.
   *
   * Texto que não é data vira **vazio**, e não volta como veio. Uma data inválida
   * antiga era devolvida crua e acabava interpolada em `innerHTML` no painel —
   * uma célula com `<img src=x onerror=...>` virava XSSStored. Vazando, ela
   * entra no checklist como "falta date" e a publicação fica bloqueada até
   * alguém corrigir no formulário.
   */
  normalizeDate_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    const s = String(value === undefined || value === null ? '' : value).trim();
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return '';

    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    // Rejeita 31/02 e 29/02 de ano não bissexto, que o `Date` normalizaria para
    // março e o frontmatter receberia uma data diferente da digitada.
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      return '';
    }
    return `${m[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  },

  setRow_(slug, patch) {
    const sheet = Events.sheet_();
    const values = sheet.getDataRange().getValues();
    const r = Events.rowOf_(values, slug);
    if (r < 0) throw new Error(`Evento não encontrado: ${slug}`);

    const event = Object.assign(
      Events.rowToObject_(Events.columnIndex_(values[0]), values[r]),
      patch,
    );
    // Qualquer escrita mexe em `updated_at` — inclusive foto, capa e status.
    // Sem isso o campo só refletia edição de texto e o painel mostrava "alterado
    // há 3 meses" depois de uma troca de capa.
    event.updated_at = new Date().toISOString();

    const row = Events.rowToValues_(event);
    sheet.getRange(r + 1, 1, 1, row.length).setValues([row]);
  },

  rowToObject_(idx, v) {
    const at = (name) => (idx[name] >= 0 ? v[idx[name]] : undefined);
    const event = {
      slug: String(at('slug') || ''),
      couple: String(at('couple') || ''),
      city: String(at('city') || ''),
      state: String(at('state') || ''),
      venue: String(at('venue') || ''),
      description: String(at('description') || ''),
      excerpt: String(at('excerpt') || ''),
      date: Events.normalizeDate_(at('date')),
      featured: Events.truthy_(at('featured')),
      tags: Events.parseJSON_(at('tags'), []),
      cover_id: String(at('cover_id') || ''),
      cover_name: String(at('cover_name') || ''),
      gallery: Events.parseJSON_(at('gallery'), []),
      status: String(at('status') || 'draft'),
      created_at: at('created_at'),
      updated_at: at('updated_at'),
    };
    const check = Events.computeStatus(event);
    event.ready = check.status;
    event.missed = check.missed;
    return event;
  },

  rowToValues_(event) {
    return Events.HEADERS.map((name) => {
      const value = event[name];
      switch (name) {
        case 'featured':
          return value ? 'TRUE' : 'FALSE';
        case 'tags':
        case 'gallery':
          return Array.isArray(value) ? JSON.stringify(value) : '[]';
        case 'created_at':
        case 'updated_at':
          return value || new Date().toISOString();
        default:
          return value === undefined || value === null ? '' : value;
      }
    });
  },

  truthy_(value) {
    return value === true || String(value).toUpperCase() === 'TRUE';
  },

  parseJSON_(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (err) {
      return fallback;
    }
  },
};
