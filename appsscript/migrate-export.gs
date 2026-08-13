// ============================================================
// Script ONE-OFF de exportação — rodar uma única vez no editor
// do Apps Script (função exportAllData), para gerar o JSON usado
// pelo scripts/migrate-import.mjs na migração para o Supabase.
//
// Como usar:
// 1. Abra o Apps Script do projeto (Extensões → Apps Script)
// 2. Cole este arquivo como um novo arquivo .gs (ou cole o conteúdo
//    dentro do Code.gs temporariamente)
// 3. Selecione a função "exportAllData" no seletor de funções e clique em Executar
// 4. Autorize o acesso ao Google Drive se solicitado
// 5. Veja o log (Ver → Registros de execução) — ele mostra o link
//    do arquivo gerado no seu Google Drive ("migracao-centrogs-raw.json")
// 6. Baixe esse arquivo e coloque na pasta scripts/ (mesma do migrate-import.mjs)
// ============================================================

function serialize(v) {
  if (v && typeof v.getFullYear === 'function') return v.toISOString();
  if (v === null || v === undefined) return '';
  return v;
}

// Exporta os dados BRUTOS (array de arrays), preservando 100% das colunas
// mesmo que o cabeçalho da planilha esteja desalinhado ou incompleto —
// não confia no texto do cabeçalho, só na posição real das colunas.
function exportAllData() {
  try {
    const sheets = ['Lancamentos', 'Dentistas', 'Convenios', 'Procedimentos', 'Estoque', 'Metas'];
    const out = {};

    sheets.forEach(name => {
      Logger.log('Lendo aba: ' + name);
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
      if (!sheet) { out[name] = { headers: [], rows: [] }; Logger.log(name + ': aba não encontrada'); return; }
      const values = sheet.getDataRange().getValues();
      Logger.log(name + ': ' + values.length + ' linhas brutas (incl. cabeçalho)');
      if (values.length < 1) { out[name] = { headers: [], rows: [] }; return; }

      const headers = values[0].map(h => String(h).trim());
      const rows = values.slice(1).map(r => r.map(serialize));
      out[name] = { headers: headers, rows: rows };
    });

    Logger.log('Gerando JSON...');
    const json = JSON.stringify(out);
    Logger.log('Tamanho do JSON: ' + json.length + ' caracteres');

    const file = DriveApp.createFile('migracao-centrogs-raw.json', json, MimeType.PLAIN_TEXT);
    Logger.log('Arquivo gerado: ' + file.getUrl());
  } catch (err) {
    Logger.log('ERRO: ' + err.message);
    Logger.log('STACK: ' + err.stack);
  }
}
