const urlId = process.env.URL_ID;
const token = process.env.CMS_API_TOKEN;
const publicationId = process.env.PUBLICATION_ID;

if (!urlId || urlId.includes('undefined') || urlId.includes('(')) {
  console.error('Faltou URL_ID (id da URL /macros/s/<id>/exec).');
  process.exit(1);
}

if (!token) {
  console.error('Faltou CMS_API_TOKEN.');
  process.exit(1);
}

if (!publicationId) {
  console.error('Faltou PUBLICATION_ID.');
  process.exit(1);
}

const cmsUrl = `https://script.google.com/macros/s/${urlId}/exec`;

const response = await fetch(cmsUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    action: 'publication',
    token,
    publicationId,
  }),
});

const body = await response.text();

await Bun.write('publication.json', body);

console.log(`HTTP ${response.status} | ${body.length} bytes`);
console.log(body.slice(0, 400));

if (!response.ok) {
  console.error(
    `GAS respondeu HTTP ${response.status}. Confirme que a URL ${cmsUrl} é o deployment Web App.`,
  );
  process.exit(1);
}

if (!body.trim()) {
  console.error('GAS retornou uma resposta vazia.');
  process.exit(1);
}

try {
  JSON.parse(body);
} catch {
  console.error('Resposta não é JSON válido.');
  process.exit(1);
}

console.log('✓ Publicação processada com sucesso.');

export { };

