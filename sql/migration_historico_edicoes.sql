-- ============================================================
-- Histórico completo e imutável de edições em lancamentos.
-- Toda vez que um lançamento é criado, editado ou excluído, uma
-- cópia do estado ANTES e DEPOIS fica gravada nesta tabela — pra
-- sempre. Ninguém apaga isso, nem o próprio Claude.
-- Rode uma vez no SQL Editor do Supabase.
-- ============================================================

create table if not exists lancamentos_historico (
  id             uuid primary key default gen_random_uuid(),
  lancamento_id  uuid not null,
  operacao       text not null check (operacao in ('INSERT','UPDATE','DELETE')),
  dados_antigos  jsonb,
  dados_novos    jsonb,
  alterado_em    timestamptz not null default now()
);
create index lancamentos_historico_lanc_idx on lancamentos_historico (lancamento_id);
create index lancamentos_historico_data_idx on lancamentos_historico (alterado_em);

alter table lancamentos_historico enable row level security;
-- Leitura liberada (mesma postura das outras tabelas); nenhuma policy de
-- insert/update/delete é criada para a role anon — só o trigger (que roda
-- como owner da função) consegue gravar. Ninguém apaga ou edita o histórico
-- pela API.
create policy anon_select on lancamentos_historico for select using (true);

create or replace function log_lancamento_historico()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into lancamentos_historico (lancamento_id, operacao, dados_antigos, dados_novos)
    values (new.id, 'INSERT', null, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into lancamentos_historico (lancamento_id, operacao, dados_antigos, dados_novos)
    values (new.id, 'UPDATE', to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into lancamentos_historico (lancamento_id, operacao, dados_antigos, dados_novos)
    values (old.id, 'DELETE', to_jsonb(old), null);
    return old;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_lancamentos_historico on lancamentos;
create trigger trg_lancamentos_historico
after insert or update or delete on lancamentos
for each row execute function log_lancamento_historico();
