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
    repasse:      parseFloat(document.getElementById('repasse').value) || 0,
    dente:        document.getElementById('dente').value || ''
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
    clearTooth();
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

// ── Odontograma ───────────────────────────────────────────────

// SVG dente genérico: coroa arredondada em cima, raiz apontada em baixo
function toothSVG() {
  return `<svg viewBox="0 0 18 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 2 C3 2 1 3 1 7 C1 11 2 14 3 16 C4 18 4.5 22 5 24 C5.3 25.2 6 26 6.5 25 C7 24 7 20 9 20 C11 20 11 24 11.5 25 C12 26 12.7 25.2 13 24 C13.5 22 14 18 15 16 C16 14 17 11 17 7 C17 3 15 2 15 2 C13 1 11 1 9 1 C7 1 5 1 3 2 Z" fill="#949DA6"/>
  </svg>`;
}

// SVG dente molar: coroa mais larga com cúspides, raízes bífidas
function molarSVG() {
  return `<svg viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 3 C2 3 1 5 1 8 C1 12 2 15 3 17 C4 19 4 21 4.5 23 C4.8 24.5 5.5 25 6 24 C6.5 23 7 21 8 20 C9 19 10 19 11 20 C12 21 12.5 23 13 24 C13.5 25 14.2 24.5 14.5 23 C15 21 15 19 16 17 C17 15 18 12 18 8 C18 5 17 3 17 3 C15 1 13 1 10 1 C7 1 4 1 2 3 Z" fill="#949DA6"/>
  </svg>`;
}

const PERM_UPPER_R = [18,17,16,15,14,13,12,11];
const PERM_UPPER_L = [21,22,23,24,25,26,27,28];
const PERM_LOWER_L = [31,32,33,34,35,36,37,38];
const PERM_LOWER_R = [48,47,46,45,44,43,42,41];

const DEC_UPPER_R  = [55,54,53,52,51];
const DEC_UPPER_L  = [61,62,63,64,65];
const DEC_LOWER_L  = [71,72,73,74,75];
const DEC_LOWER_R  = [85,84,83,82,81];

// molares: terminam em 6,7,8 (permanente) ou 4,5 (decídua)
function isMolar(n) {
  const u = n % 10;
  return u === 6 || u === 7 || u === 8;
}
function isMolarDec(n) {
  const u = n % 10;
  return u === 4 || u === 5;
}

function buildTeeth(containerId, numbers, decType) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  numbers.forEach(n => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tooth-btn';
    btn.dataset.tooth = n;
    const useMolar = decType ? isMolarDec(n) : isMolar(n);
    btn.innerHTML = `
      <div class="tooth-icon">${useMolar ? molarSVG() : toothSVG()}</div>
      <span class="tooth-num">${n}</span>`;
    btn.addEventListener('click', () => selectTooth(n));
    el.appendChild(btn);
  });
}

function initOdontograma() {
  buildTeeth('teeth-18-11', PERM_UPPER_R, false);
  buildTeeth('teeth-21-28', PERM_UPPER_L, false);
  buildTeeth('teeth-48-41', PERM_LOWER_R, false);
  buildTeeth('teeth-31-38', PERM_LOWER_L, false);
  buildTeeth('teeth-55-51', DEC_UPPER_R, true);
  buildTeeth('teeth-61-65', DEC_UPPER_L, true);
  buildTeeth('teeth-85-81', DEC_LOWER_R, true);
  buildTeeth('teeth-71-75', DEC_LOWER_L, true);
}

function switchArch(type) {
  document.querySelectorAll('.odonto-tab').forEach((t, i) => {
    t.classList.toggle('active', (type === 'permanente' && i === 0) || (type === 'decidua' && i === 1));
  });
  document.getElementById('archPermanente').classList.toggle('active', type === 'permanente');
  document.getElementById('archDecidua').classList.toggle('active',    type === 'decidua');
  clearTooth();
}

let selectedTeeth = [];

function selectTooth(num) {
  const idx = selectedTeeth.indexOf(num);
  if (idx > -1) {
    // já estava selecionado → remove
    selectedTeeth.splice(idx, 1);
    document.querySelectorAll(`.tooth-btn[data-tooth="${num}"]`)
      .forEach(b => b.classList.remove('selected'));
  } else {
    // adiciona seleção
    selectedTeeth.push(num);
    document.querySelectorAll(`.tooth-btn[data-tooth="${num}"]`)
      .forEach(b => b.classList.add('selected'));
  }
  updateOdontoLabel();
}

function updateOdontoLabel() {
  const inp = document.getElementById('dente');
  const lbl = document.getElementById('odontoLabel');
  if (selectedTeeth.length === 0) {
    inp.value = '';
    lbl.textContent = 'Nenhum dente selecionado';
  } else {
    const sorted = [...selectedTeeth].sort((a, b) => a - b);
    inp.value = sorted.join(',');
    lbl.textContent = `Dente${sorted.length > 1 ? 's' : ''} selecionado${sorted.length > 1 ? 's' : ''}: ${sorted.join(', ')}`;
  }
}

function clearTooth() {
  selectedTeeth = [];
  document.querySelectorAll('.tooth-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('dente').value = '';
  document.getElementById('odontoLabel').textContent = 'Nenhum dente selecionado';
}

// Inicializa ao carregar — roda depois do DOMContentLoaded principal
document.addEventListener('DOMContentLoaded', () => { initOdontograma(); selectedTeeth = []; }, false);
