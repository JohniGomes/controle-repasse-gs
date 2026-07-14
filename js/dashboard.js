// ============================================================
// Lógica do Dashboard
// ============================================================

let allLancamentos = [];
let filteredLancamentos = [];
let dentistasDB = [];
let conveniosDB = [];
let chartInstances = {};
let allMetas = [];
const repasseEdits = new Map(); // _uid → valor editado pelo usuário

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  showLoader(true);
  await loadAllData();
  populateFiltersFromData();
  setDefaultFilters();
  applyFilters();
  showLoader(false);
});

// ── Carregamento de dados (1 única chamada) ───────────────────
async function loadAllData() {
  try {
    const [resL, resM] = await Promise.all([
      apiCall({ action: 'getLancamentos' }),
      apiCall({ action: 'getMetas' })
    ]);
    if (resL.error) { showToast('Erro: ' + resL.error, 'error'); return; }
    allLancamentos = (resL.data || []).map((l, i) => ({
      ...l,
      _uid: i,
      data: normalizeDate(l.data, l.timestamp)
    }));
    allMetas = resM.data || [];
  } catch (e) {
    showToast('Erro de conexão: ' + (e.message || e), 'error');
  }
}

function normalizeDate(val, fallbackTimestamp) {
  // Usa a data do lançamento (val) como prioridade
  const s = String(val || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Só usa o timestamp se a data for inválida/vazia
  if (fallbackTimestamp) {
    const ts = String(fallbackTimestamp).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(ts)) return ts;
  }
  return '';
}

// Popula filtros de dentista e convênio direto dos dados carregados
function populateFiltersFromData() {
  const dentistas = [...new Set(allLancamentos.map(l => l.dentista).filter(Boolean))].sort();
  const dSel = document.getElementById('filterDentista');
  dentistas.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d; dSel.appendChild(o);
  });

  // Filtro de tipo é fixo (Particular / Convênio) — não popula dinamicamente
}

// ── Filtros ───────────────────────────────────────────────────
function setDefaultFilters() {
  const now   = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  document.getElementById('filterMonth').value = `${now.getFullYear()}-${month}`;
  switchPeriod('month');
}

function switchPeriod(type) {
  document.querySelectorAll('.period-tab').forEach(t => t.classList.toggle('active', t.dataset.type === type));
  document.getElementById('periodMonth').style.display      = type === 'month'      ? '' : 'none';
  document.getElementById('periodYear').style.display       = type === 'year'       ? '' : 'none';
  document.getElementById('periodCustom').style.display     = type === 'custom'     ? '' : 'none';
  document.getElementById('periodReferencia').style.display = type === 'referencia' ? '' : 'none';
}

function applyFilters() {
  const dentista     = document.getElementById('filterDentista').value;
  const procedimento = document.getElementById('filterProcedimento').value;
  const convenio     = document.getElementById('filterConvenio').value;
  const activePeriod = document.querySelector('.period-tab.active')?.dataset.type || 'month';
  const m            = document.getElementById('filterMonth').value;

  const search = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

  filteredLancamentos = allLancamentos.filter(l => {
    if (dentista     && l.dentista.trim()     !== dentista.trim())     return false;
    if (procedimento && l.procedimento.trim() !== procedimento.trim()) return false;
    if (convenio     && l.tipo.trim()         !== convenio.trim())     return false;
    if (search) {
      const hay = [l.dentista, l.paciente, l.procedimento, l.convenio, l.tipo, l.dente, l.gto, String(l.valor)]
        .join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }

    const d = String(l.data).slice(0, 10);
    if (activePeriod === 'month') {
      if (m && !d.startsWith(m)) return false;
    } else if (activePeriod === 'year') {
      const y = document.getElementById('filterYear').value;
      if (y && !d.startsWith(y)) return false;
    } else if (activePeriod === 'referencia') {
      const ref = document.getElementById('filterRefMonth').value; // YYYY-MM
      if (ref) {
        const [ry, rm] = ref.split('-').map(Number);
        // Particular → mês anterior (M-1)
        const pm = rm === 1 ? 12 : rm - 1;
        const py = rm === 1 ? ry - 1 : ry;
        const partPrefix = `${py}-${String(pm).padStart(2,'0')}`;
        // Convênio → 2 meses atrás (M-2)
        const cm = rm <= 2 ? rm + 10 : rm - 2;
        const cy = rm <= 2 ? ry - 1  : ry;
        const convPrefix = `${cy}-${String(cm).padStart(2,'0')}`;
        if ((l.tipo === 'Particular' || l.tipo === 'Rascunho') && !d.startsWith(partPrefix)) return false;
        if (l.tipo === 'Convênio' && !d.startsWith(convPrefix)) return false;
      }
    } else {
      const from = document.getElementById('filterFrom').value;
      const to   = document.getElementById('filterTo').value;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
    }
    return true;
  });

  renderSummary();
  renderTable();
  renderCharts();
}

function clearFilters() {
  document.getElementById('filterDentista').value    = '';
  document.getElementById('filterProcedimento').value = '';
  document.getElementById('filterConvenio').value    = '';
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value   = '';
  setDefaultFilters();
  applyFilters();
}

// ── Summary cards ─────────────────────────────────────────────
function renderSummary() {
  const glosadosAtivos = filteredLancamentos.filter(l =>  l.glosado && !l.estornado);
  const estornados     = filteredLancamentos.filter(l =>  l.estornado);
  const pendentes      = filteredLancamentos.filter(l => !l.glosado && l.pendente);
  // ativos = não glosados + estornados (estornado recebe repasse)
  const ativos = filteredLancamentos.filter(l => (!l.glosado || l.estornado) && !l.pendente);
  const totalVal   = ativos.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const totalRep   = ativos.reduce((s, l) => s + getRepasse(l), 0);
  const totalGlosa = glosadosAtivos.reduce((s, l) => s + (Number(l.repasse) || 0), 0);

  let sub = [];
  if (glosadosAtivos.length) sub.push(`${glosadosAtivos.length} glosado${glosadosAtivos.length > 1 ? 's' : ''}`);
  if (estornados.length)     sub.push(`${estornados.length} estorno${estornados.length > 1 ? 's' : ''}`);
  if (pendentes.length)      sub.push(`${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}`);

  document.getElementById('summaryQtd').textContent =
    filteredLancamentos.length + (sub.length ? ` (${sub.join(', ')})` : '');
  document.getElementById('summaryValor').textContent   = formatCurrency(totalVal);
  document.getElementById('summaryRepasse').textContent = formatCurrency(totalRep);
  document.getElementById('summaryGlosa').textContent   = formatCurrency(totalGlosa);
  document.getElementById('summaryGlosaSub').textContent =
    glosadosAtivos.length
      ? `${glosadosAtivos.length} glosado${glosadosAtivos.length > 1 ? 's' : ''}${estornados.length ? ` · ${estornados.length} estornado${estornados.length > 1 ? 's' : ''}` : ''}`
      : estornados.length ? `${estornados.length} estorno${estornados.length > 1 ? 's' : ''} de glosa` : 'nenhum glosado';

  // Metas do período filtrado
  const metaInfo   = document.getElementById('summaryMetaInfo');
  const dentFiltro = document.getElementById('filterDentista').value;
  const mesesAtivos = new Set(filteredLancamentos.map(l => String(l.data).slice(0,7)));

  const metasRel = allMetas.filter(m =>
    mesesAtivos.has(m.mes) && (!dentFiltro || m.dentista === dentFiltro)
  );

  if (!metasRel.length) { metaInfo.innerHTML = ''; return; }

  const rowStyle = 'display:flex;justify-content:space-between;align-items:center;gap:.5rem;font-size:.72rem;margin-top:.25rem';

  metaInfo.innerHTML = metasRel.map(m => {
    // Realizado: particulares do mesmo mês+dentista dentro dos lançamentos filtrados
    const realizados = filteredLancamentos.filter(l =>
      !l.glosado && !l.pendente &&
      l.tipo === 'Particular' &&
      l.dentista === m.dentista &&
      String(l.data).slice(0,7) === m.mes
    ).length;

    const metaNum = parseInt(m.meta) || 0;
    const indNum  = parseInt(m.indicacoes) || 0;
    const pct     = metaNum > 0 ? Math.min(100, Math.round(realizados / metaNum * 100)) : null;
    const cor     = pct === null ? 'var(--text-muted)' : pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';

    return `
      <div style="border-top:1px solid var(--border);padding-top:.4rem;margin-top:.3rem">
        <span style="font-size:.71rem;font-weight:700;color:var(--primary)">${m.dentista} — ${formatMesDash(m.mes)}</span>
        ${metaNum ? `
        <div style="${rowStyle}">
          <span style="color:var(--text-muted)">Particulares:</span>
          <span style="font-weight:700;color:${cor}">${realizados} / ${metaNum}${pct !== null ? ` <span style="font-size:.68rem">(${pct}%)</span>` : ''}</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:4px;margin-top:.2rem;overflow:hidden">
          <div style="height:100%;width:${pct ?? 0}%;background:${cor};border-radius:4px;transition:width .4s"></div>
        </div>` : ''}
        ${indNum ? `
        <div style="${rowStyle};margin-top:.3rem">
          <span style="color:var(--text-muted)">Indicações meta:</span>
          <span style="font-weight:700;color:var(--primary)">${indNum}</span>
        </div>` : ''}
        ${m.metaValorRS ? `
        <div style="${rowStyle};margin-top:.3rem">
          <span style="color:var(--text-muted)">Meta valor:</span>
          <span style="font-weight:700;color:var(--primary)">${formatCurrency(m.metaValorRS)}</span>
        </div>` : ''}
      </div>`;
  }).join('');
}

function formatMesDash(mes) {
  if (!mes || !mes.includes('-')) return mes;
  const [y, m] = mes.split('-');
  const n = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${n[parseInt(m)-1]}/${y}`;
}

// ── Tabela ────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('dashboardBody');
  if (!filteredLancamentos.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><p>Nenhum lançamento encontrado para os filtros selecionados.</p></div></td></tr>';
    return;
  }
  const sorted = [...filteredLancamentos].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  tbody.innerHTML = sorted.map(l => {
    const isConvenio   = l.tipo === 'Convênio';
    const isParticular = l.tipo === 'Particular';
    const isRascunho   = l.tipo === 'Rascunho';

    let repasseCell;
    if (l.estornado) {
      const de = l.dataEstorno ? ` · ${formatDate(l.dataEstorno)}` : '';
      repasseCell = `<span style="white-space:nowrap"><span style="color:#7c3aed;font-weight:700">${formatCurrency(getRepasse(l))}</span> <span style="display:inline-block;padding:.18rem .5rem;border-radius:20px;font-size:.68rem;font-weight:700;background:#ede9fe;color:#7c3aed;white-space:nowrap">↩ ESTORNO${de}</span></span>`;
    } else if (l.glosado) {
      repasseCell = `<span style="white-space:nowrap"><span style="color:var(--danger);font-weight:700;text-decoration:line-through">${formatCurrency(l.repasse)}</span> <span class="badge badge-glosado" style="white-space:nowrap">GLOSADO</span></span>`;
    } else if (l.pendente) {
      repasseCell = `<span style="white-space:nowrap"><span style="color:#b45309;font-weight:700">${formatCurrency(getRepasse(l))}</span> <span style="display:inline-block;padding:.18rem .55rem;border-radius:20px;font-size:.7rem;font-weight:700;background:#fef3c7;color:#b45309;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap">⏸ PENDENTE</span></span>`;
    } else {
      repasseCell = `<span class="repasse-valor" data-uid="${l._uid}" data-row="${l.row}" data-val="${l.repasse}"
              style="color:var(--primary);font-weight:700;cursor:pointer;border-bottom:1.5px dashed var(--primary)"
              title="Duplo clique para editar"
              ondblclick="editRepasse(this)">${formatCurrency(getRepasse(l))}</span>`;
    }

    let btnGlosa = '';
    if (isConvenio) {
      if (l.estornado) {
        // Desfazer estorno
        btnGlosa = `<button class="btn-action" onclick="toggleEstorno(${l._uid}, false)"
           title="Desfazer estorno" style="color:#7c3aed">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
         </button>`;
      } else if (l.glosado) {
        // Estornar glosa + Desfazer glosa
        btnGlosa = `
         <button class="btn-action" onclick="toggleEstorno(${l._uid}, true)"
           title="Registrar estorno de glosa" style="color:#7c3aed">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
         </button>
         <button class="btn-action btn-unglose" onclick="toggleGlosa(${l._uid})"
           title="Desfazer glosa (erro)">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
         </button>`;
      } else {
        // Marcar como glosado
        btnGlosa = `<button class="btn-action btn-glose" onclick="toggleGlosa(${l._uid})"
           title="Marcar como glosado">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
         </button>`;
      }
    }

    const btnPendente = isParticular
      ? `<button class="btn-action" onclick="togglePendente(${l._uid})"
           title="${l.pendente ? 'Liberar repasse' : 'Congelar repasse'}"
           style="color:${l.pendente ? '#16a34a' : '#b45309'}">
           ${l.pendente
             ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
             : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
           }
         </button>`
      : '';

    return `
    <tr class="${l.estornado ? 'row-estornado' : l.glosado ? 'row-glosado' : isRascunho ? 'row-rascunho' : ''}">
      <td style="white-space:nowrap">${formatDate(l.data)}</td>
      <td>${l.dentista}</td>
      <td>${l.paciente}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${l.procedimento}">${l.procedimento}</td>
      <td style="font-weight:600;color:var(--primary)">${l.dente || '—'}</td>
      <td><span class="badge badge-${isConvenio ? 'convenio' : isRascunho ? 'rascunho' : 'particular'}">${l.tipo}</span></td>
      <td>${l.convenio || '—'}</td>
      <td style="font-size:.8rem;color:var(--text-muted)">${l.gto || '—'}</td>
      <td>${formatCurrency(l.valor)}</td>
      <td>${repasseCell}</td>
      <td class="td-actions">
        ${btnGlosa}
        ${btnPendente}
        <button class="btn-action" onclick="openEditModal(${l._uid})" title="Editar lançamento" style="color:var(--primary)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="btn-action btn-del" onclick="deleteRow(${l._uid})" title="Excluir lançamento">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Pendente (Particular) ─────────────────────────────────────
async function togglePendente(uid) {
  const item = allLancamentos.find(l => l._uid === uid);
  if (!item) return;
  if (!item.row) { showToast('Recarregue a página para sincronizar os dados', 'warning'); return; }
  const novo = !item.pendente;
  try {
    const res = await apiCall({ action: 'updatePendente', row: item.row, pendente: novo });
    if (res.error) { showToast(res.error, 'error'); return; }
    item.pendente = novo;
    applyFilters();
    showToast(novo ? 'Repasse congelado — aguardando finalização' : 'Repasse liberado!');
  } catch { showToast('Erro ao atualizar', 'error'); }
}

// ── Glosa ─────────────────────────────────────────────────────
async function toggleGlosa(uid) {
  const item = allLancamentos.find(l => l._uid === uid);
  if (!item) return;
  if (!item.row) { showToast('Recarregue a página para sincronizar os dados', 'warning'); return; }
  const novo = !item.glosado;
  try {
    const res = await apiCall({ action: 'updateGlosa', row: item.row, glosado: novo });
    if (res.error) { showToast(res.error, 'error'); return; }
    item.glosado = novo;
    applyFilters();
    showToast(novo ? 'Marcado como glosado' : 'Glosa removida');
  } catch { showToast('Erro ao atualizar glosa', 'error'); }
}

// ── Excluir linha ─────────────────────────────────────────────
async function deleteRow(uid) {
  if (!confirm('Excluir este lançamento? A ação não pode ser desfeita.')) return;
  const item = allLancamentos.find(l => l._uid === uid);
  if (!item) return;
  if (!item.row) { showToast('Recarregue a página para sincronizar os dados', 'warning'); return; }
  try {
    const res = await apiCall({ action: 'deleteLancamento', row: item.row });
    if (res.error) { showToast(res.error, 'error'); return; }
    allLancamentos = allLancamentos.filter(l => l._uid !== uid);
    repasseEdits.delete(uid);
    applyFilters();
    showToast('Lançamento excluído');
  } catch { showToast('Erro ao excluir', 'error'); }
}

// ── Export PDF ────────────────────────────────────────────────
// Retorna o repasse correto: usa edit do usuário (por _uid) se existir
function getRepasse(l) {
  return repasseEdits.has(l._uid) ? repasseEdits.get(l._uid) : Number(l.repasse);
}

async function exportPDF() {
  if (!filteredLancamentos.length) {
    showToast('Nenhum dado para exportar', 'warning'); return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const primaryRGB = [31, 49, 64];
  const accentRGB  = [82, 87, 89];

  // ── Cabeçalho ───────────────────────────────────────────────
  doc.setFillColor(...primaryRGB);
  doc.rect(0, 0, 297, 28, 'F');

  // Logo centralizada no cabeçalho (carregada em canvas para evitar filtro CSS)
  await new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const logoH = 16;
        const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
        const logoX = (297 - logoW) / 2;
        const logoY = (28 - logoH) / 2;
        doc.addImage(dataUrl, 'PNG', logoX, logoY, logoW, logoH);
      } catch(e) { /* fallback abaixo */ }
      resolve();
    };
    img.onerror = resolve;
    img.src = 'img/logo.png';
  });

  // ── Info do relatório ────────────────────────────────────────
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);

  const activePeriod = document.querySelector('.period-tab.active')?.dataset.type || 'month';
  let periodoStr = '';
  if (activePeriod === 'month') {
    const m = document.getElementById('filterMonth').value;
    if (m) { const [y, mo] = m.split('-'); periodoStr = `${mo}/${y}`; }
  } else if (activePeriod === 'year') {
    periodoStr = document.getElementById('filterYear').value || 'Todos';
  } else if (activePeriod === 'referencia') {
    const ref = document.getElementById('filterRefMonth').value;
    if (ref) {
      const [ry, rm] = ref.split('-').map(Number);
      const pm = rm === 1 ? 12 : rm - 1; const py = rm === 1 ? ry - 1 : ry;
      const cm = rm <= 2 ? rm + 10 : rm - 2; const cy = rm <= 2 ? ry - 1 : ry;
      const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      periodoStr = `Referência ${nomes[rm-1]}/${ry} (Part: ${nomes[pm-1]}/${py} | Conv: ${nomes[cm-1]}/${cy})`;
    }
  } else {
    const f = document.getElementById('filterFrom').value;
    const t = document.getElementById('filterTo').value;
    periodoStr = `${f ? formatDate(f) : '...'} até ${t ? formatDate(t) : '...'}`;
  }

  const dentista = document.getElementById('filterDentista').value || 'Todos';
  const geradoEm = new Date().toLocaleString('pt-BR');

  doc.text(`Período: ${periodoStr || 'Todos'}`, 14, 35);
  doc.text(`Dentista: ${dentista}`, 14, 41);
  doc.text(`Gerado em: ${geradoEm}`, 14, 47);

  const ativos    = filteredLancamentos.filter(l => !l.glosado && !l.pendente);
  const pendentes = filteredLancamentos.filter(l => !l.glosado &&  l.pendente);
  const glosados  = filteredLancamentos.filter(l =>  l.glosado);
  const totalRep  = ativos.reduce((s, l) => s + getRepasse(l), 0);

  const totalGlosaPDF = glosados.reduce((s, l) => s + (Number(l.repasse) || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryRGB);
  let subPDF = [];
  if (pendentes.length) subPDF.push(`${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}`);
  if (glosados.length)  subPDF.push(`${glosados.length} glosado${glosados.length > 1 ? 's' : ''}`);
  doc.text(`Total de Lançamentos: ${ativos.length}${subPDF.length ? ` (+${subPDF.join(', ')})` : ''}`, 200, 35);
  doc.text(`Total Repasse: ${formatCurrency(totalRep)}`, 200, 41);
  if (glosados.length) {
    doc.setTextColor(220, 38, 38);
    doc.text(`Total Glosado: ${formatCurrency(totalGlosaPDF)} (${glosados.length} lançamento${glosados.length > 1 ? 's' : ''})`, 200, 47);
    doc.setTextColor(...primaryRGB);
  }

  // ── Tabela ───────────────────────────────────────────────────
  const sortedAtivos    = [...ativos].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const sortedPendentes = [...pendentes].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const sortedGlosados  = [...glosados].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const sorted = [...sortedAtivos, ...sortedPendentes, ...sortedGlosados];

  const rows = sorted.map(l => [
    formatDate(l.data),
    l.dentista,
    l.paciente,
    l.procedimento,
    l.dente || '—',
    l.tipo,
    l.convenio || '—',
    l.gto || '—',
    formatCurrency(getRepasse(l))
  ]);

  const dangerRGB = [220, 38, 38];

  doc.autoTable({
    startY: glosados.length ? 58 : 52,
    head: [['Data', 'Dentista', 'Paciente', 'Procedimento', 'Dente', 'Tipo', 'Convênio', 'GTO', 'Repasse']],
    body: rows,
    styles: { fontSize: 8, font: 'helvetica', cellPadding: 2.5 },
    headStyles: { fillColor: primaryRGB, textColor: 255, fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [242, 244, 246] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 32 },
      2: { cellWidth: 32 },
      3: { cellWidth: 52 },
      4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 18 },
      6: { cellWidth: 26 },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: primaryRGB }
    },
    didParseCell: (data) => {
      const rowIndex = data.row.index;
      if (rowIndex >= sortedAtivos.length && rowIndex < sortedAtivos.length + sortedPendentes.length) {
        // Pendentes: fundo amarelo
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.fontStyle = 'italic';
      } else if (rowIndex >= sortedAtivos.length + sortedPendentes.length) {
        // Glosados: fundo vermelho
        data.cell.styles.textColor = dangerRGB;
        data.cell.styles.fillColor = [255, 235, 235];
        data.cell.styles.fontStyle = 'italic';
      }
    },
    didDrawPage: (data) => {
      const pageH = doc.internal.pageSize.height;
      const pageW = doc.internal.pageSize.width;
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${data.pageNumber}`, pageW - 14, pageH - 8, { align: 'right' });
    }
  });

  // ── Totalizador final ────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 6;
  doc.setFillColor(...accentRGB);
  doc.roundedRect(14, finalY, 269, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL REPASSE AO DENTISTA: ${formatCurrency(totalRep)}`, 148, finalY + 7.5, { align: 'center' });

  // ── Dados para emissão de NF (última página, abaixo do total) ─
  const pageH   = doc.internal.pageSize.height;
  const pageW   = doc.internal.pageSize.width;
  const nfHeight = 36; // altura necessária para o bloco de NF
  let nfY = finalY + 18;

  // Se não cabe na página atual, abre nova página
  if (nfY + nfHeight > pageH - 15) {
    doc.addPage();
    nfY = 20;
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, nfY, pageW - 14, nfY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Dados para emissão de NF', 14, nfY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('CNPJ: 54.908.515/0001-13', 14, nfY + 14);
  doc.text('GS Centro Clínico e Odontológico', 14, nfY + 21);
  doc.text('gscentroclinicoeodontologico@gmail.com', 14, nfY + 28);

  // Salvar
  const nomeArq = `repasse_${dentista.replace(/\s+/g,'_')}_${periodoStr.replace(/\//g,'-') || 'geral'}.pdf`;
  doc.save(nomeArq);
  showToast('PDF gerado com sucesso!');
}

// ── Edição inline de Repasse ──────────────────────────────────
function editRepasse(span) {
  if (span.querySelector('input')) return;

  const uid      = parseInt(span.dataset.uid);
  const valAtual = parseFloat(span.dataset.val) || 0;

  // Guarda o valor original no próprio span para restaurar se necessário
  span.dataset.valOriginal = valAtual;
  span.style.borderBottom  = 'none';
  span.innerHTML = `
    <input
      type="number" min="0" step="0.01"
      value="${valAtual.toFixed(2)}"
      style="width:90px;padding:.2rem .4rem;font-size:.85rem;font-weight:700;
             border:2px solid var(--primary);border-radius:5px;color:var(--primary);
             font-family:Poppins,sans-serif;outline:none;"
    >`;

  const input = span.querySelector('input');

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { span.dataset.val = valAtual; restoreSpan(span, valAtual); }
  });

  input.addEventListener('blur', () => saveRepasse(span, uid));

  input.focus();
  input.select();
}

async function saveRepasse(span, uid) {
  const input = span.querySelector('input');
  if (!input || input.dataset.saving) return;   // evita duplo disparo
  input.dataset.saving = '1';

  const novoVal = parseFloat(input.value);
  const valOrig = parseFloat(span.dataset.valOriginal) || 0;

  if (isNaN(novoVal) || novoVal < 0) {
    restoreSpan(span, valOrig);
    return;
  }

  input.disabled = true;
  input.style.opacity = '.5';

  const item = allLancamentos.find(l => l._uid === uid);
  if (!item) { restoreSpan(span, valOrig); return; }

  try {
    const res = await apiCall({ action: 'updateRepasse', row: item.row, repasse: novoVal });

    if (res.error) {
      showToast('Erro: ' + res.error, 'error');
      restoreSpan(span, valOrig);
      return;
    }

    // Salva pelo _uid — imune a IDs duplicados
    repasseEdits.set(uid, novoVal);
    item.repasse = novoVal;

    span.dataset.val        = novoVal;
    span.style.borderBottom = '1.5px dashed var(--primary)';
    span.innerHTML          = formatCurrency(novoVal);
    span.ondblclick         = () => editRepasse(span);

    renderSummary();
    showToast('Repasse atualizado!');

  } catch (e) {
    showToast('Erro de conexão ao salvar repasse', 'error');
    restoreSpan(span, valOrig);
  }
}

function restoreSpan(span, valor) {
  span.dataset.val         = valor;
  span.style.borderBottom  = '1.5px dashed var(--primary)';
  span.innerHTML           = formatCurrency(valor);
  span.ondblclick          = () => editRepasse(span);
}

function showLoader(show) {
  document.getElementById('pageLoader').style.display = show ? 'flex' : 'none';
}

// ── Charts ────────────────────────────────────────────────────

Chart.register(ChartDataLabels);

const CHART_PALETTE = ['#1F3140','#525759','#949DA6','#011526','#3d5166','#6b7880','#2a4255','#7a8a94','#4a6070','#8a9aa4'];

const LEGEND_OPTS = {
  position: 'bottom',
  labels: { font: { family: 'Poppins', size: 11 }, padding: 14, boxWidth: 12 }
};

const LEGEND_TOP = {
  position: 'top',
  labels: { font: { family: 'Poppins', size: 11 }, padding: 12, boxWidth: 12 }
};

const DL_CURRENCY = {
  font: { family: 'Poppins', size: 10, weight: '700' },
  color: '#1a202c',
  formatter: v => formatCurrency(v)
};

function destroyCharts() {
  Object.values(chartInstances).forEach(c => c && c.destroy());
  chartInstances = {};
}

// Dados ativos (sem glosados) usados nos gráficos
function getChartData() {
  return filteredLancamentos.filter(l => !l.glosado && !l.pendente);
}

function renderCharts() {
  destroyCharts();
  const section = document.getElementById('chartsSection');
  const ativos = getChartData();
  if (!ativos.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  renderChartTipo();
  renderChartRepasse();
  renderChartConvenio();
  renderChartDentista();
  renderChartProcedimento();
}

// Helper: gera opções de legenda com valor + % embutidos nos itens
function doughnutLegend(rawData, total, colors) {
  return {
    position: 'bottom',
    labels: {
      generateLabels(chart) {
        return chart.data.labels.map((label, i) => {
          const v   = chart.data.datasets[0].data[i];
          const pct = total > 0 ? (v / total * 100).toFixed(1) : '0.0';
          return {
            text:        `${label}   ${formatCurrency(v)}  (${pct}%)`,
            fillStyle:   colors[i] || '#ccc',
            strokeStyle: colors[i] || '#ccc',
            lineWidth:   0,
            hidden:      false,
            index:       i,
            pointStyle:  'circle'
          };
        });
      },
      usePointStyle: true,
      font:    { family: 'Poppins', size: 11 },
      padding: 16,
      boxWidth: 10
    }
  };
}

// ── 1. Particular vs Convênio (Doughnut) ─────────────────────
function renderChartTipo() {
  const grupos = {};
  getChartData().forEach(l => { grupos[l.tipo] = (grupos[l.tipo] || 0) + Number(l.repasse); });
  const labels = Object.keys(grupos);
  const data   = labels.map(k => grupos[k]);
  const total  = data.reduce((s, v) => s + v, 0);
  const colors = ['#1F3140', '#949DA6'];

  chartInstances.tipo = new Chart(document.getElementById('chartTipo'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      layout: { padding: { top: 10, bottom: 4, left: 10, right: 10 } },
      plugins: {
        legend:     doughnutLegend(data, total, colors),
        tooltip:    { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${total > 0 ? (ctx.raw/total*100).toFixed(1) : 0}%)` } },
        datalabels: { display: false }
      }
    }
  });
}

// ── 2. Repasse vs Receita Clínica (Doughnut) ─────────────────
function renderChartRepasse() {
  const ativos = getChartData();
  const totalRep = ativos.reduce((s, l) => s + Number(l.repasse), 0);
  const totalVal = ativos.reduce((s, l) => s + Number(l.valor),   0);
  const clinica  = Math.max(0, totalVal - totalRep);
  const data     = [totalRep, clinica];
  const colors   = ['#525759', '#1F3140'];

  chartInstances.repasse = new Chart(document.getElementById('chartRepasse'), {
    type: 'doughnut',
    data: { labels: ['Dentista', 'Clínica'], datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      layout: { padding: { top: 10, bottom: 4, left: 10, right: 10 } },
      plugins: {
        legend:     doughnutLegend(data, totalVal, colors),
        tooltip:    { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${totalVal > 0 ? (ctx.raw/totalVal*100).toFixed(1) : 0}%)` } },
        datalabels: { display: false }
      }
    }
  });
}

// ── 3. Repasse por Convênio (Doughnut ≤5 / Bar >5) ───────────
function renderChartConvenio() {
  const convData = getChartData().filter(l => l.tipo === 'Convênio');
  const grupos   = {};
  convData.forEach(l => { const k = l.convenio || 'Sem nome'; grupos[k] = (grupos[k] || 0) + Number(l.repasse); });
  const labels  = Object.keys(grupos);
  const data    = labels.map(k => grupos[k]);
  const total   = data.reduce((s, v) => s + v, 0);
  const colors  = CHART_PALETTE.slice(0, labels.length);
  const isDough = labels.length <= 5;

  if (!labels.length) {
    chartInstances.convenio = new Chart(document.getElementById('chartConvenio'), {
      type: 'doughnut',
      data: { labels: ['Sem convênios'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { display: false }, datalabels: { display: false } }
      }
    });
    return;
  }

  chartInstances.convenio = new Chart(document.getElementById('chartConvenio'), {
    type: isDough ? 'doughnut' : 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Repasse', data,
        backgroundColor: colors,
        borderWidth: isDough ? 3 : 0, borderColor: '#fff',
        borderRadius: isDough ? 0 : 6, hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: isDough ? '65%' : undefined,
      layout: isDough
        ? { padding: { top: 10, bottom: 4, left: 10, right: 10 } }
        : { padding: { top: 28 } },
      plugins: {
        legend:  isDough ? doughnutLegend(data, total, colors) : { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
        datalabels: isDough
          ? { display: false }
          : { ...DL_CURRENCY, anchor: 'end', align: 'top', offset: 2 }
      },
      scales: isDough ? undefined : {
        y: { display: false },
        x: { ticks: { font: { family: 'Poppins', size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ── 4. Repasse por Dentista (Bar vertical) ────────────────────
function renderChartDentista() {
  const grupos = {};
  getChartData().forEach(l => { grupos[l.dentista] = (grupos[l.dentista] || 0) + Number(l.repasse); });
  const sorted = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k);
  const data   = sorted.map(([, v]) => v);

  chartInstances.dentista = new Chart(document.getElementById('chartDentista'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Repasse', data, backgroundColor: CHART_PALETTE.slice(0, labels.length), borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 28 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
        datalabels: { ...DL_CURRENCY, anchor: 'end', align: 'top', offset: 2 }
      },
      scales: {
        y: { display: false },
        x: { ticks: { font: { family: 'Poppins', size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ── 5. Top Procedimentos (Horizontal Bar) ────────────────────
function renderChartProcedimento() {
  const grupos = {};
  getChartData().forEach(l => { grupos[l.procedimento] = (grupos[l.procedimento] || 0) + Number(l.repasse); });
  const sorted = Object.entries(grupos).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const labels = sorted.map(([k]) => k);
  const data   = sorted.map(([, v]) => v);

  chartInstances.procedimento = new Chart(document.getElementById('chartProcedimento'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Repasse', data, backgroundColor: '#1F3140', borderRadius: 4, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      layout: { padding: { right: 85 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
        datalabels: { ...DL_CURRENCY, anchor: 'end', align: 'right', offset: 6, clip: false }
      },
      scales: {
        x: { display: false },
        y: { ticks: { font: { family: 'Poppins', size: 9 } }, grid: { display: false } }
      }
    }
  });
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Editar lançamento ─────────────────────────────────────────
function toggleEditConvenio() {
  const tipo = document.getElementById('editLancTipo').value;
  document.getElementById('editConvenioWrap').style.display = tipo === 'Convênio' ? '' : 'none';
}

function openEditModal(uid) {
  const l = allLancamentos.find(x => x._uid === uid);
  if (!l) return;
  document.getElementById('editLancUid').value         = uid;
  document.getElementById('editLancRow').value         = l.row;
  document.getElementById('editLancData').value        = l.data ? l.data.slice(0,10) : '';
  document.getElementById('editLancDentista').value    = l.dentista || '';
  document.getElementById('editLancPaciente').value    = l.paciente || '';
  document.getElementById('editLancProcedimento').value= l.procedimento || '';
  document.getElementById('editLancTipo').value        = l.tipo || 'Particular';
  document.getElementById('editLancConvenio').value    = l.convenio || '';
  document.getElementById('editLancValor').value       = l.valor || '';
  document.getElementById('editLancRepasse').value     = l.repasse || '';
  document.getElementById('editLancDente').value       = l.dente || '';
  document.getElementById('editLancGto').value         = l.gto || '';
  toggleEditConvenio();
  openModal('modalEditLancamento');
}

async function saveEditLancamento() {
  const uid  = parseInt(document.getElementById('editLancUid').value);
  const row  = document.getElementById('editLancRow').value;
  if (!row) { showToast('Linha inválida — recarregue a página', 'error'); return; }

  const data = {
    data:         document.getElementById('editLancData').value,
    dentista:     document.getElementById('editLancDentista').value.trim(),
    paciente:     document.getElementById('editLancPaciente').value.trim(),
    procedimento: document.getElementById('editLancProcedimento').value.trim(),
    tipo:         document.getElementById('editLancTipo').value,
    convenio:     document.getElementById('editLancConvenio').value.trim(),
    valor:        parseFloat(document.getElementById('editLancValor').value) || 0,
    repasse:      parseFloat(document.getElementById('editLancRepasse').value) || 0,
    dente:        document.getElementById('editLancDente').value.trim(),
    gto:          document.getElementById('editLancGto').value.trim()
  };

  if (!data.data || !data.dentista || !data.paciente) {
    showToast('Preencha data, dentista e paciente', 'warning'); return;
  }

  try {
    const res = await apiCall({ action: 'updateLancamento', row, data: JSON.stringify(data) });
    if (res.error) { showToast(res.error, 'error'); return; }
    // Atualiza in-memory
    const item = allLancamentos.find(x => x._uid === uid);
    if (item) Object.assign(item, data);
    closeModal('modalEditLancamento');
    applyFilters();
    showToast('Lançamento atualizado!');
  } catch(e) {
    showToast('Erro de conexão: ' + (e.message || e), 'error');
  }
}

// ── Estorno de Glosa ──────────────────────────────────────────
async function toggleEstorno(uid, ativar) {
  const item = allLancamentos.find(l => l._uid === uid);
  if (!item) return;
  if (!item.row) { showToast('Recarregue a página para sincronizar os dados', 'warning'); return; }

  let dataEstorno = '';
  if (ativar) {
    // Pede a data do estorno — padrão hoje
    const hoje = new Date();
    const pad  = n => String(n).padStart(2, '0');
    const hojeFmt = `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-${pad(hoje.getDate())}`;
    const input = prompt('Data do estorno (AAAA-MM-DD):', hojeFmt);
    if (input === null) return; // cancelado
    dataEstorno = input.trim() || hojeFmt;
  }

  try {
    const res = await apiCall({ action: 'updateEstorno', row: item.row, estornado: ativar, dataEstorno });
    if (res.error) { showToast(res.error, 'error'); return; }
    item.estornado   = ativar;
    item.dataEstorno = ativar ? dataEstorno : '';
    applyFilters();
    showToast(ativar ? 'Estorno de glosa registrado!' : 'Estorno desfeito.');
  } catch(e) {
    showToast('Erro de conexão: ' + (e.message || e), 'error');
  }
}
