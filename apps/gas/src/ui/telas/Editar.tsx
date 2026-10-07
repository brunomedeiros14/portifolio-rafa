import { useEffect, useRef, useState } from 'react';
import { call } from '../lib/gas';
import type { ArquivosEvento, Checklist, Evento } from '../lib/tipos';
import { Badge, Carregando, msgErro } from './ui';

export function Editar({
  token,
  slug,
  minGallery,
  onVoltar,
  onToast,
}: {
  token: string;
  slug: string;
  minGallery: number;
  onVoltar: () => void;
  onToast: (mensagem: string) => void;
}) {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [arquivos, setArquivos] = useState<ArquivosEvento>({ cover: null, photos: [] });
  const [falha, setFalha] = useState('');

  async function carregar() {
    try {
      const [ev, list] = await Promise.all([
        call('apiGet', token, slug),
        call('apiListFiles', token, slug),
      ]);
      setEvento(ev as Evento);
      setArquivos((list as ArquivosEvento) || { cover: null, photos: [] });
    } catch (e) {
      setFalha(msgErro(e));
    }
  }

  useEffect(() => {
    carregar();
  }, [token, slug]);

  if (falha) return <p className="text-sm text-red-600">{falha}</p>;
  if (!evento) return <Carregando />;

  return (
    <div className="space-y-8">
      <button onClick={onVoltar} className="text-sm text-muted hover:text-ink">
        ← Voltar para a lista
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl">{evento.couple}</h2>
        <span className="text-sm text-muted">/{evento.slug}</span>
        <Badge tom={evento.status === 'published' ? 'bom' : 'neutro'}>
          {evento.status === 'published' ? 'publicado' : 'não publicado'}
        </Badge>
        {evento.draft ? <Badge tom="alerta">rascunho</Badge> : null}
      </div>

      <Dados
        token={token}
        evento={evento}
        setEvento={setEvento}
        onToast={onToast}
        onExcluir={() => onVoltar()}
      />

      <Fotos
        token={token}
        slug={slug}
        evento={evento}
        arquivos={arquivos}
        setEvento={setEvento}
        setArquivos={setArquivos}
        minGallery={minGallery}
        onToast={onToast}
      />

      <Automacao
        token={token}
        slug={slug}
        evento={evento}
        setEvento={setEvento}
        onToast={onToast}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- dados */

function Dados({
  token,
  evento,
  setEvento,
  onToast,
  onExcluir,
}: {
  token: string;
  evento: Evento;
  setEvento: (e: Evento) => void;
  onToast: (m: string) => void;
  onExcluir: () => void;
}) {
  const [campos, setCampos] = useState({ ...evento });
  const [tagsTexto, setTagsTexto] = useState(evento.tags.join(', '));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  function campo<K extends keyof Evento>(k: K, v: Evento[K]) {
    setCampos({ ...campos, [k]: v });
  }

  async function salvar() {
    setErro('');
    setEnviando(true);
    try {
      const atualizado = (await call('apiSave', token, evento.slug, {
        couple: campos.couple,
        date: campos.date,
        city: campos.city,
        state: campos.state,
        venue: campos.venue,
        description: campos.description,
        excerpt: campos.excerpt,
        featured: campos.featured,
        tags: campos.tags,
        draft: campos.draft,
      })) as Evento;
      setEvento(atualizado);
      setCampos({ ...atualizado });
      setTagsTexto(atualizado.tags.join(', '));
      onToast('Dados salvos.');
    } catch (e) {
      setErro(msgErro(e));
    } finally {
      setEnviando(false);
    }
  }

  async function excluir() {
    if (!window.confirm(`Apagar "${evento.slug}" (e pasta de fotos correspondente)?`)) return;
    setErro('');
    try {
      await call('apiDelete', token, evento.slug);
      onToast('Evento apagado.');
      onExcluir();
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h3 className="font-display text-xl">Dados</h3>
      <div className="mt-4 max-w-3xl space-y-4">
        <Campo
          rotulo="Casal"
          valor={campos.couple}
          onChange={(v) => campo('couple', v)}
          max={120}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            rotulo="Data"
            valor={campos.date}
            onChange={(v) => campo('date', v)}
            placeholder="AAAA-MM-DD"
          />
          <Campo
            rotulo="Cidade *"
            valor={campos.city}
            onChange={(v) => campo('city', v)}
            max={80}
          />
          <Campo
            rotulo="Estado *"
            valor={campos.state}
            onChange={(v) => campo('state', v)}
            max={40}
          />
        </div>
        <Campo rotulo="Local" valor={campos.venue} onChange={(v) => campo('venue', v)} max={120} />
        <Campo
          rotulo="Descrição"
          valor={campos.description}
          onChange={(v) => campo('description', v)}
          textarea
          max={5000}
        />
        <Campo
          rotulo="Resumo (máx. 220)"
          valor={campos.excerpt}
          onChange={(v) => campo('excerpt', v)}
          textarea
          max={220}
        />
        <Campo
          rotulo="Tags (separadas por vírgula)"
          valor={tagsTexto}
          onChange={(v) => {
            setTagsTexto(v);
            campo(
              'tags',
              v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            );
          }}
        />

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={campos.featured}
              onChange={(e) => campo('featured', e.target.checked)}
              className="size-4"
            />
            Destaque
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={campos.draft}
              onChange={(e) => campo('draft', e.target.checked)}
              className="size-4"
            />
            Rascunho (noindex, fora do sitemap)
          </label>
        </div>

        {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

        <div className="flex gap-2">
          <button
            onClick={salvar}
            disabled={enviando}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
          >
            {enviando ? 'Salvando…' : 'Salvar dados'}
          </button>
          <button
            onClick={excluir}
            className="rounded-lg border border-line px-4 py-2 text-sm text-red-600 hover:border-red-400"
          >
            Excluir
          </button>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- fotos */

function Fotos({
  token,
  slug,
  evento,
  arquivos,
  setEvento,
  setArquivos,
  minGallery,
  onToast,
}: {
  token: string;
  slug: string;
  evento: Evento;
  arquivos: ArquivosEvento;
  setEvento: (e: Evento) => void;
  setArquivos: (a: ArquivosEvento) => void;
  minGallery: number;
  onToast: (m: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fotos = arquivos.photos;

  async function enviar(files: FileList | null) {
    if (!files || files.length === 0) return;
    setEnviando(true);
    setErro('');
    try {
      for (const file of Array.from(files)) {
        const base64 = await redimensionar(file);
        const list = (await call('apiUploadPhoto', token, slug, {
          data: base64,
          name: file.name,
          type: file.type,
          clientId: `${file.name}@${file.size}@${file.lastModified}`,
        })) as ArquivosEvento;
        setArquivos(list || { cover: null, photos: [] });
      }
      onToast('Fotos enviadas.');
      const ev = (await call('apiGet', token, slug)) as Evento;
      setEvento(ev);
    } catch (e) {
      setErro(msgErro(e));
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function definirCapa(name: string) {
    setErro('');
    try {
      const list = (await call('apiSetCover', token, slug, name)) as ArquivosEvento;
      setArquivos(list || { cover: null, photos: [] });
      onToast('Capa atualizada.');
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  async function remover(name: string) {
    if (!window.confirm(`Remover ${name}?`)) return;
    setErro('');
    try {
      const list = (await call('apiRemovePhoto', token, slug, name)) as ArquivosEvento;
      setArquivos(list || { cover: null, photos: [] });
      onToast('Foto removida.');
      const ev = (await call('apiGet', token, slug)) as Evento;
      setEvento(ev);
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  const faltando = Math.max(0, minGallery - fotos.length);

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl">Fotos</h3>
          <p className="text-sm text-muted">
            {fotos.length} enviada(s)
            {faltando > 0
              ? ` · faltam ${faltando} para o mínimo (${minGallery})`
              : ' · mínimo atingido'}
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar fotos'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={(e) => enviar(e.target.files)}
        />
      </div>

      {erro ? <p className="mt-2 text-sm text-red-600">{erro}</p> : null}

      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {fotos.map((f) => (
          <li key={f.name} className="overflow-hidden rounded-lg border border-line bg-background">
            <img
              src={`https://drive.google.com/thumbnail?id=${f.id}&sz=w320`}
              alt={f.name}
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
            <div className="space-y-1 p-2">
              <p className="truncate text-xs text-ink">{f.name}</p>
              {arquivos.cover?.name === f.name ? (
                <p className="text-xs font-semibold text-accent">★ capa</p>
              ) : (
                <button
                  onClick={() => definirCapa(f.name)}
                  className="w-full rounded border border-line px-2 py-0.5 text-xs hover:border-accent hover:text-accent"
                >
                  Usar como capa
                </button>
              )}
              <button
                onClick={() => remover(f.name)}
                className="w-full rounded border border-line px-2 py-0.5 text-xs text-red-600 hover:border-red-400"
              >
                Remover
              </button>
            </div>
          </li>
        ))}
        {fotos.length === 0 ? (
          <li className="col-span-4 rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
            Nenhuma foto ainda.
          </li>
        ) : null}
      </ul>

      {evento.missed?.filter((m) => m.startsWith('gallery')).length ? (
        <p className="mt-2 text-sm text-muted">
          {evento.missed.filter((m) => m.startsWith('gallery')).join(' · ')}
        </p>
      ) : null}
    </section>
  );
}

/** Redimensiona para ~2400 px e devolve base64 (o servidor revalida tudo). */
function redimensionar(file: File, max = 2400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * escala));
      const h = Math.max(1, Math.round(img.height * escala));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas indisponível neste navegador.'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao redimensionar a imagem.'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('Falha ao ler a imagem em base64.'));
          reader.readAsDataURL(blob);
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem inválida.'));
    };
    img.src = url;
  });
}

/* -------------------------------------------------------------- automação */

/**
 * Checklist renderizado a partir dos dados **salvos** (`evento`), não do
 * rascunho: nunca pode mentir sobre o que está gravado na planilha.
 */
function Automacao({
  token,
  slug,
  evento,
  setEvento,
  onToast,
}: {
  token: string;
  slug: string;
  evento: Evento;
  setEvento: (e: Evento) => void;
  onToast: (m: string) => void;
}) {
  const [check, setCheck] = useState<Checklist | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function verificar() {
    setErro('');
    try {
      setCheck((await call('apiChecklist', token, slug)) as Checklist);
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  async function verPreview() {
    setErro('');
    try {
      const pub = await call('apiPublication', token, slug);
      setPreview(JSON.stringify(pub, null, 2));
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  async function publicar() {
    if (!window.confirm('Disparar a automação no GitHub (publica o site) agora?')) return;
    setEnviando(true);
    setErro('');
    try {
      await call('apiPublish', token, slug);
      setEvento((await call('apiGet', token, slug)) as Evento);
      await verificar();
      onToast('Automação disparada.');
    } catch (e) {
      setErro(msgErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h3 className="font-display text-xl">Automação</h3>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={verificar}
          className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent"
        >
          Verificar prontidão
        </button>
        <button
          onClick={verPreview}
          className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent"
        >
          Preview do JSON
        </button>
        <button
          onClick={publicar}
          disabled={enviando || check?.status !== 'ready'}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {enviando ? 'Publicando…' : 'Executar automação'}
        </button>
      </div>

      {erro ? <p className="mt-2 text-sm text-red-600">{erro}</p> : null}

      {check ? (
        <div className="mt-3">
          <p className="text-sm font-medium">
            {check.status === 'ready' ? '✓ Pronto para publicar.' : 'Falta preencher:'}
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-muted">
            {check.missed.length ? (
              check.missed.map((m) => <li key={m}>{m}</li>)
            ) : (
              <li>Nenhuma pendência.</li>
            )}
          </ul>
        </div>
      ) : null}

      {preview ? (
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-line bg-background p-3 text-xs text-ink">
          {preview}
        </pre>
      ) : null}

      {evento.draft ? (
        <p className="mt-3 text-sm text-muted">
          Evento é rascunho: sai noindex e fora do sitemap até desmarcar a opção.
        </p>
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------------- helpers */

function Campo({
  rotulo,
  valor,
  onChange,
  max,
  textarea,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  max?: number;
  textarea?: boolean;
  placeholder?: string;
}) {
  const cls =
    'mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-ink outline-none focus:border-accent';
  return (
    <label className="block text-sm font-medium text-ink">
      {rotulo}
      {textarea ? (
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value.slice(0, max || 5000))}
          rows={4}
          placeholder={placeholder}
          className={cls}
        />
      ) : (
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value.slice(0, max || 5000))}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}
