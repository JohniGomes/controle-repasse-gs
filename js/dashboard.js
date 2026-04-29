// ============================================================
// Lógica do Dashboard
// ============================================================

let allLancamentos = [];
let filteredLancamentos = [];
let dentistasDB = [];
let conveniosDB = [];
let chartInstances = {};

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
    const res = await apiCall({ action: 'getLancamentos' });
    if (res.error) { showToast('Erro: ' + res.error, 'error'); return; }
    allLancamentos = (res.data || []).map(l => ({
      ...l,
      data: normalizeDate(l.data, l.timestamp)
    }));
  } catch (e) {
    showToast('Erro de conexão: ' + (e.message || e), 'error');
  }
}

function normalizeDate(val, fallbackTimestamp) {
  if (fallbackTimestamp) {
    const ts = String(fallbackTimestamp).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(ts)) return ts;
  }
  const s = String(val || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
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
    if (convenio     && l.tipo.trim()         !== convenio.trim())     return false;

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
  const ativos   = filteredLancamentos.filter(l => !l.glosado);
  const glosados = filteredLancamentos.filter(l =>  l.glosado);
  const totalVal = ativos.reduce((s, l) => s + (Number(l.valor)   || 0), 0);
  const totalRep = ativos.reduce((s, l) => s + (Number(l.repasse) || 0), 0);

  document.getElementById('summaryQtd').textContent =
    filteredLancamentos.length + (glosados.length ? ` (${glosados.length} glosado${glosados.length > 1 ? 's' : ''})` : '');
  document.getElementById('summaryValor').textContent   = formatCurrency(totalVal);
  document.getElementById('summaryRepasse').textContent = formatCurrency(totalRep);
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
    const isConvenio = l.tipo === 'Convênio';
    const repasseCell = l.glosado
      ? `<span style="color:var(--danger);font-weight:700;text-decoration:line-through">${formatCurrency(l.repasse)}</span> <span class="badge badge-glosado">GLOSADO</span>`
      : `<span class="repasse-valor" data-id="${l.id}" data-val="${l.repasse}"
              style="color:var(--primary);font-weight:700;cursor:pointer;border-bottom:1.5px dashed var(--primary)"
              title="Duplo clique para editar"
              ondblclick="editRepasse(this)">${formatCurrency(l.repasse)}</span>`;

    const btnGlosa = isConvenio
      ? `<button class="btn-action ${l.glosado ? 'btn-unglose' : 'btn-glose'}"
           onclick="toggleGlosa('${l.id}',${l.glosado})"
           title="${l.glosado ? 'Remover glosa' : 'Marcar como glosado'}">
           ${l.glosado
             ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
             : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
           }
         </button>`
      : '';

    return `
    <tr class="${l.glosado ? 'row-glosado' : ''}">
      <td style="white-space:nowrap">${formatDate(l.data)}</td>
      <td>${l.dentista}</td>
      <td>${l.paciente}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${l.procedimento}">${l.procedimento}</td>
      <td style="font-weight:600;color:var(--primary)">${l.dente || '—'}</td>
      <td><span class="badge badge-${isConvenio ? 'convenio' : 'particular'}">${l.tipo}</span></td>
      <td>${l.convenio || '—'}</td>
      <td>${formatCurrency(l.valor)}</td>
      <td>${repasseCell}</td>
      <td class="td-actions">
        ${btnGlosa}
        <button class="btn-action btn-del" onclick="deleteRow('${l.id}')" title="Excluir lançamento">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Glosa ─────────────────────────────────────────────────────
async function toggleGlosa(id, current) {
  const novo = !current;
  try {
    const res = await apiCall({ action: 'updateGlosa', id, glosado: novo });
    if (res.error) { showToast(res.error, 'error'); return; }
    const item = allLancamentos.find(l => l.id === id);
    if (item) item.glosado = novo;
    applyFilters();
    showToast(novo ? 'Marcado como glosado' : 'Glosa removida');
  } catch { showToast('Erro ao atualizar glosa', 'error'); }
}

// ── Excluir linha ─────────────────────────────────────────────
async function deleteRow(id) {
  if (!confirm('Excluir este lançamento? A ação não pode ser desfeita.')) return;
  try {
    const res = await apiCall({ action: 'deleteLancamento', id });
    if (res.error) { showToast(res.error, 'error'); return; }
    allLancamentos = allLancamentos.filter(l => l.id !== id);
    applyFilters();
    showToast('Lançamento excluído');
  } catch { showToast('Erro ao excluir', 'error'); }
}

// ── Export PDF ────────────────────────────────────────────────
async function exportPDF() {
  // Garante que filteredLancamentos reflete o estado atual de allLancamentos
  applyFilters();

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

  const ativos   = filteredLancamentos.filter(l => !l.glosado);
  const glosados = filteredLancamentos.filter(l =>  l.glosado);
  const totalRep = ativos.reduce((s, l) => s + (Number(l.repasse) || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryRGB);
  doc.text(`Total de Lançamentos: ${ativos.length}${glosados.length ? ` (+${glosados.length} glosado${glosados.length > 1 ? 's' : ''})` : ''}`, 200, 35);
  doc.text(`Total Repasse: ${formatCurrency(totalRep)}`, 200, 41);

  // ── Tabela ───────────────────────────────────────────────────
  // Ativos ordenados por data, seguidos dos glosados (em vermelho, só informação)
  const sortedAtivos   = [...ativos].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const sortedGlosados = [...glosados].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const sorted = [...sortedAtivos, ...sortedGlosados];

  const rows = sorted.map(l => [
    formatDate(l.data),
    l.dentista,
    l.paciente,
    l.procedimento,
    l.dente || '—',
    l.tipo,
    l.convenio || '—',
    formatCurrency(l.repasse)
  ]);

  const dangerRGB = [220, 38, 38];

  doc.autoTable({
    startY: 52,
    head: [['Data', 'Dentista', 'Paciente', 'Procedimento', 'Dente', 'Tipo', 'Convênio', 'Repasse']],
    body: rows,
    styles: { fontSize: 8, font: 'helvetica', cellPadding: 2.5 },
    headStyles: { fillColor: primaryRGB, textColor: 255, fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [242, 244, 246] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 36 },
      2: { cellWidth: 36 },
      3: { cellWidth: 58 },
      4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 20 },
      6: { cellWidth: 30 },
      7: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: primaryRGB }
    },
    didParseCell: (data) => {
      // Linhas glosadas: texto vermelho, fundo rosado, itálico
      const rowIndex = data.row.index;
      if (rowIndex >= sortedAtivos.length) {
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

  const id       = span.dataset.id;
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

  input.addEventListener('blur', () => saveRepasse(span, id));

  input.focus();
  input.select();
}

async function saveRepasse(span, id) {
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

  try {
    const res = await apiCall({ action: 'updateRepasse', id, repasse: novoVal });

    if (res.error) {
      showToast('Erro: ' + res.error, 'error');
      restoreSpan(span, valOrig);
      return;
    }

    // Atualiza em memória
    const itemA = allLancamentos.find(l => String(l.id) === String(id));
    if (itemA) itemA.repasse = novoVal;
    const itemF = filteredLancamentos.find(l => String(l.id) === String(id));
    if (itemF) itemF.repasse = novoVal;

    // Atualiza o span diretamente (sem re-renderizar a tabela toda)
    span.dataset.val    = novoVal;
    span.style.borderBottom = '1.5px dashed var(--primary)';
    span.innerHTML      = formatCurrency(novoVal);
    span.ondblclick     = () => editRepasse(span);

    // Atualiza só os cards de resumo
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
  return filteredLancamentos.filter(l => !l.glosado);
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
