// ============================================================
// CONFIGURAÇÃO — preencha SUPABASE_URL e SUPABASE_ANON_KEY
// (Project Settings → API, no painel do Supabase)
// ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://vlqlqoidrabscdwfrlic.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZscWxxb2lkcmFic2Nkd2ZybGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjUzMTIsImV4cCI6MjEwMjIwMTMxMn0.6KfNZv63pQrCmi5Wl_iZzvW7xRGq5cwAA3Zq10_xrXo',
  CLINIC_NAME: 'Centro Clínico GS'
  // Login: cada pessoa tem usuário e senha próprios, verificados no banco
  // (tabela "usuarios", ver sql/migration_usuarios.sql). Nenhuma senha fica aqui.
};

// O catálogo de procedimentos (antes fixo aqui) agora vive na tabela
// "procedimentos" do Supabase (ver sql/schema.sql) — carregado dinamicamente
// por getProcedimentos() em js/lancamento.js.
