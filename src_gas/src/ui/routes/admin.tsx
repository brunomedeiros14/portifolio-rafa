import { createFileRoute, redirect } from '@tanstack/react-router';
import { tokenAtual } from '../lib/gas';
import { Admin } from '../telas/Admin';

export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    if (!tokenAtual()) throw redirect({ to: '/login' });
  },
  component: Admin,
});
