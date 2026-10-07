/**
 * Publicação:
 *  1. `buildPublication` — monta o JSON que o workflow baixa (textos + links públicos do Drive);
 *  2. `publicationEndpoint_` — endpoint `doPost` chamado pelo GitHub;
 *  3. `dispatch(slug)` — dispara `repository_dispatch` (botão "Executar automação").
 */
const Publish = {
  /** Teto de bytes por evento, checado em `buildPublication` (hoje effectively morto: a UI
   * redimensiona para 2400 px e o gerador rejeita > 20 MB/foto). */
  MAX_EVENT_BYTES: 400 * 1024 * 1024,

  json_(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
      ContentService.MimeType.JSON,
    );
  },

  /**
   * Endpoint consumido pelo workflow. O GAS sempre responde HTTP 200; erros
   * vêm no corpo em `{ error: "..." }`.
   */
  publicationEndpoint_(req) {
    const token = PropertiesService.getScriptProperties().getProperty('CMS_API_TOKEN');
    if (!token || !req || !Publish.constantTimeEquals_(String(req.token || ''), String(token))) {
      return Publish.json_({ error: 'unauthorized' });
    }
    if (req.action !== 'publication') {
      return Publish.json_({ error: 'invalid_action' });
    }
    const slug = String(req.publicationId || '').trim();
    const event = Events.get(slug);
    if (!event) {
      return Publish.json_({ error: 'not_found', slug });
    }
    const data = Publish.buildPublication(event);
    if (data === null) {
      return Publish.json_({ error: 'not_ready', slug });
    }
    return Publish.json_(data);
  },

  /**
   * Comparação em tempo constante por digest: `a !== b` sairia no primeiro
   * byte, expondo a senha por tempo via prefixo; o digest também normaliza o
   * comprimento. Endpoint público, sem limite de tentativas.
   */
  constantTimeEquals_(a, b) {
    const x = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(a || ''),
      Utilities.Charset.UTF_8,
    );
    const y = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(b || ''),
      Utilities.Charset.UTF_8,
    );
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
  },

  /**
   * Monta o JSON da publicação (schema em `cms_spec.md` §9.1).
   * Devolve `null` se faltar capa — o gate de `apiPublish` deveria ter pego,
   * mas o endpoint público não pode fabricar uma URL malformada.
   */
  buildPublication(event) {
    const photos = Array.isArray(event.gallery) ? event.gallery : [];
    const cover = photos.filter((p) => p.name === event.cover_name)[0] || null;
    if (!cover || !event.cover_id) return null;

    const driveLinks = (list) =>
      (list || []).map((f) => ({ filename: f.name, url: Files.downloadUrl(f.id) }));

    const totalBytes = photos.reduce((sum, p) => sum + (Number(p.bytes) || 0), 0);
    if (totalBytes > Publish.MAX_EVENT_BYTES) {
      throw new Error(
        `As fotos somam ${Math.round(totalBytes / (1024 * 1024))} MB; o limite é ` +
          `${Math.round(Publish.MAX_EVENT_BYTES / (1024 * 1024))} MB por evento.`,
      );
    }

    return {
      slug: event.slug,
      couple: event.couple,
      date: event.date,
      city: event.city,
      state: event.state,
      venue: event.venue || undefined,
      description: event.description,
      excerpt: event.excerpt,
      featured: !!event.featured,
      draft: !!event.draft,
      tags: Array.isArray(event.tags) ? event.tags : [],
      cover: { filename: event.cover_name || 'cover.jpg', url: Files.downloadUrl(event.cover_id) },
      gallery: driveLinks(photos.filter((p) => p.name !== event.cover_name)),
    };
  },

  /** ID da URL `/exec` do deployment atual — viaja no `client_payload`. */
  urlId_() {
    const url = String(ScriptApp.getService().getUrl() || '');
    const m = url.match(/macros\/s\/([^/]+)\/exec/);
    return m ? m[1] : '';
  },

  /**
   * Dispara o workflow "publish-wedding". O `url_id` é **obrigatório**: o
   * workflow aborta com erro se ele faltar, então melhor falhar aqui com
   * mensagem clara antes de dar o sinal. O fetch roda FORA do lock (ver
   * `Api.apiPublish`) e com timeout — GitHub lento não pode segurar uploads.
   */
  dispatch(slug) {
    const props = PropertiesService.getScriptProperties();
    const owner = props.getProperty('GITHUB_OWNER');
    const repo = props.getProperty('GITHUB_REPO');
    const token = props.getProperty('GITHUB_TOKEN');
    if (!owner || !repo || !token) {
      throw new Error(
        'Configure GITHUB_OWNER, GITHUB_REPO e GITHUB_TOKEN nas propriedades do script.',
      );
    }

    const url_id = Publish.urlId_();
    if (!url_id) {
      throw new Error(
        'Não consegui identificar a URL /exec do Web App. Implante o aplicativo pela UI ' +
          '(Implantar > Nova implantação > Aplicativo da web) e tente de novo.',
      );
    }

    const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dispatches`;
    const response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      // Sem `timeout`: o UrlFetchApp não oferece esse parâmetro — o limite de
      // execução da função (6 min) é o teto. O fetch roda fora do lock.
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'portfolio-cms',
      },
      payload: JSON.stringify({
        event_type: 'publish-wedding',
        client_payload: { publication_id: slug, url_id },
      }),
      muteHttpExceptions: true,
    });

    return {
      ok: response.getResponseCode() === 204,
      code: response.getResponseCode(),
      body: response.getContentText(),
    };
  },

  /** Trunca o corpo de erro do GitHub para o toast (sem privar do diagnóstico). */
  resumoDeErro(result) {
    const body = String(result.body || '')
      .replace(/\s+/g, ' ')
      .trim();
    return body.length > 200 ? body.slice(0, 200) + '…' : body;
  },
};
