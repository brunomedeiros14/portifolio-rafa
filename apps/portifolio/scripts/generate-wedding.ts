import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');

const MIN_EDGE = 1600;
const MAX_BYTES = 20 * 1024 * 1024;
const MIN_GALLERY = 8;
const WARN_BYTES = 4 * 1024 * 1024;

const input = process.argv[2];

let stagingDir: string | undefined;

interface WeddingImage {
  url: string;
  filename?: string;
}

interface Publication {
  slug: string;
  couple: string;
  date: string;
  city: string;
  state: string;
  venue?: string;
  description: string;
  excerpt: string;
  cover: WeddingImage;
  gallery?: WeddingImage[];
  featured?: boolean;
  draft?: boolean;
  tags?: string[];
  error?: string;
}

function fail(message: string): never {
  if (stagingDir) {
    // Não usamos await aqui porque fail() também é chamado durante
    // validações antes de main().
    Bun.$`rm -rf ${stagingDir}`.quiet();
  }

  console.error(`❌ ${message}`);
  process.exit(1);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (!input) {
  fail('Uso: bun scripts/generate-wedding.ts <publication.json>');
}

const inputPath = resolve(input);

let pub: Publication;

try {
  pub = JSON.parse(await readFile(inputPath, 'utf8')) as Publication;
} catch (error) {
  fail(`publication.json não é um JSON válido: ${getErrorMessage(error)}`);
}

if (!pub || typeof pub !== 'object') {
  fail('publication.json contém um valor inválido.');
}

if (pub.error) {
  fail(`Erro retornado pelo endpoint do GAS: ${pub.error}`);
}

const REQUIRED = [
  'slug',
  'couple',
  'date',
  'city',
  'state',
  'description',
  'excerpt',
  'cover',
] as const;

for (const field of REQUIRED) {
  const value = pub[field];

  if (typeof value === 'string' && value.trim() === '') {
    fail(`Campo obrigatório ausente: ${field}`);
  }

  if (value === null || value === undefined) {
    fail(`Campo obrigatório ausente: ${field}`);
  }
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(pub.date)) {
  fail(`Data inválida ("${pub.date}"), esperado YYYY-MM-DD.`);
}

if (pub.excerpt.length > 220) {
  fail(`excerpt deve ter no máximo 220 caracteres ` + `(tem ${pub.excerpt.length}).`);
}

if (!pub.cover?.url) {
  fail('A capa precisa possuir uma URL.');
}

const slug = pub.slug.trim();

const weddingsDir = resolve(ROOT, 'src/content/weddings');
const base = resolve(weddingsDir, slug);
const staging = resolve(weddingsDir, `.staging-${slug}`);
const imagesDir = resolve(staging, 'images');

stagingDir = staging;

function safeName(name: string | undefined): string {
  const sanitized = String(name ?? '')
    .normalize('NFC')
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');

  return sanitized || `foto-${crypto.randomUUID()}.jpg`;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB`;
}

interface ImageInfo {
  size: number;
  width: number;
  height: number;
  long: number;
}

async function inspect(path: string): Promise<ImageInfo> {
  const [{ size }, metadata] = await Promise.all([stat(path), sharp(path).metadata()]);

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  return {
    size,
    width,
    height,
    long: Math.max(width, height),
  };
}

async function checkPhoto(path: string, role: string): Promise<ImageInfo> {
  const info = await inspect(path);
  const name = basename(path);

  if (!info.width || !info.height) {
    fail(`${role}: "${name}" não é uma imagem legível.`);
  }

  if (info.long < MIN_EDGE) {
    fail(
      `${role}: "${name}" tem ${info.long} px de lado maior ` +
        `e o mínimo é ${MIN_EDGE} px. ` +
        `A página do Ampliar não amplia a imagem — ` +
        `ela apareceria borrada.`,
    );
  }

  if (info.size > MAX_BYTES) {
    fail(`${role}: "${name}" tem ${formatMb(info.size)}; ` + `o limite é ${formatMb(MAX_BYTES)}.`);
  }

  if (info.size > WARN_BYTES) {
    console.log(
      `  ⚠ ${name} tem ${formatMb(info.size)} — ` +
        `o painel deveria ter redimensionado para 2400 px.`,
    );
  }

  return info;
}

const downloadCache = new Map<string, string>();

async function download(url: string, destination: string): Promise<void> {
  const cached = downloadCache.get(url);

  if (cached) {
    return;
  }

  const response = await fetch(url, {
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  }

  const data = await response.arrayBuffer();

  await Bun.write(destination, data);

  downloadCache.set(url, destination);
}

function yaml(value: unknown): string {
  const text = String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replace(/\r?\n/g, ' ');

  return `"${text}"`;
}

function yamlList(items: string[] | undefined): string {
  if (!items?.length) {
    return 'tags: []';
  }

  return ['tags:', ...items.map((item) => `  - ${yaml(item)}`)].join('\n');
}

async function downloadCoverAndGallery(): Promise<{
  coverName: string;
  galleryNames: string[];
}> {
  const coverName = safeName(pub.cover.filename ?? 'cover.jpg');

  await download(pub.cover.url, resolve(imagesDir, coverName));

  const seen = new Set<string>([coverName.toLowerCase()]);

  const galleryNames: string[] = [];

  for (const item of pub.gallery ?? []) {
    if (!item?.url) {
      throw new Error('Uma foto da galeria não possui URL.');
    }

    const originalName = safeName(item.filename);

    if (originalName.toLowerCase() === coverName.toLowerCase()) {
      continue;
    }

    const extensionIndex = originalName.lastIndexOf('.');
    const hasExtension = extensionIndex > 0;

    const extension = hasExtension ? originalName.slice(extensionIndex) : '';

    const stem = hasExtension ? originalName.slice(0, extensionIndex) : originalName || 'foto';

    let candidate = originalName;
    let counter = 2;

    while (seen.has(candidate.toLowerCase())) {
      candidate = `${stem}-${counter++}${extension}`;
    }

    seen.add(candidate.toLowerCase());

    await download(item.url, resolve(imagesDir, candidate));

    galleryNames.push(candidate);
  }

  return {
    coverName,
    galleryNames,
  };
}

function createFrontmatter(coverName: string): string {
  const lines = [
    '---',
    `slug: ${yaml(slug)}`,
    `couple: ${yaml(pub.couple)}`,
    `date: ${pub.date}`,
    `city: ${yaml(pub.city)}`,
    `state: ${yaml(pub.state)}`,
  ];

  if (pub.venue?.trim()) {
    lines.push(`venue: ${yaml(pub.venue)}`);
  }

  lines.push(
    `description: ${yaml(pub.description)}`,
    `excerpt: ${yaml(pub.excerpt)}`,
    `cover: "./images/${coverName}"`,
    `featured: ${pub.featured ? 'true' : 'false'}`,
    `draft: ${pub.draft ? 'true' : 'false'}`,
    yamlList(pub.tags),
    '---',
  );

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  console.log(`\n💍 Gerando evento "${slug}"...\n`);

  await mkdir(imagesDir, { recursive: true });

  const { coverName, galleryNames } = await downloadCoverAndGallery();

  console.log('  conferindo as fotos...');

  await checkPhoto(resolve(imagesDir, coverName), 'capa');

  if (!pub.draft && galleryNames.length < MIN_GALLERY) {
    fail(
      `Galeria com ${galleryNames.length} fotos e o mínimo é ` +
        `${MIN_GALLERY}. Marque o evento como rascunho ` +
        `se a publicação for parcial.`,
    );
  }

  const mdx = createFrontmatter(coverName);

  await Bun.write(resolve(staging, 'index.mdx'), mdx);

  // A publicação só acontece depois que tudo foi baixado,
  // validado e escrito no staging.
  await rm(base, {
    recursive: true,
    force: true,
  });

  await rename(staging, base);

  // O staging deixa de existir após o rename.
  stagingDir = undefined;

  console.log(`  ✓ index.mdx (${mdx.length} bytes)`);
  console.log(`  ✓ images/ ${coverName} + ${galleryNames.length} fotos`);

  for (const name of galleryNames) {
    console.log(`            ${name}`);
  }

  console.log('\n✓ Evento gerado com sucesso.');
  console.log('  Confira o resultado com: bun run check\n');
}

try {
  await main();
} catch (error) {
  fail(`Falha ao gerar o evento: ${getErrorMessage(error)}`);
}
