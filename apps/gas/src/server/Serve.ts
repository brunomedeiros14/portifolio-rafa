/**
 * Entrega dos HTML do painel. O bundle Vite vira um arquivo estático
 * `index.html` no projeto (pushed por clasp) — `createHtmlOutputFromFile`
 * renderiza o mesmo bundle para login e painel; quem decide a tela é o React,
 * segundo sessão/token. ALLOWALL porque o `/admin` do site embute num iframe.
 */
const Serve = {
  html(file, title) {
    return HtmlService.createHtmlOutputFromFile(file)
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  },
};
