// ============================================================
// Centro Clínico GS — Apps Script Backend
// Deploy como Web App: Execute as "Me", Access "Anyone"
// ============================================================

const SHEET_LANCAMENTOS   = 'Lancamentos';
const SHEET_DENTISTAS     = 'Dentistas';
const SHEET_CONVENIOS     = 'Convenios';
const SHEET_PROCEDIMENTOS = 'Procedimentos';
const SHEET_ESTOQUE       = 'Estoque';
const SHEET_METAS         = 'Metas';

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
      case 'debugDatas':        result = debugDatas();                                         break;
      case 'updateGlosa':       result = updateGlosa(e.parameter.row, e.parameter.glosado);     break;
      case 'updatePendente':    result = updatePendente(e.parameter.row, e.parameter.pendente); break;
      case 'deleteLancamento':  result = deleteLancamento(e.parameter.row);                     break;
      case 'updateRepasse':     result = updateRepasse(e.parameter.row, e.parameter.repasse);   break;
      case 'getMetas':          result = getMetas();                                                                               break;
      case 'saveMeta':          result = saveMeta(e.parameter.mes, e.parameter.dentista, e.parameter.meta, e.parameter.indicacoes, e.parameter.metaValorRS); break;
      case 'deleteMeta':        result = deleteMeta(e.parameter.id);                                                               break;
      case 'getEstoque':        result = getEstoque();                                                                              break;
      case 'addItemEstoque':    result = addItemEstoque(e.parameter.nome, e.parameter.categoria, e.parameter.qtdAtual, e.parameter.qtdMin, e.parameter.unidade); break;
      case 'updateItemEstoque': result = updateItemEstoque(e.parameter.rowIndex, e.parameter.nome, e.parameter.categoria, e.parameter.qtdAtual, e.parameter.qtdMin, e.parameter.unidade); break;
      case 'movimentarEstoque': result = movimentarEstoque(e.parameter.rowIndex, e.parameter.tipo, e.parameter.qtd); break;
      case 'deleteItemEstoque': result = deleteItemEstoque(e.parameter.rowIndex);                                   break;
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
      sheet.appendRow(['ID','Data','Dentista','Paciente','Procedimento','Tipo','Convenio','Valor','Repasse','Timestamp','Glosado','Dente','GTO','Pendente','Meta','Indicacao']);
    else if (name === SHEET_DENTISTAS)
      sheet.appendRow(['ID','Nome','Ativo']);
    else if (name === SHEET_CONVENIOS)
      sheet.appendRow(['ID','Nome','Ativo']);
    else if (name === SHEET_PROCEDIMENTOS)
      sheet.appendRow(['ID','Nome','Ativo']);
    else if (name === SHEET_ESTOQUE)
      sheet.appendRow(['ID','Nome','Categoria','QtdAtual','QtdMin','UltimoReabastecimento','Unidade']);
    else if (name === SHEET_METAS)
      sheet.appendRow(['ID','Mes','Dentista','Meta','Indicacoes','Timestamp','MetaValorRS']);
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

function debugDatas() {
  var sheet = getSheet(SHEET_LANCAMENTOS);
  var data  = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i <= Math.min(10, data.length - 1); i++) {
    var raw = data[i][1];
    result.push({
      row:      i + 1,
      rawType:  typeof raw,
      rawValue: String(raw),
      isDate:   raw instanceof Date,
      fmtd:     fmtDate(raw)
    });
  }
  return { success: true, data: result };
}

function fmtDate(v) {
  // Objeto Date do Sheets (instanceof não funciona no Apps Script, usa getFullYear)
  if (v && typeof v.getFullYear === 'function') {
    return Utilities.formatDate(v, 'America/Sao_Paulo', 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  // Já no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Formato DD/MM/YYYY (lançamentos manuais)
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s.slice(0, 10);
}

function addLancamento(l) {
  const id = uid();
  getSheet(SHEET_LANCAMENTOS).appendRow([
    id, l.data, l.dentista, l.paciente, l.procedimento,
    l.tipo, l.convenio || '', Number(l.valor), Number(l.repasse),
    new Date().toISOString(), false, l.dente || '', l.gto || '', false
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
      dente:        String(d[11] || ''),
      gto:          String(d[12] || ''),
      pendente:     d[13] === true || String(d[13]).toUpperCase() === 'TRUE'
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

function updatePendente(row, pendente) {
  try {
    const sheet = getSheet(SHEET_LANCAMENTOS);
    sheet.getRange(parseInt(row), 14).setValue(pendente === 'true' || pendente === true);
    SpreadsheetApp.flush();
    return { success: true };
  } catch(err) {
    return { error: 'Erro ao atualizar pendente: ' + err.toString() };
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

// ── Metas Mensais ─────────────────────────────────────────────

function getMetas() {
  var sheet = getSheet(SHEET_METAS);
  var data  = sheet.getDataRange().getValues();
  var list  = [];
  for (var i = 1; i < data.length; i++) {
    var d = data[i];
    list.push({
      id:          String(d[0]),
      mes:         String(d[1] || ''),
      dentista:    String(d[2] || ''),
      meta:        String(d[3] || ''),
      indicacoes:  String(d[4] || ''),
      timestamp:   String(d[5] || ''),
      metaValorRS: String(d[6] || '')
    });
  }
  return { success: true, data: list };
}

function saveMeta(mes, dentista, meta, indicacoes, metaValorRS) {
  if (!mes || !dentista) return { error: 'Mês e dentista são obrigatórios' };
  var sheet = getSheet(SHEET_METAS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(mes) && String(data[i][2]) === String(dentista)) {
      sheet.getRange(i + 1, 4).setValue(meta || '');
      sheet.getRange(i + 1, 5).setValue(indicacoes || '');
      sheet.getRange(i + 1, 6).setValue(new Date().toISOString());
      sheet.getRange(i + 1, 7).setValue(metaValorRS || '');
      SpreadsheetApp.flush();
      return { success: true, id: String(data[i][0]), updated: true };
    }
  }
  var id = uid();
  sheet.appendRow([id, mes, dentista, meta || '', indicacoes || '', new Date().toISOString(), metaValorRS || '']);
  return { success: true, id: id, updated: false };
}

function deleteMeta(id) {
  var sheet = getSheet(SHEET_METAS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Registro não encontrado' };
}

// ── Estoque ───────────────────────────────────────────────────

function getEstoque() {
  const sheet = getSheet(SHEET_ESTOQUE);
  const data  = sheet.getDataRange().getValues();
  const list  = [];
  for (var i = 1; i < data.length; i++) {
    var d = data[i];
    list.push({
      _rowIndex:              i + 1,
      id:                     String(d[0]),
      nome:                   String(d[1] || ''),
      categoria:              String(d[2] || ''),
      qtdAtual:               Number(d[3]),
      qtdMin:                 Number(d[4]),
      ultimoReabastecimento:  d[5] ? fmtDate(d[5]) : '',
      unidade:                String(d[6] || 'Unidade')
    });
  }
  return { success: true, data: list };
}

function addItemEstoque(nome, categoria, qtdAtual, qtdMin, unidade) {
  if (!nome || !nome.trim()) return { error: 'Nome obrigatório' };
  var id = uid();
  getSheet(SHEET_ESTOQUE).appendRow([id, nome.trim(), categoria || '', Number(qtdAtual), Number(qtdMin), '', unidade || 'Unidade']);
  return { success: true, id };
}

function updateItemEstoque(rowIndex, nome, categoria, qtdAtual, qtdMin, unidade) {
  try {
    var sheet = getSheet(SHEET_ESTOQUE);
    var row   = parseInt(rowIndex);
    sheet.getRange(row, 2).setValue(nome);
    sheet.getRange(row, 3).setValue(categoria || '');
    sheet.getRange(row, 4).setValue(Number(qtdAtual));
    sheet.getRange(row, 5).setValue(Number(qtdMin));
    sheet.getRange(row, 7).setValue(unidade || 'Unidade');
    SpreadsheetApp.flush();
    return { success: true };
  } catch(err) {
    return { error: 'Erro ao atualizar item: ' + err.toString() };
  }
}

function movimentarEstoque(rowIndex, tipo, qtd) {
  try {
    var sheet    = getSheet(SHEET_ESTOQUE);
    var row      = parseInt(rowIndex);
    var qtdAtual = Number(sheet.getRange(row, 4).getValue());
    var novaQtd  = tipo === 'entrada' ? qtdAtual + Number(qtd) : qtdAtual - Number(qtd);
    if (novaQtd < 0) return { error: 'Quantidade insuficiente em estoque' };
    sheet.getRange(row, 4).setValue(novaQtd);
    if (tipo === 'entrada') sheet.getRange(row, 6).setValue(new Date().toISOString());
    SpreadsheetApp.flush();
    return { success: true, novaQtd: novaQtd };
  } catch(err) {
    return { error: 'Erro ao movimentar: ' + err.toString() };
  }
}

function deleteItemEstoque(rowIndex) {
  try {
    getSheet(SHEET_ESTOQUE).deleteRow(parseInt(rowIndex));
    return { success: true };
  } catch(err) {
    return { error: 'Erro ao excluir: ' + err.toString() };
  }
}
