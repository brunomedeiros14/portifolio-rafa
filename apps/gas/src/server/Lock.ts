/**
 * Wrapper do `LockService`.
 *
 * Quase toda escrita na planilha é *read-modify-write*: `Events.setRow_` lê a
 * tabela inteira, aplica um patch e regrava a linha. Sem lock, dois uploads
 * simultâneos (duas abas do painel, ou o clique em "Publicar" enquanto a fila
 * de fotos ainda corre) partem do mesmo snapshot e um dos patches se perde —
 * a foto some da galeria sem erro nenhum. Como o arquivo já ficou no Drive, o
 * resultado é um casamento publicado sem uma foto que o painel mostra enviada.
 */
const Lock = {
  /**
   * Executa `fn` com o lock de **script** — cobrem qualquer escrita na
   * planilha do painel (create, update, foto, capa, status).
   */
  withScriptLock_(fn, timeoutMs?) {
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

  /**
   * Executa `fn` com o lock de **documento** — para provisioning (criar a
   * planilha/pasta) e os reparos do Tools, que não é por linha da planilha.
   *
   * O projeto é **standalone** (a planilha é criada pelo próprio script): o
   * `getDocumentLock()` não existe fora de um script com container e resolve
   * para `null`, o que quebraria o `tryLock`. Document lock só é interessante
   * em script vinculado a um documento; aqui caímos no lock de script quando o
   * de documento não está disponível.
   */
  withDocumentLock_(fn, timeoutMs?) {
    const lock = LockService.getDocumentLock() || LockService.getScriptLock();
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
