/**
 * Publicação:
 *  1. buildPublication  — monta o JSON que o workflow baixa (textos + links públicos do Drive).
 *  2. publicationEndpoint_ — endpoint doPost chamado pelo GitHub.
 *  3. dispatch(slug) — dispara repository_dispatch no GitHub (botão "Executar automação").
 */
/** Teto de bytes por evento, checado em `buildPublication`. */
const MAX_EVENT_BYTES = 400 * 1024 * 1024;

const Publish = {
  json_(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
      ContentService.MimeType.JSON,
    );
  },

  /**
   * Endpoint consumido pelo workflow. O GAS sempre responde HTTP 200; erros vêm
   * no corpo em { error: "..." }.
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
    return Publish.json_(Publish.buildPublication(event));
  },

  /**
   * Compara dois segredos sem sair no primeiro byte diferente.
   *
   * `req.token !== token` devolvia assim que a primeira letra batia, o que
   * expõe o token por tempo conforme o prefixo certo vai sendo descoberto —
   * com um endpoint público e sem limite de tentativas. Aqui o custo é o mesmo
   * para qualquer entrada; o `hash_` também normaliza o comprimento (o XOR
   * byte a byte sairia errado para tamanhos diferentes).
   */
  constantTimeEquals_(a, b) {
    const x = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      a,
      Utilities.Charset.UTF_8,
    );
    const y = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      b,
      Utilities.Charset.UTF_8,
    );
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
  },

  buildPublication(event) {
    const driveLinks = (list) =>
      (list || []).map((f) => ({
        filename: f.name,
        url: Files.downloadUrl(f.id),
      }));

    // Todas as fotos enviadas vão para a galeria, menos a capa. Não há mais
    // classificação entre "story" e galeria: a página não tem texto.
    const photos = Array.isArray(event.gallery) ? event.gallery : [];
    const gallery = driveLinks(photos.filter((p) => p.name !== event.cover_name));

    // O `generate-wedding.mjs` baixa tudo para `images/<slug>/`; sem um teto, um
    // evento com muitas fotos estoura o limite de 100 MB do Drive e o próprio
    // script. `Events.appendPhoto` já trava em `Files.MAX_PHOTOS` (quantidade);
    // aqui o limite é de bytes, que o de quantidade não pega.
    const totalBytes = photos.reduce((sum, p) => sum + (Number(p.bytes) || 0), 0);
    if (totalBytes > MAX_EVENT_BYTES) {
      throw new Error(
        `As fotos somam ${Math.round(totalBytes / (1024 * 1024))} MB; o limite é ` +
          `${Math.round(MAX_EVENT_BYTES / (1024 * 1024))} MB por evento.`,
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
      tags: Array.isArray(event.tags) ? event.tags : [],
      cover: event.cover_id
        ? { filename: event.cover_name || 'cover.jpg', url: Files.downloadUrl(event.cover_id) }
        : null,
      gallery,
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
      throw new Error(
        'Configure GITHUB_OWNER, GITHUB_REPO e GITHUB_TOKEN nas propriedades do script.',
      );
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
