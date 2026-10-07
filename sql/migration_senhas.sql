-- ============================================================
-- Alterar senha + Esqueci a senha
-- Rode DEPOIS de sql/migration_usuarios.sql. Sem nada para editar.
-- ============================================================

-- Alterar senha: precisa da senha atual. Vale para qualquer conta.
create or replace function alterar_senha(p_usuario text, p_senha_atual text, p_senha_nova text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  if length(coalesce(p_senha_nova, '')) < 6 then
    return json_build_object('error', 'A nova senha precisa ter pelo menos 6 caracteres');
  end if;

  select u.id into v_id
  from public.usuarios u
  where lower(u.usuario) = lower(trim(p_usuario))
    and u.ativo
    and u.senha_hash = crypt(p_senha_atual, u.senha_hash);

  if v_id is null then
    return json_build_object('error', 'Usuário ou senha atual incorretos');
  end if;

  update public.usuarios set senha_hash = crypt(p_senha_nova, gen_salt('bf')) where id = v_id;
  return json_build_object('success', true);
end;
$$;

-- Esqueci a senha: usuário + código da clínica + nova senha.
-- SÓ para contas de recepção. Master e estoque NÃO podem ser redefinidos
-- por aqui (o código é compartilhado com a recepção) — para essas, a
-- redefinição é feita direto no SQL Editor pela administração.
create or replace function redefinir_senha(p_usuario text, p_codigo text, p_senha_nova text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_codigo text;
  v_id     uuid;
begin
  select valor into v_codigo from public.config_clinica where chave = 'codigo_convite';
  if v_codigo is null or p_codigo is distinct from v_codigo then
    return json_build_object('error', 'Código da clínica inválido');
  end if;
  if length(coalesce(p_senha_nova, '')) < 6 then
    return json_build_object('error', 'A nova senha precisa ter pelo menos 6 caracteres');
  end if;

  select u.id into v_id
  from public.usuarios u
  where lower(u.usuario) = lower(trim(p_usuario))
    and u.ativo
    and u.papel = 'recepcao';

  if v_id is null then
    return json_build_object('error', 'Não foi possível redefinir essa conta. Procure a administração.');
  end if;

  update public.usuarios set senha_hash = crypt(p_senha_nova, gen_salt('bf')) where id = v_id;
  return json_build_object('success', true);
end;
$$;

revoke all on function alterar_senha(text, text, text)   from public;
revoke all on function redefinir_senha(text, text, text) from public;
grant execute on function alterar_senha(text, text, text)   to anon, authenticated;
grant execute on function redefinir_senha(text, text, text) to anon, authenticated;
