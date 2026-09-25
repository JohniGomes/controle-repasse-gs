-- ============================================================
-- Centro Clínico GS — Schema Supabase (Postgres)
-- Substitui o backend Google Sheets/Apps Script
-- ============================================================

create extension if not exists pgcrypto;

-- ── Dentistas ────────────────────────────────────────────────
create table dentistas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index dentistas_nome_unq on dentistas (lower(trim(nome)));

-- ── Convênios ────────────────────────────────────────────────
create table convenios (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index convenios_nome_unq on convenios (lower(trim(nome)));

-- ── Procedimentos ────────────────────────────────────────────
-- Unifica o catálogo fixo (antes hardcoded em config.js) com os
-- personalizados (antes na aba "Procedimentos" da planilha).
create table procedimentos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  repasse_fixo numeric(10,2),        -- null = repasse manual/variável
  sistema      boolean not null default false,  -- true = catálogo original, protegido contra exclusão
  created_at   timestamptz not null default now()
);
create unique index procedimentos_nome_unq on procedimentos (lower(trim(nome)));

-- ── Lançamentos ──────────────────────────────────────────────
create table lancamentos (
  id                uuid primary key default gen_random_uuid(),
  data              date not null,
  dentista_id       uuid references dentistas(id),
  dentista_nome     text not null,     -- snapshot: nunca muda mesmo se o dentista for renomeado
  paciente          text not null,
  procedimento_nome text not null,     -- snapshot: procedimento pode ser excluído sem quebrar histórico
  tipo              text not null check (tipo in ('Particular','Convênio','Rascunho')),
  convenio_nome     text default '',
  valor             numeric(10,2) not null default 0,
  repasse           numeric(10,2) not null default 0,
  dente             text default '',
  gto               text default '',
  glosado           boolean not null default false,
  pendente          boolean not null default false,
  estornado         boolean not null default false,
  data_estorno      date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()  -- atualizado via trigger, ver abaixo
);
create index lancamentos_data_idx     on lancamentos (data);
create index lancamentos_dentista_idx on lancamentos (dentista_id);
create index lancamentos_tipo_idx     on lancamentos (tipo);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_lancamentos_updated_at
before update on lancamentos
for each row execute function set_updated_at();

-- Convênio: repasse é sempre 35% do valor, travado no banco (não é
-- uma sugestão da interface — nenhuma edição, por qualquer caminho,
-- consegue gravar um valor diferente disso).
create or replace function trava_repasse_convenio()
returns trigger as $$
begin
  if new.tipo = 'Convênio' then
    new.repasse = round(new.valor * 0.35, 2);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_trava_repasse_convenio
before insert or update on lancamentos
for each row execute function trava_repasse_convenio();

-- Histórico completo e imutável de todas as edições em lancamentos
-- (criação, alteração, exclusão) — guarda o estado antes/depois de cada
-- mudança para sempre, para auditoria. A role anon só tem permissão de
-- leitura; só o trigger (security definer) consegue gravar.
create table lancamentos_historico (
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

create trigger trg_lancamentos_historico
after insert or update or delete on lancamentos
for each row execute function log_lancamento_historico();

-- ── Metas Mensais ────────────────────────────────────────────
create table metas (
  id                 uuid primary key default gen_random_uuid(),
  mes                text not null check (mes ~ '^\d{4}-\d{2}$'),  -- 'YYYY-MM'
  dentista_id        uuid references dentistas(id),
  dentista_nome      text not null,
  meta_particulares  integer,
  meta_indicacoes    integer,
  meta_valor_rs      numeric(10,2),
  updated_at         timestamptz not null default now(),
  unique (mes, dentista_id)
);

-- ── Estoque ──────────────────────────────────────────────────
create table estoque (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null,
  categoria              text default '',
  qtd_atual              numeric(10,2) not null default 0,
  qtd_min                numeric(10,2) not null default 0,
  unidade                text not null default 'Unidade',
  ultimo_reabastecimento timestamptz,
  created_at             timestamptz not null default now()
);

-- ============================================================
-- RLS — libera CRUD completo para a role anon (mesma postura de
-- segurança do Apps Script atual, que já roda como "Qualquer
-- pessoa" sem exigir login; o login do app é só client-side).
-- ============================================================
alter table dentistas    enable row level security;
alter table convenios    enable row level security;
alter table procedimentos enable row level security;
alter table lancamentos  enable row level security;
alter table metas        enable row level security;
alter table estoque      enable row level security;

create policy anon_all on dentistas     for all using (true) with check (true);
create policy anon_all on convenios     for all using (true) with check (true);
create policy anon_all on procedimentos for all using (true) with check (true);
create policy anon_all on lancamentos   for all using (true) with check (true);
create policy anon_all on metas         for all using (true) with check (true);
create policy anon_all on estoque       for all using (true) with check (true);

-- ============================================================
-- Seed: catálogo fixo de procedimentos (antes em js/config.js)
-- ============================================================
insert into procedimentos (nome, repasse_fixo, sistema) values
  ('CONSULTA / PROFILAXIA / RASPAGEM', 60,  true),
  ('CLAREAMENTO DE CONSULTÓRIO (por sessão)', 200, true),
  ('RESTAURAÇÃO', 55, true),
  ('COROA EM PORCELANA', 250, true),
  ('CANAL I/C/PM', 180, true),
  ('CANAL M', 300, true),
  ('RETRATAMENTO I/C/PM', 210, true),
  ('RETRATAMENTO M', 400, true),
  ('PRÓTESE TOTAL', 300, true),
  ('PPR', 350, true),
  ('COROA CEROMERO / ONLAY / INLAY', 170, true),
  ('IMPLANTE DENTÁRIO — CIRURGIA', 400, true),
  ('IMPLANTE — COROA', 400, true),
  ('INTER CONSULTA IMPLANTE', 150, true),
  ('EXTRAÇÃO SIMPLES', 75, true),
  ('EXTRAÇÃO SISO', 120, true),
  ('EXTRAÇÃO COMPLEXA', 200, true),
  ('FACETAS PORCELANA (por dente)', 350, true),
  ('FACETAS RESINA (por dente)', 150, true),
  ('PINO DE FIBRA DE VIDRO', 70, true),
  ('PLACA MIORELAXANTE', 150, true),
  ('PPA', 170, true),
  ('REMOÇÃO DE APARELHO ORTODÔNTICO', 80, true),
  ('PLACA DE CLAREAMENTO', 50, true),
  ('SERINGA DE CLAREAMENTO', 30, true),
  ('PROVISÓRIO', 75, true),
  ('RECIMENTAÇÃO', 60, true),
  ('MANTENEDOR', 90, true),
  ('ENDO DECÍDUO', 120, true),
  ('PROTOCOLO DE VERNIZ', 100, true),
  ('SELANTE', 40, true);
