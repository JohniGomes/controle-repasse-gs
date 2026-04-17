// ============================================================
// Lógica do Dashboard
// ============================================================

let allLancamentos = [];
let filteredLancamentos = [];
let dentistasDB = [];
let conveniosDB = [];

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  showLoader(true);
  await Promise.all([loadAllData(), loadDentistasFilter(), loadConveniosFilter()]);
  setDefaultFilters();
  applyFilters();
  showLoader(false);
});

// ── Carregamento de dados ─────────────────────────────────────
async function loadAllData() {
  try {
    const res = await apiCall({ action: 'getLancamentos' });
    if (res.error) {
      showToast('Erro Apps Script: ' + res.error, 'error');
      allLancamentos = [];
      return;
    }
    allLancamentos = (res.data || []).map(l => ({
      ...l,
      data: normalizeDate(l.data, l.timestamp)
    }));
    showToast(
      allLancamentos.length > 0
        ? `✓ ${allLancamentos.length} lançamento(s) carregado(s)`
        : '⚠ Planilha retornou 0 registros',
      allLancamentos.length > 0 ? 'success' : 'warning'
    );
  } catch (e) {
    showToast('Erro de conexão com o servidor: ' + (e.message || e), 'error');
    allLancamentos = [];
  }
}

function normalizeDate(val, fallbackTimestamp) {
  // Timestamp é sempre ISO confiável — usa como fonte principal
  if (fallbackTimestamp) {
    const ts = String(fallbackTimestamp).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(ts)) return ts;
  }
  if (!val) return '';
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

async function loadDentistasFilter() {
  try {
    const res = await apiCall({ action: 'getDentistas' });
    dentistasDB = res.data || [];
    const sel = document.getElementById('filterDentista');
    dentistasDB.forEach(d => {
      const o = document.createElement('option');
      o.value = d.nome; o.textContent = d.nome;
      sel.appendChild(o);
    });
  } catch {}
}

async function loadConveniosFilter() {
  try {
    const res = await apiCall({ action: 'getConvenios' });
    conveniosDB = res.data || [];
    const sel = document.getElementById('filterConvenio');
    conveniosDB.forEach(c => {
      const o = document.createElement('option');
      o.value = c.nome; o.textContent = c.nome;
      sel.appendChild(o);
    });
  } catch {}
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
  document.getElementById('periodMonth').style.display  = type === 'month'  ? '' : 'none';
  document.getElementById('periodYear').style.display   = type === 'year'   ? '' : 'none';
  document.getElementById('periodCustom').style.display = type === 'custom' ? '' : 'none';
}

function applyFilters() {
  const dentista     = document.getElementById('filterDentista').value;
  const procedimento = document.getElementById('filterProcedimento').value;
  const convenio     = document.getElementById('filterConvenio').value;
  const activePeriod = document.querySelector('.period-tab.active')?.dataset.type || 'month';
  const m            = document.getElementById('filterMonth').value;

  filteredLancamentos = allLancamentos.filter(l => {
    if (dentista     && l.dentista.trim()     !== dentista.trim())     return false;
    if (procedimento && l.procedimento.trim() !== procedimento.trim()) return false;
    if (convenio     && (l.convenio || '').trim() !== convenio.trim()) return false;

    const d = String(l.data).slice(0, 10);
    if (activePeriod === 'month') {
      if (m && !d.startsWith(m)) return false;
    } else if (activePeriod === 'year') {
      const y = document.getElementById('filterYear').value;
      if (y && !d.startsWith(y)) return false;
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
  const qtd      = filteredLancamentos.length;
  const totalVal = filteredLancamentos.reduce((s, l) => s + (Number(l.valor)   || 0), 0);
  const totalRep = filteredLancamentos.reduce((s, l) => s + (Number(l.repasse) || 0), 0);

  document.getElementById('summaryQtd').textContent  = qtd;
  document.getElementById('summaryValor').textContent = formatCurrency(totalVal);
  document.getElementById('summaryRepasse').textContent = formatCurrency(totalRep);
}

// ── Tabela ────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('dashboardBody');
  if (!filteredLancamentos.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>Nenhum lançamento encontrado para os filtros selecionados.</p></div></td></tr>';
    return;
  }
  const sorted = [...filteredLancamentos].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  tbody.innerHTML = sorted.map(l => `
    <tr>
      <td style="white-space:nowrap">${formatDate(l.data)}</td>
      <td>${l.dentista}</td>
      <td>${l.paciente}</td>
      <td style="max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${l.procedimento}">${l.procedimento}</td>
      <td><span class="badge badge-${l.tipo === 'Particular' ? 'particular' : 'convenio'}">${l.tipo}</span></td>
      <td>${l.convenio || '—'}</td>
      <td>${formatCurrency(l.valor)}</td>
      <td style="color:var(--primary);font-weight:700">${formatCurrency(l.repasse)}</td>
    </tr>`).join('');
}

// ── Export PDF ────────────────────────────────────────────────
function exportPDF() {
  if (!filteredLancamentos.length) {
    showToast('Nenhum dado para exportar', 'warning'); return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const primaryRGB = [26, 86, 219];
  const accentRGB  = [14, 165, 160];

  // ── Cabeçalho ───────────────────────────────────────────────
  doc.setFillColor(...primaryRGB);
  doc.rect(0, 0, 297, 28, 'F');

  // Logo dente (simplificado)
  doc.setDrawColor(255,255,255);
  doc.setLineWidth(0.5);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Centro Clínico GS', 148, 12, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Controle de Repasse', 148, 20, { align: 'center' });

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

  const totalRep = filteredLancamentos.reduce((s, l) => s + (Number(l.repasse) || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryRGB);
  doc.text(`Total de Lançamentos: ${filteredLancamentos.length}`, 200, 35);
  doc.text(`Total Repasse: ${formatCurrency(totalRep)}`, 200, 41);

  // ── Tabela ───────────────────────────────────────────────────
  const sorted = [...filteredLancamentos].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const rows   = sorted.map(l => [
    formatDate(l.data),
    l.dentista,
    l.paciente,
    l.procedimento,
    l.tipo,
    l.convenio || '—',
    formatCurrency(l.repasse)
  ]);

  doc.autoTable({
    startY: 52,
    head: [['Data', 'Dentista', 'Paciente', 'Procedimento', 'Tipo', 'Convênio', 'Repasse']],
    body: rows,
    styles: { fontSize: 8, font: 'helvetica', cellPadding: 2.5 },
    headStyles: { fillColor: primaryRGB, textColor: 255, fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 40 },
      2: { cellWidth: 40 },
      3: { cellWidth: 65 },
      4: { cellWidth: 22 },
      5: { cellWidth: 35 },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: primaryRGB }
    },
    didDrawPage: (data) => {
      // Rodapé
      const pageH = doc.internal.pageSize.height;
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.setFont('helvetica', 'normal');
      doc.text('Centro Clínico GS — Relatório de Repasse', 14, pageH - 8);
      doc.text(`Página ${data.pageNumber}`, 283, pageH - 8, { align: 'right' });
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

  // Salvar
  const nomeArq = `repasse_${dentista.replace(/\s+/g,'_')}_${periodoStr.replace(/\//g,'-') || 'geral'}.pdf`;
  doc.save(nomeArq);
  showToast('PDF gerado com sucesso!');
}

function showLoader(show) {
  document.getElementById('pageLoader').style.display = show ? 'flex' : 'none';
}
