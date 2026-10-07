/**
 * Ponto de entrada dos testes do servidor: transpila e roda o bundle num `vm`
 * com mocks do Apps Script — o mesmo artefato (e as mesmas regras: nada de
 * import/export de topo) que o `vite-gas.ts` sobe.
 */
import { filesToBundleJs, vmRun } from './rodar';
import type { Context } from './rodar';

export function contexto(): Context {
  return vmRun(filesToBundleJs());
}

export { filesToBundleJs, vmRun };
export type { Context };
