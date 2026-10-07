import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import './styles/global.css';

// Em memória (§10.1): o painel vive dentro do iframe do HtmlService, cuja URL
// real é sempre a do Web App (`/exec`). Com history do browser, um F5 cairia
// em 404 no doGet.
const router = createRouter({
  routeTree,
  defaultPreload: false,
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

const root = document.getElementById('root');
if (!root) throw new Error('root não encontrado');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
