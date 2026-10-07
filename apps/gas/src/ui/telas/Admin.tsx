import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { call, limparToken, tokenAtual } from '../lib/gas';
import type { Config } from '../lib/tipos';
import { Carregando, Toast } from './ui';
import { Lista } from './Lista';
import { Criar } from './Criar';
import { Editar } from './Editar';

type Tela = { nome: 'lista' } | { nome: 'criar' } | { nome: 'editar'; slug: string };

export function Admin() {
  const navigate = useNavigate();
  const token = tokenAtual();
  const [pronto, setPronto] = useState(false);
  const [email, setEmail] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [tela, setTela] = useState<Tela>({ nome: 'lista' });
  const [toast, setToast] = useState('');
  const [falha, setFalha] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const st = await call('apiAuthStatus', token);
        if (!vivo) return;
        if (!st.authenticated) {
          limparToken();
          navigate({ to: '/login' });
          return;
        }
        setEmail(st.email);
        const cfg = await call('apiConfig', token);
        if (vivo) setConfig(cfg);
      } catch (e) {
        if (!vivo) return;
        limparToken();
        navigate({ to: '/login' });
        return;
      }
      if (vivo) setPronto(true);
    })();
    return () => {
      vivo = false;
    };
  }, [token, navigate]);

  function avisar(mensagem: string) {
    setToast(mensagem);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3600);
  }

  function sair() {
    call('apiLogout', token).catch(() => undefined);
    limparToken();
    navigate({ to: '/login' });
  }

  if (falha) return <PainelFalha mensagem={falha} />;
  if (!pronto) return <Carregando />;

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="font-display text-xl">Casamentos</span>
          <span className="hidden text-xs text-muted sm:inline">controle de publicação</span>
          <span className="ml-auto hidden text-xs text-muted md:inline">{email}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTela({ nome: 'lista' })}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
            >
              Lista
            </button>
            <button
              onClick={() => setTela({ nome: 'criar' })}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-strong"
            >
              + Novo evento
            </button>
            <button
              onClick={sair}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {tela.nome === 'lista' ? (
          <Lista
            token={token}
            onAbrir={(slug) => setTela({ nome: 'editar', slug })}
            onToast={avisar}
          />
        ) : tela.nome === 'criar' ? (
          <Criar
            token={token}
            onCriado={(slug) => setTela({ nome: 'editar', slug })}
            onVoltar={() => setTela({ nome: 'lista' })}
            onToast={avisar}
          />
        ) : (
          <Editar
            token={token}
            slug={tela.slug}
            minGallery={config?.minGallery ?? 8}
            onVoltar={() => setTela({ nome: 'lista' })}
            onToast={avisar}
          />
        )}
      </main>

      <Toast mensagem={toast} />
    </div>
  );
}

function PainelFalha({ mensagem }: { mensagem: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <p className="max-w-md text-sm text-red-600">{mensagem}</p>
    </div>
  );
}
