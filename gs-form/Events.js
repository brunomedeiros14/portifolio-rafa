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
 */
const Events = {
  HEADERS: [
    'slug', 'couple', 'date', 'city', 'state', 'venue',
    'description', 'excerpt', 'featured', 'tags',
    'cover_id', 'cover_name', 'gallery', 'status', 'created_at', 'updated_at',
  ],

  /**
   * Colunas removidas ao longo do tempo, na ordem em que saíram.
   *
   * `vendors` saiu quando o bloco de fornecedores foi removido do site.
   * `historia_html`/`story` saíram junto com o texto editorial: sobrou só a
   * frase de apoio da intro.
   * `seoTitle`/`seoDescription` saíram porque o título e a descrição da
   * página passam a vir de `excerpt` e `description` — manter os quatro
   * campos obrigava a escrever a mesma frase duas vezes, e as cópias
   * divergiam. `title` saiu junto: nunca chegou a ser lido por nada, já
   * que virava duplicata de `couple` no formato "Cintia + Guilherme".
   */
  DROPPED_HEADERS: [
    'vendors', 'historia_html', 'story', 'seoTitle', 'seoDescription', 'title',
  ],

  ensureSetup() {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('SHEET_ID')) Events.sheet_();
    if (!props.getProperty('DRIVE_ROOT_ID')) Drive.root_();
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
      const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) return { city: parts[0] || '', venue: '' };
      // "Igreja de São Francisco, Tiradentes, MG": a sigla que já está em
      // `state` não é cidade, então fica fora da quebra.
      const state = String(oldValue(row, 'state') || '').trim();
      if (parts.length > 2 && state && parts[parts.length - 1].toLowerCase() === state.toLowerCase()) {
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
    const idx = Events.columnIndex_(values[0]);
    for (let r = 1; r < values.length; r++) {
      if (values[r][0] === slug) return Events.rowToObject_(idx, values[r]);
    }
    return null;
  },

  slugs_() {
    const sheet = Events.sheet_();
    const data = sheet.getDataRange().getValues();
    const slugs = [];
    for (let r = 1; r < data.length; r++) if (data[r][0]) slugs.push(String(data[r][0]));
    return slugs;
  },

  create(payload) {
    const slug = Slug.ensureUnique(
      Slug.slugify(payload && payload.couple),
      payload && payload.city,
      Events.slugs_(),
    );
    const now = new Date().toISOString();
    const event = {
      slug,
      couple: (payload && payload.couple) || '',
      date: (payload && payload.date) || '',
      city: (payload && payload.city) || '',
      state: (payload && payload.state) || '',
      venue: (payload && payload.venue) || '',
      description: (payload && payload.description) || '',
      excerpt: (payload && payload.excerpt) || '',
      featured: !!(payload && payload.featured),
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
  },

  update(slug, payload) {
    const current = Events.get(slug);
    if (!current) throw new Error(`Evento não encontrado: ${slug}`);

    const merged = Object.assign({}, current, payload || {});
    merged.updated_at = new Date().toISOString();
    merged.featured = !!merged.featured;

    if (!Array.isArray(merged.tags)) merged.tags = [];
    if (!Array.isArray(merged.gallery)) merged.gallery = [];

    if (merged.slug && merged.slug !== slug) {
      if (Events.get(merged.slug)) {
        throw new Error(`Já existe um evento com o slug "${merged.slug}".`);
      }
    } else {
      merged.slug = slug;
    }
    Events.setRow_(slug, merged);
    return Events.get(merged.slug);
  },

  remove(slug) {
    const sheet = Events.sheet_();
    const values = sheet.getDataRange().getValues();
    for (let r = 1; r < values.length; r++) {
      if (values[r][0] === slug) {
        sheet.deleteRow(r + 1);
        return;
      }
    }
    throw new Error(`Evento não encontrado: ${slug}`);
  },

  /** Marca uma foto (por nome) como capa; '' limpa. */
  setCover(slug, name) {
    const current = Events.get(slug);
    const photo = String(name || '')
      ? (current.gallery || []).filter((f) => f.name === name)[0]
      : null;
    const patch = {
      cover_id: photo ? photo.id : '',
      cover_name: photo ? photo.name : '',
    };
    Events.setRow_(slug, patch);
  },

  /** Adiciona uma foto à lista única do evento (gallery = todas as fotos). */
  appendPhoto(slug, saved) {
    const current = Events.get(slug);
    const list = Array.isArray(current.gallery) ? current.gallery : [];
    Events.setRow_(slug, { gallery: list.concat([saved]) });
  },

  /** Remove a foto do Drive e da lista; limpa a capa se ela era a capa. */
  removePhoto(slug, name) {
    const current = Events.get(slug);
    const patch = {
      gallery: (current.gallery || []).filter((f) => f.name !== name),
    };
    if (current.cover_name === name) {
      patch.cover_id = '';
      patch.cover_name = '';
    }
    Events.setRow_(slug, patch);
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
    const textFields = [
      'couple', 'date', 'city', 'state', 'description', 'excerpt',
    ];
    for (const field of textFields) {
      if (Events.blank_(event[field])) missed.push(field);
    }
    if (Events.blank_(event.cover_id)) missed.push('cover');

    const minGallery = Number(PropertiesService.getScriptProperties().getProperty('MIN_GALLERY') || '8');
    const photos = Array.isArray(event.gallery) ? event.gallery : [];
    const galleryCount = photos.filter((p) => p.name !== event.cover_name).length;
    if (galleryCount < minGallery) missed.push(`gallery (${galleryCount}/${minGallery})`);
    return { status: missed.length === 0 ? 'ready' : 'pending', missed };
  },

  blank_(value) {
    return value === null || value === undefined || String(value).trim() === '';
  },

  /**
   * Normaliza a data para "YYYY-MM-DD" (formato do <input type=date> e do frontmatter).
   * O Sheets converte células reconhecidas como data para Date; sem isso o valor
   * voltaria como "Sat May 30 2026 ...", quebrado no editor e no MDX gerado.
   */
  normalizeDate_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    const s = String(value || '');
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return s;
  },

  setRow_(slug, patch) {
    const sheet = Events.sheet_();
    const values = sheet.getDataRange().getValues();
    const idx = Events.columnIndex_(values[0]);
    for (let r = 1; r < values.length; r++) {
      if (values[r][0] !== slug) continue;
      const event = Object.assign(Events.rowToObject_(idx, values[r]), patch);
      const row = Events.rowToValues_(event);
      sheet.getRange(r + 1, 1, 1, row.length).setValues([row]);
      return;
    }
    throw new Error(`Evento não encontrado: ${slug}`);
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