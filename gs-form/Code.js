/**
 * Ponteiro do Web App do Google Apps Script.
 *
 * Roteamento:
 *  - doGet:  abre a interface de controle (lista / criar / editar / fotos / publicar).
 *  - doPost: endpoint único usado pelo workflow do GitHub para baixar a publicação
 *            ({ action: "publication", token, publicationId }).
 *
 * Observação: o Google Apps Script sempre responde com HTTP 200 em web apps.
 * Por isso, erros chegam no corpo da resposta como JSON { error: "..." } e o
 * script de geração (generate-wedding.mjs) é quem valida o conteúdo.
 */
function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  Events.ensureSetup();

  if (p.health === '1') {
    return Publish.json_({ ok: true, service: 'portfolio-cms' });
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Casamentos — Controle de Publicação')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Endpoint consumido pelo workflow `.github/workflows/publish-wedding.yml`.
 * Exemplo de requisição:
 *   POST {webappUrl}/exec
 *   { "action": "publication", "token": "<CMS_API_TOKEN>", "publicationId": "<slug>" }
 */
function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return Publish.json_({ error: 'invalid_json', detail: String((err && err.message) || err) });
  }
  try {
    return Publish.publicationEndpoint_(req);
  } catch (err) {
    // Nunca deixar uma exceção escapar: o GAS responde 302/corpo vazio e o workflow
    // baixa um arquivo vazio sem explicação. Erro sempre vira JSON no corpo.
    return Publish.json_({
      error: 'internal',
      detail: String((err && err.message) || err),
      stack: String((err && err.stack) || ''),
    });
  }
}

/** Versão exibida no rodapé da UI para depuração de deploy. */
function version_() {
  return 'gs-form@1.0.0';
}