// ============================================================
// Centro Clínico GS — Apps Script Backend
// Deploy como Web App: Execute as "Me", Access "Anyone"
// ============================================================

const SHEET_LANCAMENTOS   = 'Lancamentos';
const SHEET_DENTISTAS     = 'Dentistas';
const SHEET_CONVENIOS     = 'Convenios';
const SHEET_PROCEDIMENTOS = 'Procedimentos';

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    switch (action) {
      case 'getDentistas':      result = getDentistas();                                        break;
      case 'addDentista':       result = addDentista(e.parameter.nome);                        break;
      case 'deleteDentista':    result = deleteDentista(e.parameter.id);                      break;
      case 'getConvenios':      result = getConvenios();                                       break;
      case 'addConvenio':       result = addConvenio(e.parameter.nome);                       break;
      case 'deleteConvenio':    result = deleteConvenio(e.parameter.id);                      break;
      case 'getProcedimentos':  result = getProcedimentos();                                   break;
      case 'addProcedimento':   result = addProcedimento(e.parameter.nome);                   break;
      case 'addLancamento':     result = addLancamento(JSON.parse(e.parameter.data));         break;
      case 'getLancamentos':    result = getLancamentos();                                     break;
      case 'updateGlosa':       result = updateGlosa(e.parameter.row, e.parameter.glosado);   break;
      case 'deleteLancamento':  result = deleteLancamento(e.parameter.row);                   break;
      case 'updateRepasse':     result = updateRepasse(e.parameter.row, e.parameter.repasse); break;
      default:                  result = { error: 'Ação inválida' };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Helpers ──────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === SHEET_LANCAMENTOS)
      sheet.appendRow(['ID','Data','Dentista','Paciente','Procedimento','Tipo','Convenio','Valor','Repasse','Timestamp','Glosado','Dente']);
    else if (name === SHEET_DENTISTAS)
      sheet.appendRow(['ID','Nome','Ativo']);
    else if (name === SHEET_CONVENIOS)
      sheet.appendRow(['ID','Nome','Ativo']);
    else if (name === SHEET_PROCEDIMENTOS)
      sheet.appendRow(['ID','Nome','Ativo']);
  }
  return sheet;
}

function uid() { return new Date().getTime().toString(); }

// ── Dentistas ─────────────────────────────────────────────────

function getDentistas() {
  const data = getSheet(SHEET_DENTISTAS).getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++)
    if (String(data[i][2]).toUpperCase() === 'TRUE' || data[i][2] === true)
      list.push({ id: data[i][0], nome: data[i][1] });
  return { success: true, data: list };
}

function addDentista(nome) {
  if (!nome || !nome.trim()) return { error: 'Nome obrigatório' };
  const id = uid();
  getSheet(SHEET_DENTISTAS).appendRow([id, nome.trim(), true]);
  return { success: true, id, nome: nome.trim() };
}

function deleteDentista(id) {
  const sheet = getSheet(SHEET_DENTISTAS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 3).setValue(false);
      return { success: true };
    }
  }
  return { error: 'Dentista não encontrado' };
}

// ── Convênios ─────────────────────────────────────────────────

function getConvenios() {
  const data = getSheet(SHEET_CONVENIOS).getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++)
    if (String(data[i][2]).toUpperCase() === 'TRUE' || data[i][2] === true)
      list.push({ id: data[i][0], nome: data[i][1] });
  return { success: true, data: list };
}

function addConvenio(nome) {
  if (!nome || !nome.trim()) return { error: 'Nome obrigatório' };
  const id = uid();
  getSheet(SHEET_CONVENIOS).appendRow([id, nome.trim(), true]);
  return { success: true, id, nome: nome.trim() };
}

function deleteConvenio(id) {
  const sheet = getSheet(SHEET_CONVENIOS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 3).setValue(false);
      return { success: true };
    }
  }
  return { error: 'Convênio não encontrado' };
}

// ── Procedimentos customizados ────────────────────────────────

function getProcedimentos() {
  const sheet = getSheet(SHEET_PROCEDIMENTOS);
  const data  = sheet.getDataRange().getValues();
  const list  = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] !== false && String(data[i][2]).toUpperCase() !== 'FALSE')
      list.push({ id: String(data[i][0]), nome: String(data[i][1]) });
  }
  return { success: true, data: list };
}

function addProcedimento(nome) {
  if (!nome || !nome.trim()) return { error: 'Nome obrigatório' };
  const id = uid();
  getSheet(SHEET_PROCEDIMENTOS).appendRow([id, nome.trim(), true]);
  return { success: true, id, nome: nome.trim() };
}

// ── Lançamentos ───────────────────────────────────────────────

function fmtDate(v) {
  try {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var dt = new Date(s);
    if (!isNaN(dt.getTime()))
      return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return s.slice(0, 10);
  }
}

function addLancamento(l) {
  const id = uid();
  getSheet(SHEET_LANCAMENTOS).appendRow([
    id, l.data, l.dentista, l.paciente, l.procedimento,
    l.tipo, l.convenio || '', Number(l.valor), Number(l.repasse),
    new Date().toISOString(), false, l.dente || ''
  ]);
  return { success: true, id };
}

function getLancamentos() {
  const data = getSheet(SHEET_LANCAMENTOS).getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const d = data[i];
    list.push({
      id:           String(d[0]),
      row:          i + 1,          // número real da linha no Sheets (para operações diretas)
      data:         fmtDate(d[1]),
      dentista:     String(d[2] || ''),
      paciente:     String(d[3] || ''),
      procedimento: String(d[4] || ''),
      tipo:         String(d[5] || ''),
      convenio:     String(d[6] || ''),
      valor:        Number(d[7]),
      repasse:      Number(d[8]),
      timestamp:    String(d[9] || ''),
      glosado:      d[10] === true || String(d[10]).toUpperCase() === 'TRUE',
      dente:        String(d[11] || '')
    });
  }
  return { success: true, data: list };
}

// Operações usam número da linha diretamente — imune a IDs duplicados

function updateGlosa(row, glosado) {
  try {
    const sheet = getSheet(SHEET_LANCAMENTOS);
    sheet.getRange(parseInt(row), 11).setValue(glosado === 'true' || glosado === true);
    SpreadsheetApp.flush();
    return { success: true };
  } catch(err) {
    return { error: 'Erro ao atualizar glosa: ' + err.toString() };
  }
}

function deleteLancamento(row) {
  try {
    getSheet(SHEET_LANCAMENTOS).deleteRow(parseInt(row));
    return { success: true };
  } catch(err) {
    return { error: 'Erro ao excluir: ' + err.toString() };
  }
}

function updateRepasse(row, repasse) {
  try {
    const sheet = getSheet(SHEET_LANCAMENTOS);
    sheet.getRange(parseInt(row), 9).setValue(Number(repasse));
    SpreadsheetApp.flush();
    return { success: true };
  } catch(err) {
    return { error: 'Erro ao salvar repasse: ' + err.toString() };
  }
}
