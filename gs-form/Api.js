/**
 * Funções globais chamadas pela interface via `google.script.run`.
 *
 * Só o escopo global do projeto é alcançável pelo cliente, e `google.script.run`
 * executa no servidor com a autoridade do dono do script — sem passar por
 * `doGet`. Por isso **toda** função aqui começa com `Auth.requireAuth_(token)`:
 * sem isso, qualquer pessoa que abra a URL do Web App (implantado como
 * "qualquer pessoa") leria a planilha, apagaria eventos e dispararia publicação
 * no GitHub com o seu PAT.
 *
 * O `token` é o primeiro parâmetro de todas — é assim que a sessão chega ao
 * servidor, já que não existe cookie (ver Auth.js). O painel o anexa
 * automaticamente no wrapper `run()`; o cliente não precisa repassar.
 *
 * O checklist de prontidão e o slug **não** são recalculados aqui: quem manda
 * é o servidor (`Events.computeStatus`, `Slug.ensureUnique`). Duplicar a regra
 * aqui fazia o painel dizer "Tudo pronto" com valores ainda não salvos.
 */

/* -------------------------------------------------------------------- */
/* Sessão — as únicas funções abertas                                     */
/* -------------------------------------------------------------------- */

function apiAuthStatus(token) {
  return Auth.status_(token);
}

function apiLogin(password) {
  return Auth.login(password);
}

function apiLogout(token) {
  return Auth.logout(token);
}

/* -------------------------------------------------------------------- */
/* Eventos                                                               */
/* -------------------------------------------------------------------- */

/** Lista eventos com prontidão calculada. */
function apiList(token) {
  Auth.requireAuth_(token);
  return Events.all();
}

/** Config de UI (`minGallery`). Vem do servidor: o default vive em uma fonte só. */
function apiConfig(token) {
  Auth.requireAuth_(token);
  return {
    minGallery: Events.minGallery_(),
    email: Auth.currentEmail_(token),
  };
}

/** Cria um evento e devolve a linha salva (com slug gerado sem conflito). */
function apiCreate(token, payload) {
  Auth.requireAuth_(token);
  if (!payload || !payload.couple) throw new Error('Informe ao menos o nome do casal.');
  return Events.create(payload);
}

/** Busca um evento pelo slug. */
function apiGet(token, slug) {
  Auth.requireAuth_(token);
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  return event;
}

/**
 * Salva o formulário de edição.
 *
 * O que entra é filtrado por `Events.EDITABLE`: `cover_id`, `cover_name`,
 * `gallery`, `status` e `created_at` ficam de fora, senão o formulário (ou
 * qualquer chamada direta) trocaria a capa por um id de Drive arbitrário e esse
 * id acabaria no JSON público da publicação.
 */
function apiSave(token, slug, payload) {
  Auth.requireAuth_(token);
  return Events.update(slug, payload);
}

/** Apaga a linha do evento. */
function apiDelete(token, slug) {
  Auth.requireAuth_(token);
  Events.remove(slug);
  return { ok: true };
}

/* -------------------------------------------------------------------- */
/* Fotos                                                                 */
/* -------------------------------------------------------------------- */

/**
 * Upload individual (payload base64 `{ data, name, type, clientId }`).
 *
 * `clientId` é gerado no navegador antes de cada arquivo: se a resposta se
 * perder e o cliente reenviar, o mesmo id não cria uma segunda entrada na
 * galeria — nem um segundo arquivo no Drive.
 *
 * O arquivo nasce **privado** e só vira público depois que a planilha aceitou a
 * linha. Marcar antes deixava JPEG órfão acessível por qualquer um sempre que a
 * escrita falhasse.
 */
function apiUploadPhoto(token, slug, payload) {
  Auth.requireAuth_(token);

  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  if (!Events.get(s)) throw new Error(`Evento não encontrado: ${s}`);
  if (!payload || !payload.data || !payload.name) throw new Error('Selecione uma imagem.');

  const saved = Files.savePhoto(s, payload);
  try {
    Events.appendPhoto(s, {
      name: saved.name,
      id: saved.id,
      label: String(payload.name || saved.name),
      bytes: saved.bytes,
      clientId: String(payload.clientId || ''),
    });
  } catch (err) {
    // Não deixa o arquivo órfão no Drive se a planilha recusar a linha.
    Files.discard_(saved.id);
    throw err;
  }

  Files.publish_(saved.id);

  return Events.listFiles(s);
}

/** Marca/limpa a capa pelo nome da foto ('' limpa). */
function apiSetCover(token, slug, name) {
  Auth.requireAuth_(token);
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  Events.setCover(s, String(name || ''));
  return Events.listFiles(s);
}

/** Remove a foto (Drive + lista). Se era a capa, limpa. */
function apiRemovePhoto(token, slug, name) {
  Auth.requireAuth_(token);
  const s = String(slug || '').trim();
  if (!s) throw new Error('Evento não identificado.');
  Events.removePhoto(s, name);
  Files.removePhoto(s, name);
  return Events.listFiles(s);
}

/** Arquivos do evento ({cover, photos}). */
function apiListFiles(token, slug) {
  Auth.requireAuth_(token);
  return Events.listFiles(slug);
}

/* -------------------------------------------------------------------- */
/* Publicação                                                            */
/* -------------------------------------------------------------------- */

/**
 * Texto da publicação (mesmo JSON enviado ao GitHub) para conferência.
 * É a checagem definitiva: o botão publicar só habilita com isto.
 */
function apiPublication(token, slug) {
  Auth.requireAuth_(token);
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  return Publish.buildPublication(event);
}

/** Recalcula o checklist a partir dos valores *salvos*. */
function apiChecklist(token, slug) {
  Auth.requireAuth_(token);
  const event = Events.get(slug);
  if (!event) throw new Error(`Evento não encontrado: ${slug}`);
  return Events.computeStatus(event);
}

/**
 * Botão "Executar automação": valida a prontidão e dispara o workflow no
 * GitHub. O `LockService` impede que dois cliques (ou duas abas) disparem o
 * workflow duas vezes — cada execução faz commit e push.
 */
function apiPublish(token, slug) {
  Auth.requireAuth_(token);
  return Lock.withScriptLock_(() => {
    const event = Events.get(slug);
    if (!event) throw new Error(`Evento não encontrado: ${slug}`);

    const check = Events.computeStatus(event);
    if (check.missed.length > 0) {
      throw new Error(`Evento incompleto — falta: ${check.missed.join(', ')}`);
    }

    const result = Publish.dispatch(slug);
    if (!result.ok) throw new Error(`GitHub respondeu HTTP ${result.code}: ${result.body}`);

    Events.markPublished(slug);
    return { ok: true, slug };
  });
}
