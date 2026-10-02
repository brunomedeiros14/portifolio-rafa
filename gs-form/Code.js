/**
 * Entrega dos templates HTML do painel.
 */
const Serve = {
  /**
   * `XFrameOptionsMode.DEFAULT` e não `ALLOWALL`: o painel é uma superfície de
   * escrita na planilha e no repositório, e não há motivo para permitir que
   * qualquer site o embuta num iframe.
   */
  html(file, title) {
    return HtmlService.createHtmlOutputFromFile(file)
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  },

  panel() {
    return Serve.html('index', 'Casamentos — Controle de Publicação');
  },

  login() {
    return Serve.html('login', 'Casamentos — acesso');
  },
};

/**
 * Roteamento do Web App do Google Apps Script.
 *
 *   doGet:  serve a tela de login ou o painel de controle.
 *   doPost: endpoint único usado pelo workflow do GitHub para baixar a publicação
 *           ({ action: "publication", token, publicationId }).
 *
 * O Web App roda como "executar como eu / qualquer pessoa", o único modo que o
 * GAS oferece sem um servidor. Sem o gate de `Auth`, qualquer pessoa que abra a
 * URL poderia chamar as funções globais e, com elas, ler e escrever na
 * planilha, no Drive e disparar publicação no GitHub com a sua conta. Por isso
 * `doGet` entrega `login.html` a quem não tem sessão, e todas as funções `api*`
 * chamam `Auth.requireAuth_()`.
 *
 * Observação: o GAS sempre responde HTTP 200 em web apps. Por isso os erros
 * chegam no corpo como JSON { error: "..." } e é o `generate-wedding.mjs` que
 * valida o conteúdo.
 */
function doGet(e) {
  const p = (e && e.parameter) || {};

  // Sonda de saúde: sem sessão e sem tocar planilha nem Drive. O
  // `Events.ensureSetup()` criava uma planilha e uma pasta em *toda* visita à
  // página, inclusive no `?health=1`.
  if (p.health === '1') {
    return Publish.json_({ ok: true, service: 'portfolio-cms', auth: !!Auth.authorized_() });
  }

  Events.ensureSetup();

  return Auth.authorized_() ? Serve.panel() : Serve.login();
}

/**
 * Endpoint consumido pelo workflow `.github/workflows/publish-wedding.yml`.
 * Exemplo:
 *   POST {webappUrl}/exec
 *   { "action": "publication", "token": "<CMS_API_TOKEN>", "publicationId": "<slug>" }
 */
function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return Publish.json_({ error: 'invalid_json' });
  }

  try {
    return Publish.publicationEndpoint_(req);
  } catch (err) {
    // Nunca deixar a exceção escapar: o GAS responde 302/corpo vazio e o
    // workflow baixa um arquivo vazio sem explicação. A mensagem e a stack vão
    // para o log do Cloud (`exceptionLogging: STACKDRIVER`) — devolver a stack
    // para quem chamou a URL entregaria nomes de arquivo e estado interno.
    console.error('doPost falhou: ' + String((err && err.stack) || err));
    return Publish.json_({ error: 'internal' });
  }
}
