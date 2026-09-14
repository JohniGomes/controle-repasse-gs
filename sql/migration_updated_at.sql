-- ============================================================
-- Adiciona rastreio de "última edição" em lancamentos.
-- Sem isso, não há como saber se um valor errado (ex: repasse
-- digitado errado por engano) já foi corrigido ou nunca mudou.
-- Rode uma vez no SQL Editor do Supabase.
-- ============================================================

alter table lancamentos add column if not exists updated_at timestamptz not null default now();

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lancamentos_updated_at on lancamentos;
create trigger trg_lancamentos_updated_at
before update on lancamentos
for each row execute function set_updated_at();
