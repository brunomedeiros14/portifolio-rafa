/** Tipos compartilhados entre componentes. */

/** Item de uma trilha de navegação. Sem `href`, é a página atual. */
export interface Crumb {
  label: string;
  href?: string;
}
