// ============================================================
// Utilitários compartilhados entre todas as páginas
// ============================================================

function checkAuth() {
  if (!sessionStorage.getItem('cgs_auth')) {
    window.location.href = 'index.html';
  }
}

function logout() {
  sessionStorage.removeItem('cgs_auth');
  window.location.href = 'index.html';
}

async function apiCall(params) {
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Se não for JSON, provavelmente é página de login ou erro do Google
    throw new Error('Servidor retornou resposta inválida. Verifique se o Apps Script está publicado como "Qualquer pessoa" (sem necessidade de login). Resposta: ' + text.slice(0, 200));
  }
}

function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
