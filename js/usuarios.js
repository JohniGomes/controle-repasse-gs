// ============================================================
// Administração de usuários (só master)
// Toda ação passa pelo banco, que confere o token do master.
// ============================================================

let usuarios = [];
let codigoClinica = '';
let codigoVisivel = false;

const PAPEIS = { master: 'Master', recepcao: 'Recepção', estoque: 'Estoque' };

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  if (!sessionStorage.getItem('cgs_token')) {
    // Sessão aberta antes do sistema de tokens — pede novo login
    showToast('Entre novamente para acessar esta tela', 'warning');
    setTimeout(logout, 1200);
    return;
  }
  showLoader(true);
  await Promise.all([carregarUsuarios(), carregarCodigo()]);
  showLoader(false);
});

function showLoader(show) {
  document.getElementById('pageLoader').style.display = show ? 'flex' : 'none';
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ehEu(u) {
  return String(u.usuario).toLowerCase() === String(sessionStorage.getItem('cgs_user') || '').toLowerCase();
}

// ── Usuários ──────────────────────────────────────────────────
async function carregarUsuarios() {
  const res = await apiCall({ action: 'listarUsuarios' });
  if (res.error) {
    showToast(res.error, 'error');
    if (/entre novamente|negado/i.test(res.error)) setTimeout(logout, 1500);
    return;
  }
  usuarios = res.data || [];
  renderTabela();
}

function renderTabela() {
  const tbody = document.getElementById('usuariosBody');
  if (!usuarios.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>Nenhum usuário.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map(u => {
    const eu = ehEu(u);
    const opcoes = Object.entries(PAPEIS)
      .map(([v, t]) => `<option value="${v}"${u.papel === v ? ' selected' : ''}>${t}</option>`).join('');
    const status = u.ativo
      ? '<span style="display:inline-block;padding:.18rem .65rem;border-radius:20px;font-size:.72rem;font-weight:700;background:#dcfce7;color:#16a34a">ATIVO</span>'
      : '<span style="display:inline-block;padding:.18rem .65rem;border-radius:20px;font-size:.72rem;font-weight:700;background:#fee2e2;color:#dc2626">DESATIVADO</span>';

    return `
    <tr${u.ativo ? '' : ' style="opacity:.6"'}>
      <td style="font-weight:600">${esc(u.nome)}${eu ? ' <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(você)</span>' : ''}</td>
      <td>${esc(u.usuario)}</td>
      <td>
        <select class="form-select" style="min-width:120px" ${eu ? 'disabled title="Você não pode alterar o seu próprio perfil"' : ''}
                onchange="mudarPapel('${u.id}', this)">${opcoes}</select>
      </td>
      <td>${status}</td>
      <td style="color:var(--text-muted);font-size:.82rem">${formatDate(u.created_at)}</td>
      <td>
        ${eu ? '<span style="font-size:.76rem;color:var(--text-muted)">—</span>' : `
        <button class="btn btn-outline btn-sm" onclick="abrirSenha('${u.id}')">Redefinir senha</button>
        <button class="btn btn-sm ${u.ativo ? 'btn-danger' : 'btn-success'}" onclick="alternarAtivo('${u.id}')">${u.ativo ? 'Desativar' : 'Ativar'}</button>`}
      </td>
    </tr>`;
  }).join('');
}

async function alternarAtivo(id) {
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  const novo = !u.ativo;
  const msg = novo
    ? `Reativar "${u.nome}"?`
    : `Desativar "${u.nome}"? A pessoa perde o acesso na hora. O histórico de lançamentos dela continua.`;
  if (!confirm(msg)) return;

  const res = await apiCall({ action: 'definirAtivoUsuario', id, ativo: novo });
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast(novo ? 'Usuário reativado' : 'Usuário desativado');
  await carregarUsuarios();
}

async function mudarPapel(id, select) {
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  const novo = select.value;
  if (novo === u.papel) return;

  if (!confirm(`Mudar o perfil de "${u.nome}" para ${PAPEIS[novo]}? A pessoa será desconectada e precisa entrar de novo.`)) {
    select.value = u.papel;
    return;
  }
  const res = await apiCall({ action: 'definirPapelUsuario', id, papel: novo });
  if (res.error) { showToast(res.error, 'error'); select.value = u.papel; return; }
  showToast('Perfil atualizado');
  await carregarUsuarios();
}

function abrirSenha(id) {
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  document.getElementById('senhaUsuarioId').value = id;
  document.getElementById('senhaUsuarioNome').textContent = `${u.nome} (${u.usuario})`;
  document.getElementById('senhaNova').value = '';
  openModal('modalSenha');
}

async function confirmarSenha() {
  const id = document.getElementById('senhaUsuarioId').value;
  const senhaNova = document.getElementById('senhaNova').value;
  if (senhaNova.length < 6) { showToast('A senha precisa ter pelo menos 6 caracteres', 'warning'); return; }

  const res = await apiCall({ action: 'redefinirSenhaUsuario', id, senhaNova });
  if (res.error) { showToast(res.error, 'error'); return; }
  closeModal('modalSenha');
  showToast('Senha redefinida');
}

// ── Código da clínica ─────────────────────────────────────────
async function carregarCodigo() {
  const res = await apiCall({ action: 'obterCodigoClinica' });
  if (res.error) { showToast(res.error, 'error'); return; }
  codigoClinica = res.codigo || '';
  pintarCodigo();
}

function pintarCodigo() {
  const input = document.getElementById('codigoAtual');
  input.type  = codigoVisivel ? 'text' : 'password';
  input.value = codigoVisivel ? codigoClinica : '••••••';
  document.getElementById('btnVerCodigo').textContent = codigoVisivel ? 'Ocultar' : 'Mostrar';
}

function toggleCodigo() {
  codigoVisivel = !codigoVisivel;
  pintarCodigo();
}

async function salvarCodigo() {
  const codigo = document.getElementById('codigoNovo').value.trim();
  if (codigo.length < 6) { showToast('O código precisa ter pelo menos 6 caracteres', 'warning'); return; }
  if (!confirm('Trocar o código da clínica? Quem ainda não se cadastrou vai precisar do código novo.')) return;

  const res = await apiCall({ action: 'definirCodigoClinica', codigo });
  if (res.error) { showToast(res.error, 'error'); return; }
  document.getElementById('codigoNovo').value = '';
  codigoClinica = codigo;
  codigoVisivel = true;
  pintarCodigo();
  showToast('Código da clínica atualizado');
}

// Fechar modal clicando fora
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});
