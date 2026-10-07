-- ============================================================
-- Administração de usuários (tela do master)
-- Rode DEPOIS de migration_usuarios.sql e migration_senhas.sql.
-- Sem nada para editar. Seguro rodar mais de uma vez.
--
-- Cria sessões com token verificado no banco: o login passa a devolver
-- um token, e toda função de administração confere no banco se o token
-- é de um MASTER ativo — não confia no que o navegador diz.
-- ============================================================

create table if not exists sessoes (
  token       uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default (now() + interval '12 hours')
);
alter table sessoes enable row level security;
revoke all on sessoes from anon, authenticated;

-- Login agora também devolve o token da sessão
drop function if exists login_usuario(text, text);
create function login_usuario(p_usuario text, p_senha text)
returns table (id uuid, nome text, usuario text, papel text, token uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v       public.usuarios%rowtype;
  v_token uuid;
begin
  delete from public.sessoes where expira_em < now();

  select * into v
  from public.usuarios u
  where lower(u.usuario) = lower(trim(p_usuario))
    and u.ativo
    and u.senha_hash = crypt(p_senha, u.senha_hash);

  if not found then
    return;
  end if;

  insert into public.sessoes (usuario_id) values (v.id) returning sessoes.token into v_token;
  return query select v.id, v.nome, v.usuario, v.papel, v_token;
end;
$$;
revoke all on function login_usuario(text, text) from public;
grant execute on function login_usuario(text, text) to anon, authenticated;

-- Uso interno: devolve o id do master dono do token (ou null)
create or replace function sessao_master(p_token uuid)
returns uuid
language sql security definer set search_path = public as $$
  select u.id
  from public.sessoes s
  join public.usuarios u on u.id = s.usuario_id
  where s.token = p_token and s.expira_em > now() and u.ativo and u.papel = 'master'
$$;
revoke all on function sessao_master(uuid) from public;

-- Lista todos os usuários (sem o hash da senha)
create or replace function listar_usuarios(p_token uuid)
returns table (id uuid, nome text, usuario text, papel text, ativo boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if sessao_master(p_token) is null then
    raise exception 'Acesso negado';
  end if;
  return query
    select u.id, u.nome, u.usuario, u.papel, u.ativo, u.created_at
    from public.usuarios u
    order by u.ativo desc, u.nome;
end;
$$;

-- Ativar / desativar (desativar também derruba as sessões abertas da pessoa)
create or replace function definir_ativo_usuario(p_token uuid, p_id uuid, p_ativo boolean)
returns json
language plpgsql security definer set search_path = public as $$
declare v_master uuid := sessao_master(p_token);
begin
  if v_master is null then return json_build_object('error', 'Acesso negado'); end if;
  if p_id = v_master and not p_ativo then
    return json_build_object('error', 'Você não pode desativar a sua própria conta');
  end if;
  update public.usuarios set ativo = p_ativo where id = p_id;
  if not p_ativo then delete from public.sessoes where usuario_id = p_id; end if;
  return json_build_object('success', true);
end;
$$;

-- Trocar o perfil (master / recepcao / estoque)
create or replace function definir_papel_usuario(p_token uuid, p_id uuid, p_papel text)
returns json
language plpgsql security definer set search_path = public as $$
declare v_master uuid := sessao_master(p_token);
begin
  if v_master is null then return json_build_object('error', 'Acesso negado'); end if;
  if p_papel not in ('master', 'recepcao', 'estoque') then
    return json_build_object('error', 'Perfil inválido');
  end if;
  if p_id = v_master then
    return json_build_object('error', 'Você não pode alterar o seu próprio perfil');
  end if;
  update public.usuarios set papel = p_papel where id = p_id;
  delete from public.sessoes where usuario_id = p_id;  -- força novo login com o novo perfil
  return json_build_object('success', true);
end;
$$;

-- Master define uma nova senha para outra pessoa (a pessoa pode trocar depois em "Alterar senha")
create or replace function redefinir_senha_usuario(p_token uuid, p_id uuid, p_senha_nova text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_master uuid := sessao_master(p_token);
begin
  if v_master is null then return json_build_object('error', 'Acesso negado'); end if;
  if p_id = v_master then
    return json_build_object('error', 'Para a sua própria senha use "Alterar senha" na tela de login');
  end if;
  if length(coalesce(p_senha_nova, '')) < 6 then
    return json_build_object('error', 'A senha precisa ter pelo menos 6 caracteres');
  end if;
  update public.usuarios set senha_hash = crypt(p_senha_nova, gen_salt('bf')) where id = p_id;
  delete from public.sessoes where usuario_id = p_id;
  return json_build_object('success', true);
end;
$$;

-- Código da clínica (usado no "Criar usuário" e no "Esqueci a senha")
create or replace function obter_codigo_clinica(p_token uuid)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if sessao_master(p_token) is null then return json_build_object('error', 'Acesso negado'); end if;
  return json_build_object('codigo', (select valor from public.config_clinica where chave = 'codigo_convite'));
end;
$$;

create or replace function definir_codigo_clinica(p_token uuid, p_codigo text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if sessao_master(p_token) is null then return json_build_object('error', 'Acesso negado'); end if;
  if length(trim(coalesce(p_codigo, ''))) < 6 then
    return json_build_object('error', 'O código precisa ter pelo menos 6 caracteres');
  end if;
  insert into public.config_clinica (chave, valor) values ('codigo_convite', trim(p_codigo))
  on conflict (chave) do update set valor = excluded.valor;
  return json_build_object('success', true);
end;
$$;

revoke all on function listar_usuarios(uuid)                        from public;
revoke all on function definir_ativo_usuario(uuid, uuid, boolean)  from public;
revoke all on function definir_papel_usuario(uuid, uuid, text)     from public;
revoke all on function redefinir_senha_usuario(uuid, uuid, text)  from public;
revoke all on function obter_codigo_clinica(uuid)                  from public;
revoke all on function definir_codigo_clinica(uuid, text)          from public;
grant execute on function listar_usuarios(uuid)                        to anon, authenticated;
grant execute on function definir_ativo_usuario(uuid, uuid, boolean)  to anon, authenticated;
grant execute on function definir_papel_usuario(uuid, uuid, text)     to anon, authenticated;
grant execute on function redefinir_senha_usuario(uuid, uuid, text)   to anon, authenticated;
grant execute on function obter_codigo_clinica(uuid)                  to anon, authenticated;
grant execute on function definir_codigo_clinica(uuid, text)          to anon, authenticated;
