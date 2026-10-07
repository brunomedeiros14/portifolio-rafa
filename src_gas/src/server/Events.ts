/**
 * Camada de dados: planilha "Eventos" — uma linha por casamento.
 *
 * A planilha é posicional: a ordem das colunas é `Events.HEADERS`, e
 * `rowToObject_`/`rowToValues_` presumem essa ordem. Quando o layout muda
 * (ex.: a coluna `draft`), `alignHeaders_` reescreve a linha 1 preservando os
 * dados por nome de coluna — sem isso, a primeira gravação seguinte jogaria
 * `state` na coluna `city`. A migração roda uma vez por execução sob document
 * lock (em `ensureSetup` e na primeira chamada de `sheet_`).
 *
 * Toda escrita passa por `withScriptLock_`: são operações read-modify-write da
 * planilha inteira, e sem lock dois uploads simultâneos partem do mesmo
 * snapshot e um dos patches se perde sem erro.
 */
const Events = (() => {
  /** Memoização da aba por execução (o GAS concatena tudo num escopo). */
  let cachedSheet_: GoogleAppsScript.Spreadsheet.Sheet | null = null;

  return {
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
      'draft',
      'created_at',
      'updated_at',
    ],

    /**
     * Campos que `update` aceita. `cover_id`, `cover_name`, `gallery`, `status`,
     * `draft` no fluxo de capa/foto... ficam geridos por outras rotas; sem a
     * whitelist, um form chamado direto trocaria a capa por um id de Drive
     * arbitrário — e esse id acabaria no JSON público da publicação.
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
      'draft',
    ],

    /** Tetos por campo — uma célula do Sheets segura 50k chars e sem teto um
     *  `<textarea>` de 2 MB trava a planilha inteira. */
    MAX_LEN: {
      couple: 120,
      city: 80,
      state: 40,
      venue: 120,
      description: 5000,
      excerpt: 220,
    },

    MAX_TAGS: 20,
    MAX_TAG_LEN: 40,

    // ------------------------------------------------------------------ //
    // Provisionamento e aba                                               //
    // ------------------------------------------------------------------ //

    /**
     * Cria planilha, pasta raiz e o `CMS_API_TOKEN` (auto-gerado) se faltarem.
     * Roda no `doGet` autenticado e no `apiLogin`. Tudo sob document lock: a
     * planilha recebe os cabeçalhos novos aqui, antes de qualquer leitura.
     */
    ensureSetup() {
      return Lock.withDocumentLock_(() => {
        Events.sheet_(true);
        Files.root_();
        const props = PropertiesService.getScriptProperties();
        if (!props.getProperty('CMS_API_TOKEN')) {
          props.setProperty('CMS_API_TOKEN', Utilities.getUuid());
        }
        return {
          sheetId: props.getProperty('SHEET_ID'),
          driveRootId: props.getProperty('DRIVE_ROOT_ID'),
          cmsToken: !!props.getProperty('CMS_API_TOKEN'),
        };
      });
    },

    headerOk_(sheet) {
      const first = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      return (
        first.length === Events.HEADERS.length &&
        Events.HEADERS.every((name, i) => String(first[i]) === name)
      );
    },

    /** Abre (ou cria) a aba `Eventos`. Alinha cabeçalhos uma vez, sob document lock. */
    sheet_(skipLock?) {
      if (cachedSheet_) return cachedSheet_;

      const props = PropertiesService.getScriptProperties();
      let id = props.getProperty('SHEET_ID');
      if (!id) {
        id = SpreadsheetApp.create('Casamentos — Controle de Publicação').getId();
        props.setProperty('SHEET_ID', id);
      }
      const ss = SpreadsheetApp.openById(id);
      let sheet = ss.getSheetByName('Eventos');
      if (!sheet) {
        sheet = ss.insertSheet('Eventos');
        sheet.appendRow(Events.HEADERS);
        sheet.setFrozenRows(1);
      }

      if (!Events.headerOk_(sheet)) {
        if (skipLock) {
          Events.alignHeaders_(sheet);
        } else {
          Lock.withDocumentLock_(() => {
            if (!Events.headerOk_(sheet)) Events.alignHeaders_(sheet);
          });
        }
      }

      cachedSheet_ = sheet;
      return sheet;
    },

    /**
     * Reordena/renomeia colunas antigas para `HEADERS`, lendo por nome e
     * devolvendo os dados. Colunas aposentadas são apagadas; o `location`
     * antigo é quebrado pela última vírgula em `venue` + `city`.
     */
    alignHeaders_(sheet) {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow < 1 || lastCol < 1) return false;

      const oldHeader = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
      const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      const oldIdx = {};
      oldHeader.forEach((name, i) => {
        if (oldIdx[name] === undefined) oldIdx[name] = i;
      });
      const oldValue = (row, name) => {
        const i = oldIdx[name];
        return i === undefined ? '' : row[i];
      };

      const splitLocation = (row) => {
        const raw = String(oldValue(row, 'location') || '').trim();
        const legacyCity = String(oldValue(row, 'city') || '').trim();
        if (legacyCity) {
          return {
            city: legacyCity,
            venue: raw.toLowerCase() === legacyCity.toLowerCase() ? '' : raw,
          };
        }
        if (!raw) return { city: '', venue: '' };
        const parts = raw
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.length < 2) return { city: parts[0] || '', venue: '' };
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
      if (lastCol > width) {
        sheet.getRange(1, width + 1, lastRow, lastCol - width).clearContent();
        sheet.deleteColumns(width + 1, lastCol - width);
      }
      return true;
    },

    // ------------------------------------------------------------------ //
    // Leitura                                                             //
    // ------------------------------------------------------------------ //

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

    slugs_() {
      const sheet = Events.sheet_();
      const data = sheet.getDataRange().getValues();
      const slugs: string[] = [];
      for (let r = 1; r < data.length; r++) if (data[r][0]) slugs.push(String(data[r][0]));
      return slugs;
    },

    all() {
      const sheet = Events.sheet_();
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return [];
      const idx = Events.columnIndex_(values[0]);
      const minGallery = Events.minGallery_();
      const rows: Evento[] = [];
      for (let r = 1; r < values.length; r++) {
        const event = Events.rowToObject_(idx, values[r], minGallery);
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
      return Events.rowToObject_(Events.columnIndex_(values[0]), values[r], Events.minGallery_());
    },

    /** Acha um evento sem garantir schema — usado pelo dedupe de upload. */
    getRaw(slug) {
      const sheet = Events.sheet_();
      const values = sheet.getDataRange().getValues();
      const r = Events.rowOf_(values, slug);
      if (r < 0) return null;
      return Events.rowToObject_(Events.columnIndex_(values[0]), values[r], Events.minGallery_());
    },

    // ------------------------------------------------------------------ //
    // Escrita (CRUD)                                                      //
    // ------------------------------------------------------------------ //

    create(payload) {
      const input = (payload || {}) as Record<string, any>;
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
          status: 'unpublished',
          draft: true,
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

        const input = (payload || {}) as Record<string, any>;
        const patch: Record<string, any> = {};
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
        if (patch.draft !== undefined) patch.draft = patch.draft === true;
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

    // ------------------------------------------------------------------ //
    // Fotos: capa, append, remoção                                        //
    // ------------------------------------------------------------------ //

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
     * Adiciona a foto à lista. Reenvio com o mesmo `clientId` não duplica.
     * A versão `*Locked*` NÃO adquire lock — é usada dentro do lock único de
     * upload do `Api` (que cobre criação no Drive + linha + publicação).
     */
    appendPhotoLocked_(slug, saved) {
      const current = Events.get(slug);
      if (!current) throw new Error(`Evento não encontrado: ${slug}`);

      const list = Array.isArray(current.gallery) ? current.gallery : [];
      if (saved.clientId && list.some((f) => f.clientId === saved.clientId)) {
        return { appended: false, event: current };
      }
      if (list.length >= Files.MAX_PHOTOS) {
        throw new Error(
          `Galeria cheia (${Files.MAX_PHOTOS} fotos) — remova fotos antes de enviar mais.`,
        );
      }

      Events.setRow_(slug, { gallery: list.concat([saved]) });
      return { appended: true, event: Events.get(slug) };
    },

    appendPhoto(slug, saved) {
      return Lock.withScriptLock_(() => Events.appendPhotoLocked_(slug, saved));
    },

    /** Remove da lista; devolve a foto removida para o Drive (lixeira) e limpa capa. */
    removePhoto(slug, name): FotoGaleria | null {
      let removed: FotoGaleria | null = null;
      Lock.withScriptLock_(() => {
        const current = Events.get(slug);
        if (!current) throw new Error(`Evento não encontrado: ${slug}`);
        removed = (current.gallery || []).filter((f) => f.name === name)[0] || null;
        const photos = (current.gallery || []).filter((f) => f.name !== name);
        const patch =
          current.cover_name === name
            ? { gallery: photos, cover_id: '', cover_name: '' }
            : { gallery: photos };
        Events.setRow_(slug, patch);
      });
      return removed;
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
      Lock.withScriptLock_(() => {
        Events.setRow_(slug, { status: 'published' });
      });
    },

    // ------------------------------------------------------------------ //
    // Prontidão                                                           //
    // ------------------------------------------------------------------ //

    /**
     * Checklist de prontidão (autoridade no servidor). `missed` alimenta o
     * painel e o gate de publicação; o rascunho só releva a falta de galeria (§8.1.6).
     */
    computeStatus(event, minOverride?): Checklist {
      const missed: string[] = [];
      const textFields = ['couple', 'date', 'city', 'state', 'description', 'excerpt'];
      for (const field of textFields) {
        if (Events.blank_(event[field])) missed.push(field);
      }
      if (Events.blank_(event.cover_id)) missed.push('cover');

      const minGallery = minOverride !== undefined ? minOverride : Events.minGallery_();
      const photos = Array.isArray(event.gallery) ? event.gallery : [];
      const galleryCount = photos.filter((p) => p.name !== event.cover_name).length;
      if (galleryCount < minGallery) missed.push(`gallery (${galleryCount}/${minGallery})`);
      return { status: missed.length === 0 ? 'ready' : 'pending', missed };
    },

    /**
     * Gate de publicação: o que falta bloqueia. Rascunho releva só `gallery...`.
     * Devolve a lista de faltas que realmente impedem.
     */
    publicationBlockers(event, check) {
      const blockers = check.missed.filter((miss) => {
        if (event.draft && miss.indexOf('gallery') === 0) return false;
        return true;
      });
      return blockers;
    },

    /** Mínimo de fotos da galeria, cacheado 600 s (`MIN_GALLERY`, default 8, clamp 1–60). */
    minGallery_() {
      const cache = CacheService.getScriptCache();
      const hit = cache.get('min_gallery');
      if (hit !== null) return Math.max(1, Math.min(60, Number(hit)));

      const raw = Number(PropertiesService.getScriptProperties().getProperty('MIN_GALLERY'));
      const value = Math.max(1, Math.min(60, raw > 0 ? raw : 8));
      cache.put('min_gallery', String(value), 600);
      return value;
    },

    // ------------------------------------------------------------------ //
    // Helpers de normalização                                              //
    // ------------------------------------------------------------------ //

    blank_(value) {
      return value === null || value === undefined || String(value).trim() === '';
    },

    text_(value, maxLen) {
      const s = String(value === undefined || value === null ? '' : value).trim();
      const cap = maxLen || 5000;
      return s.length > cap ? s.slice(0, cap) : s;
    },

    normalizeTags_(value) {
      const raw = Array.isArray(value) ? value : String(value || '').split(',');
      const out: string[] = [];
      raw.forEach((item) => {
        const tag = Events.text_(item, Events.MAX_TAG_LEN);
        if (tag && out.indexOf(tag) < 0) out.push(tag);
      });
      return out.slice(0, Events.MAX_TAGS);
    },

    /**
     * Normaliza a data para "YYYY-MM-DD". O Sheets converte células de data
     * reconhecidas para Date; texto inválido (incl. 31/02 e 29/02 não bissexto)
     * vira vazio em vez de ser devolvido cru — uma data velha interpolada no
     * painel seria XSSStored, e o valor cru acabaria no frontmatter do MDX.
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

    // ------------------------------------------------------------------ //
    // Linhas                                                              //
    // ------------------------------------------------------------------ //

    setRow_(slug, patch) {
      const sheet = Events.sheet_();
      const values = sheet.getDataRange().getValues();
      const r = Events.rowOf_(values, slug);
      if (r < 0) throw new Error(`Evento não encontrado: ${slug}`);

      const event = Object.assign(
        Events.rowToObject_(Events.columnIndex_(values[0]), values[r], Events.minGallery_()),
        patch,
      );
      event.updated_at = new Date().toISOString();

      const row = Events.rowToValues_(event);
      sheet.getRange(r + 1, 1, 1, row.length).setValues([row]);
    },

    rowToObject_(idx, v, minOverride) {
      const at = (name) => (idx[name] >= 0 ? v[idx[name]] : undefined);

      // `status` legado ("draft") vira `unpublished`; `draft` booleano é coluna
      // própria (linha em branco de eventos antigos = `false`, preservando a
      // página pública já publicada).
      const status = String(at('status') || '');
      const gallery = Events.parseJSON_(at('gallery'), null);
      const tags = Events.parseJSON_(at('tags'), null);

      const event: Evento = {
        slug: String(at('slug') || ''),
        couple: String(at('couple') || ''),
        city: String(at('city') || ''),
        state: String(at('state') || ''),
        venue: String(at('venue') || ''),
        description: String(at('description') || ''),
        excerpt: String(at('excerpt') || ''),
        date: Events.normalizeDate_(at('date')),
        featured: Events.truthy_(at('featured')),
        tags: tags === null ? [] : tags,
        cover_id: String(at('cover_id') || ''),
        cover_name: String(at('cover_name') || ''),
        gallery: gallery === null ? [] : gallery,
        status: status === 'published' ? 'published' : 'unpublished',
        draft: Events.truthy_(at('draft')),
        created_at: at('created_at'),
        updated_at: at('updated_at'),
      };
      if (gallery === null) {
        const raw = String(at('gallery') || '');
        if (raw) {
          event.gallery_raw = raw;
          console.error(
            `Evento "${event.slug}": célula gallery não parseou; texto cru preservado.`,
          );
        }
      }
      if (tags === null) {
        const raw = String(at('tags') || '');
        if (raw) {
          event.tags_raw = raw;
          console.error(`Evento "${event.slug}": célula tags não parseou; texto cru preservado.`);
        }
      }

      const check = Events.computeStatus(event, minOverride);
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
          case 'draft':
            return value ? 'TRUE' : 'FALSE';
          case 'tags':
            if (Array.isArray(value)) return JSON.stringify(value);
            return event.tags_raw !== undefined && event.tags_raw !== null
              ? String(event.tags_raw)
              : '[]';
          case 'gallery':
            if (Array.isArray(value) && value.length > 0) return JSON.stringify(value);
            if (event.gallery_raw !== undefined && event.gallery_raw !== null) {
              return String(event.gallery_raw);
            }
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

    /** JSON de célula; `null` (não `fallback`) sinaliza célula corrompida. */
    parseJSON_(value, fallback) {
      if (value === undefined || value === null || value === '') return fallback;
      try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : fallback;
      } catch (err) {
        return null;
      }
    },
  };
})();
