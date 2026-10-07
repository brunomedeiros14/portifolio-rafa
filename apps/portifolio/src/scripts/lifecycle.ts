/**
 * Ciclo de vida de scripts de componente sob o `ClientRouter`.
 *
 * O Astro empacota o `<script>` de um componente em um modulo ES e o executa
 * **uma unica vez**. Com `astro:transitions` o `<body>` inteiro e substituido a
 * cada navegacao, mas modulos ja executados nao rodam de novo. A consequencia
 * e que qualquer `document.querySelector` feito no escopo do modulo passa a
 * apontar para elementos que ja foram descartados pelo DOM trocado.
 *
 * `onPageLoad` resolve isso: chama `init` na hora e a cada `astro:page-load`.
 * Cada `init` deve ser idempotente, abortando os listeners da execucao
 * anterior antes de religar.
 */

type Init = () => void;

const registered = new WeakSet<Init>();

export function onPageLoad(init: Init): void {
  if (registered.has(init)) return;
  registered.add(init);

  // Execucao inicial. Pode ja ter acontecido um `astro:page-load` se este
  // modulo so foi carregado durante uma navegacao; nesse caso `init` sera
  // chamado de novo logo abaixo e o AbortController interno limpa a primeira
  // passada.
  init();

  document.addEventListener('astro:page-load', init);
}
