// ============================================================
// Lógica do Estoque
// ============================================================

let estoqueData  = [];
let categorias   = [];

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  showLoader(true);
  await loadEstoque();
  showLoader(false);
});

// ── Carregamento ──────────────────────────────────────────────
async function loadEstoque() {
  try {
    const res = await apiCall({ action: 'getEstoque' });
    if (res.error) { showToast('Erro: ' + res.error, 'error'); return; }
    estoqueData = res.data || [];
    // Extrai categorias únicas dos itens cadastrados
    atualizarCategorias();
    renderTabela();
    renderSummary();
  } catch (e) {
    showToast('Erro de conexão: ' + (e.message || e), 'error');
  }
}

function atualizarCategorias() {
  const set = new Set(estoqueData.map(i => i.categoria).filter(Boolean));
  // Adiciona categorias extras salvas localmente que ainda não têm itens
  categorias.forEach(c => set.add(c));
  categorias = [...set].sort();
  renderCategoriaSelects();
}

function renderCategoriaSelects() {
  ['itemCategoria', 'filtroCategoria'].forEach(id => {
    const sel = document.getElementById(id);
    const current = sel.value;
    // Mantém placeholder/opção vazia
    const placeholder = id === 'filtroCategoria'
      ? '<option value="">Todas as categorias</option>'
      : '<option value="">Selecione...</option>';
    sel.innerHTML = placeholder + categorias.map(c =>
      `<option value="${c}"${c === current ? ' selected' : ''}>${c}</option>`
    ).join('');
  });
}

// ── Summary ───────────────────────────────────────────────────
function renderSummary() {
  const total   = estoqueData.length;
  const critico = estoqueData.filter(i => Number(i.qtdAtual) === 0).length;

  document.getElementById('summaryTotal').textContent   = total;
  document.getElementById('summaryCritico').textContent = critico;
}

// ── Tabela ────────────────────────────────────────────────────
function renderTabela() {
  const catFiltro    = document.getElementById('filtroCategoria').value;
  const statusFiltro = document.getElementById('filtroStatus').value;

  let dados = estoqueData.filter(i => {
    if (catFiltro && i.categoria !== catFiltro) return false;
    if (statusFiltro) {
      const s = getStatus(i);
      if (statusFiltro !== s) return false;
    }
    return true;
  });

  const tbody = document.getElementById('estoqueBody');
  if (!dados.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>Nenhum item encontrado.</p></div></td></tr>';
    return;
  }

  // Ordena: crítico → baixo → ok, depois por nome
  dados = dados.sort((a, b) => {
    const order = { critico: 0, baixo: 1, ok: 2 };
    const diff = order[getStatus(a)] - order[getStatus(b)];
    return diff !== 0 ? diff : a.nome.localeCompare(b.nome);
  });

  tbody.innerHTML = dados.map((item, _) => {
    const st      = getStatus(item);
    const badgeHtml = statusBadge(st);
    const rowIdx  = item._rowIndex;
    return `
    <tr>
      <td style="font-weight:600">${item.nome}</td>
      <td><span style="font-size:.8rem;color:var(--text-muted)">${item.categoria || '—'}</span></td>
      <td><span style="font-size:.8rem;color:var(--text-muted)">${item.unidade || 'Unidade'}</span></td>
      <td style="font-weight:700;color:${st === 'critico' ? 'var(--danger)' : 'var(--success)'}">
        ${item.qtdAtual}
      </td>
      <td>${badgeHtml}</td>
      <td style="color:var(--text-muted);font-size:.82rem">${formatDate(item.ultimoReabastecimento) || '—'}</td>
      <td class="td-actions">
        <button class="btn-action" onclick="abrirMovimentacao(${rowIdx})" title="Movimentar estoque" style="color:var(--primary)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
        </button>
        <button class="btn-action" onclick="abrirEditar(${rowIdx})" title="Editar item" style="color:var(--accent)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-action btn-del" onclick="deletarItem(${rowIdx})" title="Excluir item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function getStatus(item) {
  return Number(item.qtdAtual) === 0 ? 'critico' : 'ok';
}

function statusBadge(st) {
  const map = {
    ok:      { label: 'Em estoque', color: '#16a34a', bg: '#dcfce7' },
    critico: { label: 'Zerado',     color: '#dc2626', bg: '#fee2e2' }
  };
  const { label, color, bg } = map[st] || map.ok;
  return `<span style="display:inline-block;padding:.18rem .65rem;border-radius:20px;font-size:.72rem;font-weight:700;background:${bg};color:${color};text-transform:uppercase;letter-spacing:.3px">${label}</span>`;
}

// ── Novo / Editar Item ────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function abrirEditar(rowIndex) {
  const item = estoqueData.find(i => i._rowIndex === rowIndex);
  if (!item) return;
  document.getElementById('modalItemTitulo').textContent = 'Editar Item';
  document.getElementById('editRowIndex').value  = rowIndex;
  document.getElementById('itemNome').value      = item.nome;
  document.getElementById('itemUnidade').value   = item.unidade || 'Unidade';
  document.getElementById('itemQtdAtual').value  = item.qtdAtual;
  renderCategoriaSelects();
  document.getElementById('itemCategoria').value = item.categoria;
  openModal('modalAddItem');
}

function limparModalItem() {
  document.getElementById('modalItemTitulo').textContent = 'Cadastrar Item';
  document.getElementById('editRowIndex').value  = '';
  document.getElementById('itemNome').value      = '';
  document.getElementById('itemCategoria').value = '';
  document.getElementById('itemUnidade').value   = 'Unidade';
  document.getElementById('itemQtdAtual').value  = '';
}

// Abre modal de novo item com campos limpos
document.getElementById('modalAddItem')
  .addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('modalAddItem'); });

async function salvarItem() {
  const nome     = document.getElementById('itemNome').value.trim();
  const categoria= document.getElementById('itemCategoria').value;
  const unidade  = document.getElementById('itemUnidade').value;
  const qtdAtual = document.getElementById('itemQtdAtual').value;
  const rowIndex = document.getElementById('editRowIndex').value;

  if (!nome || !categoria || qtdAtual === '') {
    showToast('Preencha todos os campos obrigatórios', 'warning'); return;
  }

  const btn = document.querySelector('#modalAddItem .btn-primary');
  btn.disabled = true; btn.textContent = 'Salvando...';

  try {
    const params = {
      action: rowIndex ? 'updateItemEstoque' : 'addItemEstoque',
      nome, categoria, unidade,
      qtdAtual: Number(qtdAtual),
      qtdMin:   0
    };
    if (rowIndex) params.rowIndex = rowIndex;

    const res = await apiCall(params);
    if (res.error) { showToast(res.error, 'error'); return; }

    showToast(rowIndex ? 'Item atualizado!' : 'Item cadastrado!');
    closeModal('modalAddItem');
    limparModalItem();
    await loadEstoque();
  } catch (e) {
    showToast('Erro: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar';
  }
}

// ── Movimentação ──────────────────────────────────────────────
function abrirMovimentacao(rowIndex) {
  const item = estoqueData.find(i => i._rowIndex === rowIndex);
  if (!item) return;
  document.getElementById('movRowIndex').value  = rowIndex;
  document.getElementById('movItemNome').textContent = `${item.nome} — Qtd atual: ${item.qtdAtual}`;
  document.getElementById('movQtd').value = '';
  selectMovTipo('entrada');
  openModal('modalMovimentar');
}

function selectMovTipo(tipo) {
  document.getElementById('tipoEntrada').className = 'tipo-option' + (tipo === 'entrada' ? ' selected-particular' : '');
  document.getElementById('tipoSaida').className   = 'tipo-option' + (tipo === 'saida'   ? ' selected-convenio'  : '');
  document.querySelector('input[value="entrada"]').checked = tipo === 'entrada';
  document.querySelector('input[value="saida"]').checked   = tipo === 'saida';
}

async function confirmarMovimentacao() {
  const rowIndex = document.getElementById('movRowIndex').value;
  const tipo     = document.querySelector('input[name="movTipo"]:checked').value;
  const qtd      = Number(document.getElementById('movQtd').value);

  if (!qtd || qtd <= 0) { showToast('Informe uma quantidade válida', 'warning'); return; }

  const item = estoqueData.find(i => i._rowIndex === Number(rowIndex));
  if (tipo === 'saida' && qtd > Number(item.qtdAtual)) {
    showToast('Quantidade insuficiente em estoque', 'warning'); return;
  }

  const btn = document.querySelector('#modalMovimentar .btn-primary');
  btn.disabled = true; btn.textContent = 'Salvando...';

  try {
    const res = await apiCall({ action: 'movimentarEstoque', rowIndex, tipo, qtd });
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast(tipo === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!');
    closeModal('modalMovimentar');
    await loadEstoque();
  } catch (e) {
    showToast('Erro: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirmar';
  }
}

// ── Deletar ───────────────────────────────────────────────────
async function deletarItem(rowIndex) {
  if (!confirm('Excluir este item do estoque? A ação não pode ser desfeita.')) return;
  try {
    const res = await apiCall({ action: 'deleteItemEstoque', rowIndex });
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast('Item excluído');
    await loadEstoque();
  } catch (e) {
    showToast('Erro: ' + (e.message || e), 'error');
  }
}

// ── Nova Categoria ────────────────────────────────────────────
function addCategoria() {
  const nome = document.getElementById('newCategoriaNome').value.trim();
  if (!nome) { showToast('Digite um nome para a categoria', 'warning'); return; }
  if (!categorias.includes(nome)) {
    categorias.push(nome);
    categorias.sort();
    renderCategoriaSelects();
  }
  document.getElementById('itemCategoria').value = nome;
  document.getElementById('newCategoriaNome').value = '';
  closeModal('modalAddCategoria');
  // Reabre o modal de item
  openModal('modalAddItem');
}

function showLoader(show) {
  document.getElementById('pageLoader').style.display = show ? 'flex' : 'none';
}

// Abre modal novo item sempre limpo via botão "Novo Item"
document.querySelector('[onclick="openModal(\'modalAddItem\')"]')
  .addEventListener('click', () => limparModalItem(), true);
