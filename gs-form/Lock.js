/**
 * Wrapper do `LockService`.
 *
 * Quase toda escrita na planilha é *read-modify-write*: `Events.setRow_` lê a
 * tabela inteira, aplica um patch e regrava a linha. Sem um lock, dois uploads
 * simultâneos (duas abas do painel, ou o clique em "Publicar" enquanto a fila
 * de fotos ainda corre) partem do mesmo snapshot e **um dos dois patches se
 * perde** — a foto some da galeria sem erro nenhum. Como os arquivos já
 * ficaram no Drive, o resultado é um casamento publicado sem uma foto que o
 * painel mostra ter enviado.
 */
const Lock = {
  /**
   * Executa `fn` com o lock de script. Lança se outro processamento ainda
   * estiver escrevendo depois de `timeoutMs`.
   */
  withScriptLock_(fn, timeoutMs) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(timeoutMs || 30000)) {
      throw new Error('Outro processo ainda está gravando. Tente de novo em alguns segundos.');
    }
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  },
};
