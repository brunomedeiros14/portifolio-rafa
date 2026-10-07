/**
 * Roteamento do Web App.
 *
 *   doGet:  serve uma das páginas HTML do bundle (login/detecção no React) ou
 *           responde `?health=1`.
 *   doPost: endpoint único do workflow `publish-wedding.yml` (baixar a publicação).
 *
 * Implantado como "executar como eu / qualquer pessoa" — o único modo do GAS sem
 * servidor. Sem o gate de `Auth`, qualquer pessoa com a URL poderia chamar as
 * funções globais e, com elas, escrever na planilha/Drive e disparar publicação
 * no GitHub com a sua conta. Por isso `doGet` só roda `ensureSetup` (que cria
 * planilha/pasta/token) DEPOIS de `Auth.authorized_`; e por isso cada função `api*`
 * em Api.ts começa com `Auth.requireAuth_(token)`.
 *
 * O GAS responde sempre HTTP 200: erros chegam no corpo como `{ error: "..." }`,
 * e quem valida é o `.github/workflows/publish-wedding.yml`.
 */
function doGet(e) {
  const p = (e && e.parameter) || {};

  // Sonda de saúde — sem sessão e sem tocar planilha/Drive. A chamada `POST`
  // que o setup do deployment faz com `home` entrega `undefined`; o `?health`
  // evita que essa segunda visita crie os recursos.
  const token = String(p.token || '');
  const auth = Auth.authorized_(token);
  if (p.health === '1') {
    return Publish.json_({ ok: true, service: 'portfolio-cms', auth: !!auth });
  }

  // ALLOWALL e não DEFAULT: o `/admin` do site embute o painel num iframe
  // (retificação §10). Mover `ensureSetup` para dentro do gate evita provisionar
  // recursos na sua conta para todo visitante anônimo da tela de login.
  if (auth) {
    Events.ensureSetup();
    return Serve.html('index', 'CMS de Casamentos — Painel');
  }
  return Serve.html('index', 'CMS de Casamentos — acesso');
}

/** Endpoint do workflow: `{ action: "publication", token, publicationId }` (JSON). */
function doPost(e) {
  let req;
  try {
    req = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (err) {
    return Publish.json_({ error: 'invalid_json' });
  }
  try {
    return Publish.publicationEndpoint_(req);
  } catch (err) {
    const detail = err instanceof Error ? err.stack || err.message : String(err);
    console.error('doPost falhou: ' + detail);
    return Publish.json_({ error: 'internal' });
  }
}
