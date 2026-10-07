// ============================================================
// Utilitários compartilhados entre todas as páginas
// ============================================================

// Páginas liberadas por papel
//   master   → tudo
//   recepcao → só lançamento e dashboard
//   estoque  → só estoque
const ROLE_PAGES = {
  master:   ['lancamento.html', 'dashboard.html', 'estoque.html', 'usuarios.html'],
  recepcao: ['lancamento.html', 'dashboard.html'],
  estoque:  ['estoque.html']
};

function homeForRole(role) {
  return role === 'estoque' ? 'estoque.html' : 'lancamento.html';
}

function checkAuth() {
  const auth = sessionStorage.getItem('cgs_auth');
  if (!auth) { window.location.href = 'index.html'; return; }

  const role    = sessionStorage.getItem('cgs_role');
  const current = location.pathname.split('/').pop() || 'index.html';
  const allowed = ROLE_PAGES[role];

  // Sessão sem papel válido (ex: login antigo) → pede login de novo
  if (!allowed) { logout(); return; }

  // Página não liberada pro papel → manda pra tela inicial dele
  if (!allowed.includes(current)) {
    window.location.href = homeForRole(role);
    return;
  }

  // Esconde itens de menu que o papel não pode usar (data-hide-for="recepcao")
  document.querySelectorAll('[data-hide-for]').forEach(el => {
    if (el.dataset.hideFor.split(',').includes(role)) el.style.display = 'none';
  });
}

function getUserRole() {
  return sessionStorage.getItem('cgs_role') || '';
}

function logout() {
  ['cgs_auth', 'cgs_role', 'cgs_user', 'cgs_nome', 'cgs_token'].forEach(k => sessionStorage.removeItem(k));
  window.location.href = 'index.html';
}

function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(val) {
  if (!val) return '';
  // Pega apenas os 10 primeiros chars (yyyy-MM-dd) e usa noon para evitar problemas de timezone
  const str = String(val).slice(0, 10);
  const d = new Date(str + 'T12:00:00');
  return isNaN(d) ? str : d.toLocaleDateString('pt-BR');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast-msg toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 400); }, 3000);
}
