import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { call, salvarToken } from '../lib/gas';
import { Login } from '../telas/Login';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [semSenha, setSemSenha] = useState(false);

  useEffect(() => {
    let vivo = true;
    call('apiAuthStatus', '')
      .then((st) => {
        if (vivo) setSemSenha(!st.hasPassword);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <Login
      semSenha={semSenha}
      onEntrar={(token) => {
        salvarToken(token);
        navigate({ to: '/admin' });
      }}
    />
  );
}
