/**
 * Servidor da interface (HtmlService). O template vive em index.html.
 */
const Ui = {
  serve() {
    return HtmlService
      .createHtmlOutputFromFile('index')
      .setTitle('Casamentos — Controle de Publicação')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  },
};