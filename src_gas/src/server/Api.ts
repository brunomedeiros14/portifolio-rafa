/**
 * Funções globais chamadas pela UI via `google.script.run` — o contrato em
 * `src/ui/lib/gas.ts` (array `API_NOMES`); o build auditado falha se a UI
 * chamar uma `api*` que aqui não existe.
 *
 * `google.script.run` executa com a autoridade do dono do script e SEM passar
 * por `doGet`; por isso **toda** função começa com `Auth.requireAuth_(token)`
 * — sem o gate, qualquer pessoa que abra a URL do Web App leria a planilha,
 * apagaria eventos e dispararia publicação no GitHub com o seu PAT.
 */

/* ----------------------- Sessão (as únicas abertas) ----------------------- */

function apiAuthStatus(token) {
  return Auth.status_(token);
}

function apiLogin(password) {
  return Auth.login(password);
}

function apiLogout(token) {
  Auth.requireAuth_(token);
  return Auth.logout(token);
}

/* ------------------------------ Eventos ------------------------------------ */

function apiList(token) {
  Auth.requireAuth_(token);
  return Events.all();
}

function apiConfig(token) {
  Auth.requireAuth_(token);
  return {
    minGallery: Events.minGallery_(),
    email: Auth.currentEmail_(token),
  };
}

function apiCreate(token, payload) {
  Auth.requireAuth_(token);
  if (!payload || !payload.couple) throw new Error('Informe ao menos o nome do casal.');
  return Events.create(payload);
}

function apiGet(token, slug) {
  Auth.requireAuth_(token);
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  return event;
}

function apiSave(token, slug, payload) {
  Auth.requireAuth_(token);
  return Events.update(slug, payload);
}

function apiDelete(token, slug) {
  Auth.requireAuth_(token);
  Events.remove(slug);
  return { ok: true };
}

/* --------------------------------- Fotos ----------------------------------- */

/**
 * Upload individual (`{ data, name, type, clientId }` base64).
 *
 * Tudo roda num lock único: dedupe → criação no Drive → linha na planilha →
 * tornar o link público (§8.2, sem a corrida de serial e sem foto duplicada no
 * Drive como o fluxo antigo). `clientId` estável por arquivo torna o reenvio
 * idempotente, e o dedupe ANTES da criação evita o arquivo órfão do retry.
 */
function apiUploadPhoto(token, slug, payload) {
  Auth.requireAuth_(token);
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  if (!payload || !payload.data || !payload.name) throw new Error('Selecione uma imagem.');

  return Lock.withScriptLock_(() => {
    const current = Events.getRaw(s);
    if (!current) throw new Error(`Evento não encontrado: ${s}`);

    const clientId = String(payload.clientId || '').slice(0, Files.MAX_CLIENT_ID);
    if (clientId && current.gallery.some((f) => f.clientId === clientId)) {
      return Events.listFiles(s);
    }

    const label = String(payload.name || '').slice(0, Files.MAX_LABEL);
    const saved = Files.savePhoto(s, payload);

    Events.appendPhotoLocked_(s, {
      name: saved.name,
      id: saved.id,
      label,
      bytes: saved.bytes,
      clientId,
    });
    Files.publish_(saved.id);

    return Events.listFiles(s);
  });
}

function apiSetCover(token, slug, name) {
  Auth.requireAuth_(token);
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  Events.setCover(s, String(name || ''));
  return Events.listFiles(s);
}

/** Remove a foto (planilha + lixeira no Drive). Lixeira por `id` quando possível. */
function apiRemovePhoto(token, slug, name) {
  Auth.requireAuth_(token);
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  const removed = Events.removePhoto(s, name);
  if (removed && removed.id) {
    Files.trashById(removed.id);
  } else {
    Files.trashByName(s, name);
  }
  return Events.listFiles(s);
}

function apiListFiles(token, slug) {
  Auth.requireAuth_(token);
  return Events.listFiles(slug);
}

/* ------------------------------ Publicação --------------------------------- */

/** Preview do JSON que iria ao GitHub (mesma função de quem publica). */
function apiPublication(token, slug) {
  Auth.requireAuth_(token);
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  const data = Publish.buildPublication(event);
  if (data === null) throw new Error('Defina uma capa antes de publicar.');
  return data;
}

function apiChecklist(token, slug) {
  Auth.requireAuth_(token);
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  return Events.computeStatus(event);
}

/**
 * "Executar automação". Três passos, cada um com seu lock — o fetch do GitHub
 * NUNCA roda dentro de um lock (um GitHub lento bloquearia uploads por 30 s):
 *   1. lock: relê a linha, `computeStatus` (respeitando a exceção do rascunho),
 *      valida `url_id` — falha antes de dar o sinal;
 *   2. fora do lock: `Publish.dispatch` (timeout 15 s);
 *   3. lock: `markPublished`.
 */
function apiPublish(token, slug) {
  Auth.requireAuth_(token);
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');

  Lock.withScriptLock_(() => {
    const event = Events.get(s);
    if (!event) throw new Error(`Evento não encontrado: ${s}`);

    const check = Events.computeStatus(event);
    const blockers = Events.publicationBlockers(event, check);
    if (blockers.length > 0) {
      throw new Error(`Evento incompleto — falta: ${blockers.join(', ')}`);
    }

    const url_id = Publish.urlId_();
    if (!url_id) {
      throw new Error(
        'Não consegui identificar a URL /exec do Web App. Implante o aplicativo pela UI e tente de novo.',
      );
    }
  });

  const result = Publish.dispatch(s);
  if (!result.ok) {
    throw new Error(`O GitHub respondeu HTTP ${result.code}: ${Publish.resumoDeErro(result)}`);
  }

  Events.markPublished(s);
  return { ok: true, slug: s };
}
