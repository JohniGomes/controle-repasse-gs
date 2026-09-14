-- ============================================================
-- Trava o repasse de Convênio em 35% do valor DIRETO NO BANCO.
-- Mesmo que alguém edite por fora da tela normal (ou um bug futuro
-- na interface deixe passar), o banco corrige automaticamente antes
-- de salvar. Elimina de vez o tipo de erro de digitação encontrado
-- (ex: repasse R$650 num lançamento de R$59,53).
-- Rode uma vez no SQL Editor do Supabase.
-- ============================================================

create or replace function trava_repasse_convenio()
returns trigger as $$
begin
  if new.tipo = 'Convênio' then
    new.repasse = round(new.valor * 0.35, 2);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_trava_repasse_convenio on lancamentos;
create trigger trg_trava_repasse_convenio
before insert or update on lancamentos
for each row execute function trava_repasse_convenio();
