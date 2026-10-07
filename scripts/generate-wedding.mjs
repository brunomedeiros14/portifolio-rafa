// Gera o folder de um casamento no repositório a partir do JSON do Google Apps Script.
// Uso: node scripts/generate-wedding.mjs <publication.json>
//
// O JSON é retornado pelo endpoint do src_gas ({ action: "publication" }). Este script:
//  1. valida os campos obrigatórios (mesmo schema de src/content.config.ts);
//  2. baixa as fotos do Google Drive (links públicos) para images/;
//  3. escreve src/content/weddings/<slug>/index.mdx.
//
// O MDX sai só com frontmatter: a página do casamento é capa, data, local,
// uma frase de apoio na intro e galeria. Não há corpo de texto nem pasta story/.
// `venue` é opcional e só entra no frontmatter quando preenchido.
//
// A geração é atômica: tudo é escrevido em um diretório temporário (.staging-<slug>)
// e só movido para o destino final se TODOS os passos tiverem sucesso.
import { rmSync } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';

/** Preenchido assim que o staging tem nome; `fail()` o limpa antes de sair. */
let stagingDir = null;

/**
 * Limites de uma foto publicável.
 *
 * Derivados do que o site realmente consome, não de gosto:
 *  - `MIN_EDGE` é o piso de `src/content/weddings`. As 105 fotos já publicadas
 *    vão de 1600 px a 6016 px de lado maior, e o lightbox pede 1920 px
 *    (`Gallery.astro`). Abaixo de 1600 o `sharp` não amplia: a foto apareceria
 *    borrada justamente na tela de Ampliar.
 *  - `MAX_BYTES` é uma rede de segurança, não a meta. O painel já redimensiona
 *    para 2400 px antes de enviar; se chegar algo maior, a imagem está válida e
 *    o script avisa em vez de barrar — só um byte absurdo é erro.
 */
const MIN_EDGE = 1600;
const MAX_BYTES = 20 * 1024 * 1024;

/** Mesmo piso do `Events.minGallery_()` no src_gas. */
const MIN_GALLERY = 8;

/**
 * Aborta limpa.
 *
 * O `rm` do `catch` no fim não cobre a validação: `fail` sai na hora, e o
 * `.staging-<slug>/` ficava no repositório com as fotos já baixadas — 30 MB de
 * lixo por tentativa recusada. Por isso a limpeza é síncrona e acontece aqui.
 */
function fail(message) {
  if (stagingDir) rmSync(stagingDir, { recursive: true, force: true });
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

if (!pub || pub.error) fail(`Erro retornado pelo endpoint do src_gas: ${pub && pub.error}`);

const REQUIRED = ['slug', 'couple', 'date', 'city', 'state', 'description', 'excerpt', 'cover'];
for (const field of REQUIRED) {
  if (String(pub[field] ?? '').trim() === '') fail(`Campo obrigatório ausente: ${field}`);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(pub.date))
  fail(`Data inválida ("${pub.date}"), esperado YYYY-MM-DD.`);
if (pub.excerpt.length > 220)
  fail(`excerpt deve ter no máximo 220 caracteres (tem ${pub.excerpt.length}).`);

const slug = pub.slug.trim();
const base = resolve('src/content/weddings', slug);
const staging = resolve('src/content/weddings', `.staging-${slug}`);
stagingDir = staging;
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

/**
 * Lê o cabeçalho da imagem e confere os limites.
 *
 * `sharp().metadata()` só lê o cabeçalho: o arquivo não é decodificado, então
 * validar 25 fotos de 4 MB custa milissegundos.
 */
async function inspect(path) {
  const { size } = await stat(path);
  const meta = await sharp(path).metadata();
  return {
    size,
    width: meta.width || 0,
    height: meta.height || 0,
    long: Math.max(meta.width || 0, meta.height || 0),
  };
}

const mb = (bytes) => (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';

async function checkPhoto(path, role) {
  const info = await inspect(path);
  const name = basename(path);

  if (!info.width || !info.height) fail(`${role}: "${name}" não é uma imagem legível.`);
  if (info.long < MIN_EDGE) {
    fail(
      `${role}: "${name}" tem ${info.long} px de lado maior e o mínimo é ${MIN_EDGE} px. ` +
        `A página do Ampliar não amplia a imagem — ela apareceria borrada.`,
    );
  }
  if (info.size > MAX_BYTES) {
    fail(`${role}: "${name}" tem ${mb(info.size)}; o limite é ${mb(MAX_BYTES)}.`);
  }
  if (info.size > 4 * 1024 * 1024) {
    console.log(
      `  ! ${name} tem ${mb(info.size)} — o painel deveria ter redimensionado para 2400 px.`,
    );
  }

  return info;
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
  const s = String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ');
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

  // Valida depois de baixar, não antes: é o arquivo entregue pelo Drive que vai
  // para o repositório, e o nome local é o que a galeria vai usar.
  console.log('  conferindo as fotos...');
  await checkPhoto(resolve(imagesDir, coverName), 'capa');
  if (!pub.draft && galleryNames.length < MIN_GALLERY) {
    fail(
      `Galeria com ${galleryNames.length} fotos e o mínimo é ${MIN_GALLERY}. ` +
        `Marque o evento como rascunho se a publicação for parcial.`,
    );
  }

  const frontmatter = [
    '---',
    `slug: ${yaml(slug)}`,
    `couple: ${yaml(pub.couple)}`,
    `date: ${pub.date}`,
    `city: ${yaml(pub.city)}`,
    `state: ${yaml(pub.state)}`,
    String(pub.venue || '').trim() ? `venue: ${yaml(pub.venue)}` : null,
    `description: ${yaml(pub.description)}`,
    `excerpt: ${yaml(pub.excerpt)}`,
    `cover: "./images/${coverName}"`,
    `featured: ${pub.featured ? 'true' : 'false'}`,
    `draft: ${pub.draft ? 'true' : 'false'}`,
    pub.tags && pub.tags.length ? `tags:\n${yamlList(pub.tags)}` : 'tags: []',
  ].filter((line) => line !== null);
  frontmatter.push('---');

  const mdx = frontmatter.join('\n') + '\n';
  await writeFile(resolve(staging, 'index.mdx'), mdx);

  // Comita a mudança de forma atômica: remover destino anterior e mover o staging.
  await rm(base, { recursive: true, force: true });
  await rename(staging, base);

  console.log(`  ✓ index.mdx   (${mdx.length} bytes)`);
  console.log(`  ✓ images/  ${coverName} + ${galleryNames.length} fotos`);
  for (const name of galleryNames) console.log(`            ${name}`);
  console.log('Pronto. Confira o resultado com "bun run check".');
}

try {
  await main();
} catch (err) {
  fail(`Falha ao gerar o evento: ${err.message}`);
}
