/**
 * Camada de dados: planilha "Eventos" — uma linha por casamento.
 *
 * Campos:
 *  - Colunas escalares (title, couple, date, ...) viram célula de texto.
 *  - Colunas estruturais (tags, vendors, gallery, story) são JSON stringified.
 *
 * O campo obrigatório de frontmatter `slug` é também a chave da linha (coluna A).
 */
const Events = {
  HEADERS: [
    'slug', 'title', 'couple', 'date', 'location', 'city', 'state', 'venue',
    'description', 'excerpt', 'featured', 'tags', 'vendors',
    'seoTitle', 'seoDescription', 'historia_html',
    'cover_id', 'cover_name', 'gallery', 'story', 'status', 'created_at', 'updated_at',
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
    return sheet;
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
      title: (payload && payload.title) || '',
      couple: (payload && payload.couple) || '',
      date: (payload && payload.date) || '',
      location: (payload && payload.location) || '',
      city: (payload && payload.city) || '',
      state: (payload && payload.state) || '',
      venue: (payload && payload.venue) || '',
      description: (payload && payload.description) || '',
      excerpt: (payload && payload.excerpt) || '',
      featured: !!(payload && payload.featured),
      tags: [],
      vendors: [],
      seoTitle: (payload && payload.seoTitle) || '',
      seoDescription: (payload && payload.seoDescription) || '',
      historia_html: '',
      cover_id: '',
      cover_name: '',
      gallery: [],
      story: [],
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
    if (!Array.isArray(merged.vendors)) merged.vendors = [];
    if (!Array.isArray(merged.gallery)) merged.gallery = [];
    if (!Array.isArray(merged.story)) merged.story = [];

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

  setCover(slug, saved) {
    Events.setRow_(slug, {
      cover_id: saved.id,
      cover_name: saved.name,
    });
  },

  appendFiles(slug, kind, saved) {
    const current = Events.get(slug);
    const list = kind === 'story' ? current.story : current.gallery;
    const patch = {};
    patch[kind] = list.concat(saved);
    Events.setRow_(slug, patch);
  },

  removeFile(slug, kind, name) {
    const current = Events.get(slug);
    const patch = {};
    if (kind === 'cover') {
      patch.cover_id = '';
      patch.cover_name = '';
    } else if (kind === 'gallery') {
      patch.gallery = (current.gallery || []).filter((f) => f.name !== name);
    } else if (kind === 'story') {
      patch.story = (current.story || []).filter((f) => f.name !== name);
    }
    Events.setRow_(slug, patch);
  },

  listFiles(slug) {
    const e = Events.get(slug);
    if (!e) return null;
    return {
      cover: e.cover_id ? { name: e.cover_name, id: e.cover_id } : null,
      gallery: e.gallery || [],
      story: e.story || [],
    };
  },

  markPublished(slug) {
    Events.setRow_(slug, { status: 'published' });
  },

  /**
   * Checklist de prontidão. Retorna { status: 'ready'|'pending', missed: string[] }.
   * Um evento só vira 'ready' quando todos os campos obrigatórios estão preenchidos,
   * a capa foi enviada, a galeria atingiu o mínimo e o story tem fotos.
   */
  computeStatus(event) {
    const missed = [];
    const textFields = [
      'title', 'couple', 'date', 'location', 'city', 'state', 'venue',
      'description', 'excerpt', 'historia_html',
    ];
    for (const field of textFields) {
      if (Events.blank_(event[field])) missed.push(field);
    }
    if (Events.blank_(event.cover_id)) missed.push('cover');
    const minGallery = Number(PropertiesService.getScriptProperties().getProperty('MIN_GALLERY') || '8');
    const galleryCount = Array.isArray(event.gallery) ? event.gallery.length : 0;
    if (galleryCount < minGallery) missed.push(`gallery (${galleryCount}/${minGallery})`);
    const storyCount = Array.isArray(event.story) ? event.story.length : 0;
    if (storyCount === 0) missed.push('story');
    return { status: missed.length === 0 ? 'ready' : 'pending', missed };
  },

  blank_(value) {
    return value === null || value === undefined || String(value).trim() === '';
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
      title: String(at('title') || ''),
      couple: String(at('couple') || ''),
      date: String(at('date') || ''),
      location: String(at('location') || ''),
      city: String(at('city') || ''),
      state: String(at('state') || ''),
      venue: String(at('venue') || ''),
      description: String(at('description') || ''),
      excerpt: String(at('excerpt') || ''),
      featured: Events.truthy_(at('featured')),
      tags: Events.parseJSON_(at('tags'), []),
      vendors: Events.parseJSON_(at('vendors'), []),
      seoTitle: String(at('seoTitle') || ''),
      seoDescription: String(at('seoDescription') || ''),
      historia_html: String(at('historia_html') || ''),
      cover_id: String(at('cover_id') || ''),
      cover_name: String(at('cover_name') || ''),
      gallery: Events.parseJSON_(at('gallery'), []),
      story: Events.parseJSON_(at('story'), []),
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
        case 'vendors':
        case 'gallery':
        case 'story':
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