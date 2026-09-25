/**
 * Publicação:
 *  1. buildPublication  — monta o JSON que o workflow baixa (textos + links públicos do Drive).
 *  2. publicationEndpoint_ — endpoint doPost chamado pelo GitHub.
 *  3. dispatch(slug) — dispara repository_dispatch no GitHub (botão "Executar automação").
 */
const Publish = {
  json_(obj) {
    return ContentService
      .createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  },

  /**
   * Endpoint consumido pelo workflow. O GAS sempre responde HTTP 200; erros vêm
   * no corpo em { error: "..." }.
   */
  publicationEndpoint_(req) {
    const token = PropertiesService.getScriptProperties().getProperty('CMS_API_TOKEN');
    if (!token || !req || req.token !== token) {
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
    return Publish.json_(Publish.buildPublication(event));
  },

  buildPublication(event) {
    const driveLinks = (list) =>
      (list || []).map((f) => ({
        filename: f.name,
        url: Drive.downloadUrl(f.id),
      }));

    return {
      slug: event.slug,
      title: event.title,
      couple: event.couple,
      date: event.date,
      location: event.location,
      city: event.city,
      state: event.state,
      venue: event.venue,
      description: event.description,
      excerpt: event.excerpt,
      featured: !!event.featured,
      tags: Array.isArray(event.tags) ? event.tags : [],
      vendors: Array.isArray(event.vendors) ? event.vendors : [],
      seoTitle: event.seoTitle || undefined,
      seoDescription: event.seoDescription || undefined,
      cover: event.cover_id
        ? { filename: event.cover_name || 'cover.jpg', url: Drive.downloadUrl(event.cover_id) }
        : null,
      gallery: driveLinks(event.gallery),
      story: {
        html: event.historia_html || '',
        images: driveLinks(event.story),
      },
    };
  },

  /**
   * Dispara o workflow "publish-wedding" via GitHub API (repository_dispatch).
   * Retorna { ok, code, body }.
   */
  dispatch(slug) {
    const props = PropertiesService.getScriptProperties();
    const owner = props.getProperty('GITHUB_OWNER');
    const repo = props.getProperty('GITHUB_REPO');
    const token = props.getProperty('GITHUB_TOKEN');

    if (!owner || !repo || !token) {
      throw new Error('Configure GITHUB_OWNER, GITHUB_REPO e GITHUB_TOKEN nas propriedades do script.');
    }

    // ID da URL do deployment Web App atual (https://script.google.com/macros/s/<id>/exec).
    // Viaja no client_payload para o workflow montar o endpoint sem depender de secret.
    let url_id = '';
    try {
      const m = String(ScriptApp.getService().getUrl() || '').match(/macros\/s\/([^/]+)\/exec/);
      if (m) url_id = m[1];
    } catch (e) {
      // sem deployment (ex.: execução local) — o workflow falha com mensagem clara.
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dispatches`;
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
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
};