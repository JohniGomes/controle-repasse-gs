// ============================================================
// Lógica da página de Lançamento
// ============================================================

let dentistas = [];
let convenios = [];

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  setDefaultDate();
  populateProcedimentos();
  showLoader(true);
  await Promise.all([loadDentistas(), loadConvenios()]);
  showLoader(false);
});

function setDefaultDate() {
  document.getElementById('data').value = todayISO();
}

function populateProcedimentos() {
  const sel = document.getElementById('procedimento');
  PROCEDIMENTOS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.nome;
    opt.dataset.repasse = p.repasse;
    opt.textContent = p.nome;
    sel.appendChild(opt);
  });
}

// ── Dentistas ─────────────────────────────────────────────────
async function loadDentistas() {
  try {
    const res = await apiCall({ action: 'getDentistas' });
    dentistas = res.data || [];
    renderDentistaSelect();
  } catch { showToast('Erro ao carregar dentistas', 'error'); }
}

function renderDentistaSelect() {
  const sel = document.getElementById('dentista');
  const val = sel.value;
  sel.innerHTML = '<option value="">Selecione...</option>';
  dentistas.forEach(d => {
    const o = document.createElement('option');
    o.value = d.nome; o.dataset.id = d.id; o.textContent = d.nome;
    sel.appendChild(o);
  });
  if (val) sel.value = val;
}

async function addDentista() {
  const nome = document.getElementById('newDentistaName').value.trim();
  if (!nome) { showToast('Digite o nome do dentista', 'warning'); return; }
  try {
    const res = await apiCall({ action: 'addDentista', nome });
    if (res.error) { showToast(res.error, 'error'); return; }
    dentistas.push({ id: res.id, nome: res.nome });
    renderDentistaSelect();
    document.getElementById('dentista').value = res.nome;
    closeModal('modalAddDentista');
    showToast('Dentista cadastrado!');
  } catch { showToast('Erro ao cadastrar dentista', 'error'); }
}

async function deleteDentistaSelected() {
  const sel = document.getElementById('dentista');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) { showToast('Selecione um dentista para excluir', 'warning'); return; }
  if (!confirm(`Excluir "${opt.value}"?`)) return;
  try {
    const res = await apiCall({ action: 'deleteDentista', id: opt.dataset.id });
    if (res.error) { showToast(res.error, 'error'); return; }
    dentistas = dentistas.filter(d => d.id !== opt.dataset.id);
    renderDentistaSelect();
    showToast('Dentista removido!');
  } catch { showToast('Erro ao remover dentista', 'error'); }
}

// ── Convênios ─────────────────────────────────────────────────
async function loadConvenios() {
  try {
    const res = await apiCall({ action: 'getConvenios' });
    convenios = res.data || [];
    renderConvenioSelect();
  } catch { showToast('Erro ao carregar convênios', 'error'); }
}

function renderConvenioSelect() {
  const sel = document.getElementById('convenio');
  const val = sel.value;
  sel.innerHTML = '<option value="">Selecione...</option>';
  convenios.forEach(c => {
    const o = document.createElement('option');
    o.value = c.nome; o.dataset.id = c.id; o.textContent = c.nome;
    sel.appendChild(o);
  });
  if (val) sel.value = val;
}

async function addConvenio() {
  const nome = document.getElementById('newConvenioName').value.trim();
  if (!nome) { showToast('Digite o nome do convênio', 'warning'); return; }
  try {
    const res = await apiCall({ action: 'addConvenio', nome });
    if (res.error) { showToast(res.error, 'error'); return; }
    convenios.push({ id: res.id, nome: res.nome });
    renderConvenioSelect();
    document.getElementById('convenio').value = res.nome;
    closeModal('modalAddConvenio');
    showToast('Convênio cadastrado!');
  } catch { showToast('Erro ao cadastrar convênio', 'error'); }
}

async function deleteConvenioSelected() {
  const sel = document.getElementById('convenio');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) { showToast('Selecione um convênio para excluir', 'warning'); return; }
  if (!confirm(`Excluir "${opt.value}"?`)) return;
  try {
    const res = await apiCall({ action: 'deleteConvenio', id: opt.dataset.id });
    if (res.error) { showToast(res.error, 'error'); return; }
    convenios = convenios.filter(c => c.id !== opt.dataset.id);
    renderConvenioSelect();
    showToast('Convênio removido!');
  } catch { showToast('Erro ao remover convênio', 'error'); }
}

// ── Tipo (Particular / Convênio) ──────────────────────────────
function selectTipo(tipo) {
  document.getElementById('tipoParticular').classList.toggle('selected-particular', tipo === 'particular');
  document.getElementById('tipoConvenio').classList.toggle('selected-convenio', tipo === 'convenio');
  document.getElementById('radioParticular').checked = tipo === 'particular';
  document.getElementById('radioConvenio').checked   = tipo === 'convenio';
  document.getElementById('convenioRow').style.display = tipo === 'convenio' ? '' : 'none';
  calcularRepasse();
}

// ── Cálculo de Repasse ────────────────────────────────────────
function calcularRepasse() {
  const tipo   = document.getElementById('radioParticular').checked ? 'particular' : 'convenio';
  const valor  = parseFloat(document.getElementById('valor').value) || 0;
  const sel    = document.getElementById('procedimento');
  const opt    = sel.options[sel.selectedIndex];
  let repasse  = 0;

  if (tipo === 'particular' && opt && opt.dataset.repasse) {
    repasse = parseFloat(opt.dataset.repasse);
  } else if (tipo === 'convenio' && valor > 0) {
    repasse = valor * 0.35;
  }

  document.getElementById('repasse').value = repasse > 0 ? repasse.toFixed(2) : '';
  document.getElementById('repasseDisplay').textContent = repasse > 0 ? formatCurrency(repasse) : '—';
}

// ── Submit ────────────────────────────────────────────────────
async function salvarLancamento(e) {
  e.preventDefault();

  const tipo    = document.getElementById('radioParticular').checked ? 'Particular' : 'Convênio';
  const convenio = tipo === 'Convênio' ? document.getElementById('convenio').value : '';

  if (tipo === 'Convênio' && !convenio) {
    showToast('Selecione o convênio', 'warning'); return;
  }

  const data = {
    data:         document.getElementById('data').value,
    dentista:     document.getElementById('dentista').value,
    paciente:     document.getElementById('paciente').value.trim(),
    procedimento: document.getElementById('procedimento').value,
    tipo,
    convenio,
    valor:        parseFloat(document.getElementById('valor').value) || 0,
    repasse:      parseFloat(document.getElementById('repasse').value) || 0
  };

  if (!data.data || !data.dentista || !data.paciente || !data.procedimento || !data.valor) {
    showToast('Preencha todos os campos obrigatórios', 'warning'); return;
  }

  const btn = document.getElementById('btnSalvar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvando...';

  try {
    const res = await apiCall({ action: 'addLancamento', data: JSON.stringify(data) });
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast('Lançamento salvo com sucesso!');
    document.getElementById('lancamentoForm').reset();
    setDefaultDate();
    selectTipo('particular');
    calcularRepasse();
  } catch { showToast('Erro ao salvar lançamento', 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Salvar Lançamento';
  }
}

// ── Modais ────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.getElementById('newDentistaName') && (document.getElementById('newDentistaName').value = '');
  document.getElementById('newConvenioName') && (document.getElementById('newConvenioName').value = '');
}

// Fechar modal clicando fora
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── Loader ────────────────────────────────────────────────────
function showLoader(show) {
  document.getElementById('pageLoader').style.display = show ? 'flex' : 'none';
}
