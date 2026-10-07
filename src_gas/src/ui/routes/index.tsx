import { createFileRoute, redirect } from '@tanstack/react-router';
import { tokenAtual } from '../lib/gas';

/**
 * O painel vive dentro do iframe do HtmlService, cuja URL real é sempre a do
 * Web App (`/exec`). A navegação é em memória (§10.1): esta rota só decide a
 * tela inicial — com token vai direto ao painel, sem token vai ao login.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: tokenAtual() ? '/admin' : '/login' });
  },
});
