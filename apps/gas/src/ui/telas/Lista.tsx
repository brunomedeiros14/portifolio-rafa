import { useEffect, useState } from 'react';
import { call } from '../lib/gas';
import type { Evento } from '../lib/tipos';
import { Badge, Carregando, formatarData, msgErro } from './ui';

export function Lista({
  token,
  onAbrir,
  onToast,
}: {
  token: string;
  onAbrir: (slug: string) => void;
  onToast: (mensagem: string) => void;
}) {
  const [lista, setLista] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    call('apiList', token)
      .then((eventos) => {
        if (vivo) setLista(eventos as Evento[]);
      })
      .catch((e) => {
        if (vivo) setErro(msgErro(e));
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  if (erro) return <p className="text-sm text-red-600">{erro}</p>;
  if (!lista) return <Carregando />;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {lista.map((ev) => (
        <li key={ev.slug} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-ink">
                {ev.featured ? (
                  <span className="text-accent" aria-hidden="true">
                    ★{' '}
                  </span>
                ) : null}
                {ev.couple}
              </p>
              <p className="text-xs text-muted">
                {ev.slug} · {formatarData(ev.date)}
                {ev.city ? ` · ${ev.city}` : ''}
                {ev.state ? `/${ev.state}` : ''}
              </p>
            </div>
            <span className="flex shrink-0 gap-1">
              <Badge tom={ev.status === 'published' ? 'bom' : 'neutro'}>
                {ev.status === 'published' ? 'publicado' : 'não publicado'}
              </Badge>
              {ev.ready === 'ready' ? (
                <Badge tom="bom">pronto</Badge>
              ) : (
                <Badge tom="alerta">incompleto</Badge>
              )}
              {ev.draft ? <Badge tom="alerta">rascunho</Badge> : null}
            </span>
          </div>

          {ev.missed && ev.missed.length > 0 ? (
            <p className="mt-2 text-xs text-muted">Falta: {ev.missed.join(' · ')}</p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onAbrir(ev.slug)}
              className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
            >
              Editar
            </button>
            <button
              onClick={() => onAbrir(ev.slug)}
              className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
            >
              Publicar
            </button>
          </div>
        </li>
      ))}
      {lista.length === 0 ? (
        <li className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Nenhum casamento cadastrado ainda — use “+ Novo evento”.
        </li>
      ) : null}
    </ul>
  );
}
