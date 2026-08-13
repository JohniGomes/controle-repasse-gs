// ============================================================
// Migração de dados: Google Sheets (JSON exportado) → Supabase
//
// Uso:
//   1. npm install (dentro da pasta scripts/)
//   2. Coloque o arquivo "migracao-centrogs-raw.json" (gerado pelo
//      appsscript/migrate-export.gs) nesta mesma pasta
//   3. node migrate-import.mjs \
//        --url https://SEU-PROJETO.supabase.co \
//        --key SUA_SERVICE_ROLE_KEY
//
// IMPORTANTE: os cabeçalhos reais das planilhas de produção estão
// desalinhados/incompletos (evoluíram manualmente ao longo do tempo).
// Por isso este script lê os dados por POSIÇÃO de coluna (confirmado
// contra o Code.gs e contra amostras reais), não pelo texto do cabeçalho.
//
// A service role key fica só na sua máquina, nunca deve ir para o
// repositório nem para o frontend (js/config.js usa a anon key).
// Rode isso UMA VEZ, contra um banco recém-criado com sql/schema.sql
// já aplicado (o catálogo fixo de procedimentos precisa já existir).
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
}

const SUPABASE_URL = arg('url');
const SUPABASE_KEY = arg('key');
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Uso: node migrate-import.mjs --url <SUPABASE_URL> --key <SERVICE_ROLE_KEY>');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const raw = JSON.parse(readFileSync(join(__dirname, 'migracao-centrogs-raw.json'), 'utf-8'));

// ── Layout confirmado por posição de coluna (índice 0-based) ──
// Lancamentos: ID,Data,Dentista,Paciente,Procedimento,Tipo,Convênio,Valor,Repasse,Timestamp,Glosado,Dente,GTO,Pendente,Estornado,DataEstorno
const L = { id:0, data:1, dentista:2, paciente:3, procedimento:4, tipo:5, convenio:6, valor:7, repasse:8, timestamp:9, glosado:10, dente:11, gto:12, pendente:13, estornado:14, dataEstorno:15 };
// Dentistas / Convenios: ID,Nome,Ativo
const C = { id:0, nome:1, ativo:2 };
// Procedimentos: ID,Nome,Ativo (mesmo layout de C)
// Estoque: ID,Nome,Categoria,QtdAtual,QtdMin,UltimoReabastecimento,Unidade
const E = { id:0, nome:1, categoria:2, qtdAtual:3, qtdMin:4, ultimoReab:5, unidade:6 };
// Metas: ID,Mes,Dentista,Meta,Indicacoes,Timestamp,MetaValorRS
const M = { id:0, mes:1, dentista:2, meta:3, indicacoes:4, timestamp:5, metaValorRS:6 };

// ── Datas ──────────────────────────────────────────────────────
function fmtDate(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); // ISO (Date exportado ou já string)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function fmtMonth(v) {
  const d = fmtDate(v);
  return d ? d.slice(0, 7) : null;
}

function boolOf(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function normName(n) {
  return String(n || '').trim().toLowerCase();
}

// ── 1. Dedup Dentistas / Convenios / Procedimentos ─────────────
// Mantém um registro por nome normalizado; ativo=true se QUALQUER
// ocorrência do nome estava ativa na planilha.
function dedupCatalog(rows, idx) {
  const groups = new Map(); // nome normalizado → { nome, ativo }
  rows.forEach(r => {
    const nome = String(r[idx.nome] || '').trim();
    const key = normName(nome);
    if (!key) return;
    const ativo = boolOf(r[idx.ativo]);
    if (!groups.has(key)) groups.set(key, { nome, ativo: false });
    if (ativo) groups.get(key).ativo = true;
  });
  return [...groups.values()];
}

async function importCatalog(table, rows, idx) {
  const groups = dedupCatalog(rows, idx);
  let inserted = 0, skippedDup = 0;

  for (const g of groups) {
    const { error } = await sb.from(table).insert({ nome: g.nome, ativo: g.ativo });
    if (error) {
      if (error.code === '23505') { skippedDup++; continue; }
      console.error(`Erro ao inserir em ${table} ("${g.nome}"):`, error.message);
      continue;
    }
    inserted++;
  }

  console.log(`${table}: ${rows.length} linhas na planilha → ${groups.length} nomes únicos → ${inserted} inseridos (${skippedDup} já existiam)`);
}

async function resolveIdByName(table, nome) {
  if (!nome) return null;
  const { data } = await sb.from(table).select('id').ilike('nome', nome.trim()).limit(1).maybeSingle();
  return data ? data.id : null;
}

async function main() {
  console.log('== Migração Google Sheets → Supabase ==\n');

  // ── Dentistas / Convênios ──────────────────────────────────
  await importCatalog('dentistas', raw.Dentistas?.rows || [], C);
  await importCatalog('convenios', raw.Convenios?.rows || [], C);

  // ── Procedimentos personalizados (catálogo fixo já semeado pelo schema.sql) ──
  const procRows = raw.Procedimentos?.rows || [];
  const procGroups = dedupCatalog(procRows, C);
  let procInseridos = 0, procDup = 0;
  for (const g of procGroups) {
    const { data: existing } = await sb.from('procedimentos').select('id').ilike('nome', g.nome).maybeSingle();
    if (existing) { procDup++; continue; }
    const { error } = await sb.from('procedimentos').insert({ nome: g.nome, sistema: false });
    if (error) { console.error(`Erro ao inserir procedimento "${g.nome}":`, error.message); continue; }
    procInseridos++;
  }
  console.log(`procedimentos: ${procRows.length} linhas → ${procInseridos} personalizados inseridos (${procDup} já existiam no catálogo)`);

  // ── Lançamentos ──────────────────────────────────────────────
  const lancRows = raw.Lancamentos?.rows || [];
  let lancOk = 0, lancErro = 0;
  const totaisPorMes = {};
  const dentistaCache = new Map(); // nome → id (evita re-consultar a cada linha)

  for (const r of lancRows) {
    const data = fmtDate(r[L.data]);
    if (!data) { lancErro++; continue; } // linha sem data válida — não dá pra migrar

    const dentistaNome = String(r[L.dentista] || '').trim();
    let dentistaId = dentistaCache.get(normName(dentistaNome));
    if (dentistaId === undefined) {
      dentistaId = await resolveIdByName('dentistas', dentistaNome);
      dentistaCache.set(normName(dentistaNome), dentistaId);
    }

    const valor   = Number(r[L.valor]) || 0;
    const repasse = Number(r[L.repasse]) || 0;
    const glosado   = boolOf(r[L.glosado]);
    const pendente  = boolOf(r[L.pendente]);
    const estornado = boolOf(r[L.estornado]);
    const dataEstorno = estornado ? fmtDate(r[L.dataEstorno]) : null;

    const { error } = await sb.from('lancamentos').insert({
      data,
      dentista_id: dentistaId,
      dentista_nome: dentistaNome,
      paciente: String(r[L.paciente] || '').trim(),
      procedimento_nome: String(r[L.procedimento] || '').trim(),
      tipo: String(r[L.tipo] || '').trim(),
      convenio_nome: String(r[L.convenio] || '').trim(),
      valor, repasse,
      dente: String(r[L.dente] || ''),
      gto: String(r[L.gto] || ''),
      glosado, pendente, estornado,
      data_estorno: dataEstorno
    });

    if (error) { lancErro++; console.error('Erro ao inserir lançamento:', error.message, JSON.stringify(r).slice(0,150)); continue; }
    lancOk++;

    const mesKey = data.slice(0, 7);
    if (!totaisPorMes[mesKey]) totaisPorMes[mesKey] = { valor: 0, repasse: 0, count: 0 };
    totaisPorMes[mesKey].valor   += valor;
    totaisPorMes[mesKey].repasse += repasse;
    totaisPorMes[mesKey].count++;
  }
  console.log(`lancamentos: ${lancRows.length} linhas → ${lancOk} inseridos, ${lancErro} com erro/sem data válida`);

  // ── Metas ────────────────────────────────────────────────────
  const metaRows = raw.Metas?.rows || [];
  let metaOk = 0, metaErro = 0;
  for (const r of metaRows) {
    const mes = fmtMonth(r[M.mes]);
    const dentistaNome = String(r[M.dentista] || '').trim();
    if (!mes || !dentistaNome) { metaErro++; continue; }
    const dentista_id = await resolveIdByName('dentistas', dentistaNome);
    if (!dentista_id) { metaErro++; console.warn(`Meta ignorada — dentista "${dentistaNome}" não encontrado`); continue; }

    const { error } = await sb.from('metas').upsert({
      mes, dentista_id, dentista_nome: dentistaNome,
      meta_particulares: r[M.meta] || null,
      meta_indicacoes:   r[M.indicacoes] || null,
      meta_valor_rs:     r[M.metaValorRS] || null
    }, { onConflict: 'mes,dentista_id' });

    if (error) { metaErro++; console.error('Erro ao inserir meta:', error.message); continue; }
    metaOk++;
  }
  console.log(`metas: ${metaRows.length} linhas → ${metaOk} inseridos, ${metaErro} com erro/pulados`);

  // ── Estoque ──────────────────────────────────────────────────
  const estoqueRows = raw.Estoque?.rows || [];
  let estOk = 0, estErro = 0;
  for (const r of estoqueRows) {
    const ultimoReabDate = fmtDate(r[E.ultimoReab]);
    const { error } = await sb.from('estoque').insert({
      nome: String(r[E.nome] || '').trim(),
      categoria: String(r[E.categoria] || ''),
      qtd_atual: Number(r[E.qtdAtual]) || 0,
      qtd_min: Number(r[E.qtdMin]) || 0,
      unidade: String(r[E.unidade] || 'Unidade'),
      ultimo_reabastecimento: ultimoReabDate ? new Date(ultimoReabDate).toISOString() : null
    });
    if (error) { estErro++; console.error('Erro ao inserir item de estoque:', error.message); continue; }
    estOk++;
  }
  console.log(`estoque: ${estoqueRows.length} linhas → ${estOk} inseridos, ${estErro} com erro`);

  // ── Resumo para conferência manual ──────────────────────────
  console.log('\n== Totais por mês (comparar com a planilha antes de descartar o Sheets) ==');
  Object.keys(totaisPorMes).sort().forEach(mes => {
    const t = totaisPorMes[mes];
    console.log(`${mes}: ${t.count} lançamentos — Valor: R$ ${t.valor.toFixed(2)} — Repasse: R$ ${t.repasse.toFixed(2)}`);
  });

  console.log('\nMigração concluída.');
}

main().catch(err => { console.error(err); process.exit(1); });
