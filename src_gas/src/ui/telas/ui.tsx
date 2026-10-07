import type { ReactNode } from 'react';

export function Badge({
  children,
  tom = 'neutro',
}: {
  children: ReactNode;
  tom?: 'neutro' | 'bom' | 'alerta';
}) {
  const cor =
    tom === 'bom'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tom === 'alerta'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-line bg-background text-muted';
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${cor}`}>{children}</span>;
}

export function formatarData(d: string): string {
  if (!d) return 'sem data';
  const parsed = new Date(d + 'T12:00:00');
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString('pt-BR');
}

export function msgErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Falha na automação.';
}

export function Carregando() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-sm text-muted">
      Carregando…
    </div>
  );
}

export function Falha({ mensagem }: { mensagem: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <p className="max-w-md text-sm text-red-600">{mensagem}</p>
    </div>
  );
}

export function Toast({ mensagem }: { mensagem: string }) {
  if (!mensagem) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
      {mensagem}
    </div>
  );
}
