-- ============================================================
-- Usuários individuais + papéis (master / recepcao / estoque)
--
-- ANTES DE RODAR: edite os 4 valores marcados com TROQUE_ no bloco
-- "DO" lá no final deste arquivo (senha do master, senha do estoque,
-- código de convite da clínica). Edite só aqui no SQL Editor do
-- Supabase — não salve essas senhas em nenhum arquivo do projeto.
-- É seguro rodar mais de uma vez.
-- ============================================================

create extension if not exists pgcrypto;

-- ── Usuários ─────────────────────────────────────────────────
create table if not exists usuarios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  usuario     text not null,
  senha_hash  text not null,                 -- bcrypt, nunca a senha pura
  papel       text not null check (papel in ('master','recepcao','estoque')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists usuarios_usuario_unq on usuarios (lower(usuario));

-- Configurações internas da clínica (ex: código de convite para criar conta)
create table if not exists config_clinica (
  chave  text primary key,
  valor  text not null
);

-- Ninguém lê essas tabelas pela API (nem os hashes, nem o código de convite).
-- Só as funções abaixo (security definer) acessam.
alter table usuarios       enable row level security;
alter table config_clinica enable row level security;
revoke all on usuarios       from anon, authenticated;
revoke all on config_clinica from anon, authenticated;

-- ── Login: confere usuário + senha no banco ───────────────────
create or replace function login_usuario(p_usuario text, p_senha text)
returns table (id uuid, nome text, usuario text, papel text)
language sql security definer set search_path = public, extensions as $$
  select u.id, u.nome, u.usuario, u.papel
  from public.usuarios u
  where lower(u.usuario) = lower(trim(p_usuario))
    and u.ativo
    and u.senha_hash = crypt(p_senha, u.senha_hash)
$$;

-- ── Criar usuário (auto-cadastro da recepção) ─────────────────
-- Exige o código de convite da clínica; a conta nasce SEMPRE como
-- 'recepcao' (lançamento + dashboard). Master/estoque só pelo SQL.
create or replace function criar_usuario(p_nome text, p_usuario text, p_senha text, p_codigo text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_codigo text;
begin
  select valor into v_codigo from public.config_clinica where chave = 'codigo_convite';
  if v_codigo is null or p_codigo is distinct from v_codigo then
    return json_build_object('error', 'Código da clínica inválido');
  end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then
    return json_build_object('error', 'Informe o nome completo');
  end if;
  if length(trim(coalesce(p_usuario, ''))) < 3 then
    return json_build_object('error', 'O usuário precisa ter pelo menos 3 caracteres');
  end if;
  if length(coalesce(p_senha, '')) < 6 then
    return json_build_object('error', 'A senha precisa ter pelo menos 6 caracteres');
  end if;
  if exists (select 1 from public.usuarios where lower(usuario) = lower(trim(p_usuario))) then
    return json_build_object('error', 'Esse usuário já existe — escolha outro');
  end if;

  insert into public.usuarios (nome, usuario, senha_hash, papel)
  values (trim(p_nome), lower(trim(p_usuario)), crypt(p_senha, gen_salt('bf')), 'recepcao');

  return json_build_object('success', true);
end;
$$;

revoke all on function login_usuario(text, text)            from public;
revoke all on function criar_usuario(text, text, text, text) from public;
grant execute on function login_usuario(text, text)            to anon, authenticated;
grant execute on function criar_usuario(text, text, text, text) to anon, authenticated;

-- ── Quem alterou cada lançamento ──────────────────────────────
-- O app grava o usuário logado aqui a cada criação/edição; o histórico
-- (lancamentos_historico) já copia a linha inteira, então fica registrado
-- quem fez cada mudança.
alter table lancamentos add column if not exists alterado_por text;

-- ── Contas iniciais + código de convite ───────────────────────
do $$
declare
  v_usuario_master text := 'AndressaGS';
  v_senha_master   text := 'TROQUE_A_SENHA_DO_MASTER';
  v_usuario_estoq  text := 'estoque';
  v_senha_estoque  text := 'TROQUE_A_SENHA_DO_ESTOQUE';
  v_codigo         text := 'TROQUE_O_CODIGO_DA_CLINICA';
begin
  if v_senha_master like 'TROQUE_%' or v_senha_estoque like 'TROQUE_%' or v_codigo like 'TROQUE_%' then
    raise exception 'Edite os valores TROQUE_ no bloco DO antes de rodar (senhas e código da clínica).';
  end if;
  if length(v_senha_master) < 8 then
    raise exception 'Use uma senha de master com pelo menos 8 caracteres.';
  end if;

  insert into usuarios (nome, usuario, senha_hash, papel)
  select 'Administração da Clínica', v_usuario_master, crypt(v_senha_master, gen_salt('bf')), 'master'
  where not exists (select 1 from usuarios where lower(usuario) = lower(v_usuario_master));

  insert into usuarios (nome, usuario, senha_hash, papel)
  select 'Estoque', v_usuario_estoq, crypt(v_senha_estoque, gen_salt('bf')), 'estoque'
  where not exists (select 1 from usuarios where lower(usuario) = lower(v_usuario_estoq));

  insert into config_clinica (chave, valor) values ('codigo_convite', v_codigo)
  on conflict (chave) do update set valor = excluded.valor;
end;
$$;
