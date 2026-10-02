/**
 * Ponte entre os nomes usados no site e os arquivos do pacote
 * `bootstrap-icons`.
 *
 * O pacote tem 2078 ícones; importar o webfont inteiro custaria 132 KB para
 * usar sete. Aqui cada `<Icon name="...">` resolve o arquivo em
 * `node_modules/bootstrap-icons/icons/<name>.svg` no build e extrai o
 * conteúdo interno, descartando o `<svg>` externo do arquivo.
 *
 * Consequência de projeto: os ícones do Bootstrap são preenchidos
 * (`fill="currentColor"`) em viewBox 16, não contornados como eram antes.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export type IconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'envelope'
  | 'instagram'
  | 'list'
  | 'whatsapp'
  | 'x-lg';

const cache = new Map<IconName, string>();

/**
 * Extrai o miolo do `<svg>` do arquivo do Bootstrap.
 *
 * O `[^>]*` do regex para em `>` para não comer o atributo `fill-rule` do
 * primeiro `<path fill-rule="evenodd" ...>`, e o `[^s]` evita casar o `<svg>`
 * como prefixo de `<symbol>` caso o arquivo venha do sprite.
 */
function load(name: IconName): string {
  const cached = cache.get(name);
  if (cached) return cached;

  const path = require.resolve(`bootstrap-icons/icons/${name}.svg`);
  const source = readFileSync(path, 'utf8');

  const match = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!match) {
    throw new Error(`bootstrap-icons: não consegui extrair o ícone "${name}" de ${path}`);
  }

  const inner = match[1].trim();
  cache.set(name, inner);
  return inner;
}

export function icon(name: IconName): string {
  return load(name);
}
