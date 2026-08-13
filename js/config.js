// ============================================================
// CONFIGURAÇÃO — preencha SUPABASE_URL e SUPABASE_ANON_KEY
// (Project Settings → API, no painel do Supabase)
// ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://vlqlqoidrabscdwfrlic.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZscWxxb2lkcmFic2Nkd2ZybGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjUzMTIsImV4cCI6MjEwMjIwMTMxMn0.6KfNZv63pQrCmi5Wl_iZzvW7xRGq5cwAA3Zq10_xrXo',
  USERNAME: 'AndressaGS',
  PASSWORD: 'centrogs2025',
  CLINIC_NAME: 'Centro Clínico GS',
  // Usuário com acesso apenas ao estoque
  ESTOQUE_USERNAME: 'estoque',
  ESTOQUE_PASSWORD: 'estoque2025'
};

// O catálogo de procedimentos (antes fixo aqui) agora vive na tabela
// "procedimentos" do Supabase (ver sql/schema.sql) — carregado dinamicamente
// por getProcedimentos() em js/lancamento.js.
