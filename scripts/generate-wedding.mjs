// Gera o folder de um casamento no repositório a partir do JSON do Google Apps Script.
// Uso: node scripts/generate-wedding.mjs <publication.json>
//
// O JSON é retornado pelo endpoint do gs-form ({ action: "publication" }). Este script:
//  1. valida os campos obrigatórios (mesmo schema de src/content.config.ts);
//  2. baixa as fotos do Google Drive (links públicos) para images/;
//  3. escreve src/content/weddings/<slug>/index.mdx.
//
// O MDX sai só com frontmatter: a página do casamento é capa, data, local,
// uma frase de apoio na intro e galeria. Não há corpo de texto nem pasta story/.
//
// A geração é atômica: tudo é escrevido em um diretório temporário (.staging-<slug>)
// e só movido para o destino final se TODOS os passos tiverem sucesso.
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function fail(message) {
  console.error(message);
  process.exit(1);
}

const input = process.argv[2];
if (!input) fail('Uso: node scripts/generate-wedding.mjs <publication.json>');

let pub;
try {
  pub = JSON.parse(await readFile(resolve(input), 'utf8'));
} catch (err) {
  fail(`publication.json não é um JSON válido: ${err.message}`);
}

if (!pub || pub.error) fail(`Erro retornado pelo endpoint do gs-form: ${pub && pub.error}`);

const REQUIRED = [
  'slug', 'title', 'couple', 'date', 'location', 'state', 'description', 'excerpt', 'cover',
];
for (const field of REQUIRED) {
  if (String(pub[field] ?? '').trim() === '') fail(`Campo obrigatório ausente: ${field}`);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(pub.date)) fail(`Data inválida ("${pub.date}"), esperado YYYY-MM-DD.`);
if (pub.excerpt.length > 220) fail(`excerpt deve ter no máximo 220 caracteres (tem ${pub.excerpt.length}).`);
if (pub.seoDescription && pub.seoDescription.length > 160) {
  fail(`seoDescription deve ter no máximo 160 caracteres (tem ${pub.seoDescription.length}).`);
}

const slug = pub.slug.trim();
const base = resolve('src/content/weddings', slug);
const staging = resolve('src/content/weddings', `.staging-${slug}`);
const imagesDir = resolve(staging, 'images');

/** Sanitiza nome de arquivo (mantém acentos, remove separadores de path e truques tipo ".."). */
function safeName(name) {
  const s = String(name ?? '')
    .normalize('NFC')
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
  return s || `foto-${Math.random().toString(36).slice(2)}.jpg`;
}

const downloadCache = new Map();
async function download(url, dest) {
  if (downloadCache.has(url)) return downloadCache.get(url);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  downloadCache.set(url, dest);
}

function yaml(value) {
  const s = String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  return `"${s}"`;
}

function yamlList(items) {
  return (items || []).map((item) => `  - ${yaml(item)}`).join('\n');
}

async function downloadCoverAndGallery() {
  const coverName = safeName(pub.cover.filename || 'cover.jpg');
  await download(pub.cover.url, resolve(imagesDir, coverName));

  const seen = new Set([coverName.toLowerCase()]);
  const downloaded = [];
  for (const item of pub.gallery || []) {
    let name = safeName(item.filename);
    if (name.toLowerCase() === coverName.toLowerCase()) continue;
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const stem = name.slice(0, name.length - ext.length) || 'foto';
    let candidate = name;
    let i = 2;
    while (seen.has(candidate.toLowerCase())) candidate = `${stem}-${i++}${ext}`;
    seen.add(candidate.toLowerCase());
    await download(item.url, resolve(imagesDir, candidate));
    downloaded.push(candidate);
  }
  return { coverName, galleryNames: downloaded };
}

async function main() {
  console.log(`Gerando evento "${slug}"...`);

  await mkdir(imagesDir, { recursive: true });

  const { coverName, galleryNames } = await downloadCoverAndGallery();

  const frontmatter = [
    '---',
    `title: ${yaml(pub.title)}`,
    `slug: ${yaml(slug)}`,
    `couple: ${yaml(pub.couple)}`,
    `date: ${pub.date}`,
    `location: ${yaml(pub.location)}`,
    `state: ${yaml(pub.state)}`,
    `description: ${yaml(pub.description)}`,
    `excerpt: ${yaml(pub.excerpt)}`,
    `cover: "./images/${coverName}"`,
    `featured: ${pub.featured ? 'true' : 'false'}`,
    `draft: ${pub.draft ? 'true' : 'false'}`,
    pub.tags && pub.tags.length ? `tags:\n${yamlList(pub.tags)}` : 'tags: []',
  ].concat(pub.seoTitle ? `seoTitle: ${yaml(pub.seoTitle)}` : []);
  if (pub.seoDescription) frontmatter.push(`seoDescription: ${yaml(pub.seoDescription)}`);
  frontmatter.push('---');

  const mdx = frontmatter.join('\n') + '\n';
  await writeFile(resolve(staging, 'index.mdx'), mdx);

  // Comita a mudança de forma atômica: remover destino anterior e mover o staging.
  await rm(base, { recursive: true, force: true });
  await rename(staging, base);

  console.log(`  ✓ index.mdx   (${mdx.length} bytes)`);
  console.log(`  ✓ images/  ${coverName}`);
  for (const name of galleryNames) console.log(`            ${name}`);
  console.log('Pronto. Confira o resultado com "pnpm check".');
}

try {
  await main();
} catch (err) {
  await rm(staging, { recursive: true, force: true });
  fail(`Falha ao gerar o evento: ${err.message}`);
}