// ============================================================
// Camada de API — Supabase (substitui o antigo Apps Script)
// Mantém a mesma assinatura apiCall({action, ...}) usada em todo
// o app, para minimizar mudanças nos arquivos que já a chamam.
// ============================================================

const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const UNIQUE_VIOLATION = '23505';

function friendlyDupError(entidade) {
  return { error: `Já existe ${entidade} com esse nome` };
}

async function apiCall(params) {
  const { action, ...p } = params;
  try {
    switch (action) {
      case 'getDentistas':      return await getDentistas();
      case 'addDentista':       return await addDentista(p.nome);
      case 'deleteDentista':    return await deleteDentista(p.id);

      case 'getConvenios':      return await getConvenios();
      case 'addConvenio':       return await addConvenio(p.nome);
      case 'deleteConvenio':    return await deleteConvenio(p.id);

      case 'getProcedimentos':    return await getProcedimentos();
      case 'addProcedimento':     return await addProcedimento(p.nome);
      case 'deleteProcedimento':  return await deleteProcedimento(p.id);

      case 'getLancamentos':    return await getLancamentos();
      case 'addLancamento':     return await addLancamento(p.data);
      case 'updateLancamento':  return await updateLancamento(p.id, p.data);
      case 'deleteLancamento':  return await deleteLancamento(p.id);
      case 'updateGlosa':       return await updateGlosa(p.id, p.glosado);
      case 'updatePendente':    return await updatePendente(p.id, p.pendente);
      case 'updateEstorno':     return await updateEstorno(p.id, p.estornado, p.dataEstorno);
      case 'updateRepasse':     return await updateRepasse(p.id, p.repasse);

      case 'getMetas':          return await getMetas();
      case 'saveMeta':          return await saveMeta(p.mes, p.dentista, p.meta, p.indicacoes, p.metaValorRS);
      case 'deleteMeta':        return await deleteMeta(p.id);

      case 'getEstoque':        return await getEstoque();
      case 'addItemEstoque':    return await addItemEstoque(p.nome, p.categoria, p.qtdAtual, p.qtdMin, p.unidade);
      case 'updateItemEstoque': return await updateItemEstoque(p.id, p.nome, p.categoria, p.qtdAtual, p.qtdMin, p.unidade);
      case 'movimentarEstoque': return await movimentarEstoque(p.id, p.tipo, p.qtd);
      case 'deleteItemEstoque': return await deleteItemEstoque(p.id);

      default: return { error: 'Ação inválida' };
    }
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

// ── Dentistas ────────────────────────────────────────────────
async function getDentistas() {
  const { data, error } = await sb.from('dentistas').select('id,nome').eq('ativo', true).order('nome');
  if (error) return { error: error.message };
  return { success: true, data };
}

async function addDentista(nome) {
  if (!nome || !nome.trim()) return { error: 'Nome obrigatório' };
  const { data, error } = await sb.from('dentistas').insert({ nome: nome.trim() }).select('id,nome').single();
  if (error) return error.code === UNIQUE_VIOLATION ? friendlyDupError('um dentista') : { error: error.message };
  return { success: true, id: data.id, nome: data.nome };
}

async function deleteDentista(id) {
  const { error } = await sb.from('dentistas').update({ ativo: false }).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

// ── Convênios ────────────────────────────────────────────────
async function getConvenios() {
  const { data, error } = await sb.from('convenios').select('id,nome').eq('ativo', true).order('nome');
  if (error) return { error: error.message };
  return { success: true, data };
}

async function addConvenio(nome) {
  if (!nome || !nome.trim()) return { error: 'Nome obrigatório' };
  const { data, error } = await sb.from('convenios').insert({ nome: nome.trim() }).select('id,nome').single();
  if (error) return error.code === UNIQUE_VIOLATION ? friendlyDupError('um convênio') : { error: error.message };
  return { success: true, id: data.id, nome: data.nome };
}

async function deleteConvenio(id) {
  const { error } = await sb.from('convenios').update({ ativo: false }).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

// ── Procedimentos ────────────────────────────────────────────
async function getProcedimentos() {
  const { data, error } = await sb.from('procedimentos')
    .select('id,nome,repasse_fixo,sistema')
    .order('sistema', { ascending: false })
    .order('nome');
  if (error) return { error: error.message };
  return { success: true, data: data.map(d => ({ id: d.id, nome: d.nome, repasse: Number(d.repasse_fixo) || 0, sistema: d.sistema })) };
}

async function addProcedimento(nome) {
  if (!nome || !nome.trim()) return { error: 'Nome obrigatório' };
  const { data, error } = await sb.from('procedimentos').insert({ nome: nome.trim(), sistema: false }).select('id,nome').single();
  if (error) return error.code === UNIQUE_VIOLATION ? friendlyDupError('um procedimento') : { error: error.message };
  return { success: true, id: data.id, nome: data.nome };
}

async function deleteProcedimento(id) {
  const { data: existing, error: selErr } = await sb.from('procedimentos').select('sistema').eq('id', id).single();
  if (selErr) return { error: selErr.message };
  if (existing.sistema) return { error: 'Procedimento do sistema não pode ser excluído' };
  const { error } = await sb.from('procedimentos').delete().eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

// ── Dentista lookup (por nome, case/trim-insensitive) ─────────
async function resolveDentistaId(nome) {
  if (!nome) return null;
  const { data } = await sb.from('dentistas').select('id').ilike('nome', nome.trim()).limit(1).maybeSingle();
  return data ? data.id : null;
}

// ── Lançamentos ──────────────────────────────────────────────
function mapLancamento(d) {
  return {
    id:           d.id,
    data:         d.data,
    dentista:     d.dentista_nome,
    paciente:     d.paciente,
    procedimento: d.procedimento_nome,
    tipo:         d.tipo,
    convenio:     d.convenio_nome || '',
    valor:        Number(d.valor),
    repasse:      Number(d.repasse),
    timestamp:    d.created_at,
    glosado:      d.glosado,
    dente:        d.dente || '',
    gto:          d.gto || '',
    pendente:     d.pendente,
    estornado:    d.estornado,
    dataEstorno:  d.data_estorno || ''
  };
}

async function getLancamentos() {
  const { data, error } = await sb.from('lancamentos').select('*').order('data', { ascending: false }).order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { success: true, data: data.map(mapLancamento) };
}

async function addLancamento(l) {
  const dentista_id = await resolveDentistaId(l.dentista);
  const { data, error } = await sb.from('lancamentos').insert({
    data:              l.data,
    dentista_id,
    dentista_nome:     l.dentista,
    paciente:          l.paciente,
    procedimento_nome: l.procedimento,
    tipo:              l.tipo,
    convenio_nome:     l.convenio || '',
    valor:             Number(l.valor) || 0,
    repasse:           Number(l.repasse) || 0,
    dente:             l.dente || '',
    gto:               l.gto || ''
  }).select('id').single();
  if (error) return { error: error.message };
  return { success: true, id: data.id };
}

async function updateLancamento(id, l) {
  const dentista_id = await resolveDentistaId(l.dentista);
  const { error } = await sb.from('lancamentos').update({
    data:              l.data,
    dentista_id,
    dentista_nome:     l.dentista,
    paciente:          l.paciente,
    procedimento_nome: l.procedimento,
    tipo:              l.tipo,
    convenio_nome:     l.convenio || '',
    valor:             Number(l.valor) || 0,
    repasse:           Number(l.repasse) || 0,
    dente:             l.dente || '',
    gto:               l.gto || ''
  }).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

async function deleteLancamento(id) {
  const { error } = await sb.from('lancamentos').delete().eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

async function updateGlosa(id, glosado) {
  const { error } = await sb.from('lancamentos').update({ glosado: glosado === true || glosado === 'true' }).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

async function updatePendente(id, pendente) {
  const { error } = await sb.from('lancamentos').update({ pendente: pendente === true || pendente === 'true' }).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

async function updateEstorno(id, estornado, dataEstorno) {
  const ativo = estornado === true || estornado === 'true';
  const { error } = await sb.from('lancamentos').update({
    estornado: ativo,
    data_estorno: ativo ? (dataEstorno || null) : null
  }).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

async function updateRepasse(id, repasse) {
  const { error } = await sb.from('lancamentos').update({ repasse: Number(repasse) || 0 }).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

// ── Metas Mensais ────────────────────────────────────────────
function mapMeta(m) {
  return {
    id:          m.id,
    mes:         m.mes,
    dentista:    m.dentista_nome,
    meta:        m.meta_particulares ?? '',
    indicacoes:  m.meta_indicacoes ?? '',
    metaValorRS: m.meta_valor_rs ?? ''
  };
}

async function getMetas() {
  const { data, error } = await sb.from('metas').select('*').order('mes', { ascending: false }).order('dentista_nome');
  if (error) return { error: error.message };
  return { success: true, data: data.map(mapMeta) };
}

async function saveMeta(mes, dentista, meta, indicacoes, metaValorRS) {
  if (!mes || !dentista) return { error: 'Mês e dentista são obrigatórios' };
  const dentista_id = await resolveDentistaId(dentista);
  if (!dentista_id) return { error: 'Dentista não encontrado — cadastre-o primeiro' };

  const { data: existing } = await sb.from('metas').select('id').eq('mes', mes).eq('dentista_id', dentista_id).maybeSingle();

  const { data, error } = await sb.from('metas').upsert({
    mes,
    dentista_id,
    dentista_nome:     dentista,
    meta_particulares: meta || null,
    meta_indicacoes:   indicacoes || null,
    meta_valor_rs:     metaValorRS || null,
    updated_at:        new Date().toISOString()
  }, { onConflict: 'mes,dentista_id' }).select('id').single();

  if (error) return { error: error.message };
  return { success: true, id: data.id, updated: !!existing };
}

async function deleteMeta(id) {
  const { error } = await sb.from('metas').delete().eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

// ── Estoque ──────────────────────────────────────────────────
function mapEstoque(e) {
  return {
    id:                    e.id,
    nome:                  e.nome,
    categoria:             e.categoria || '',
    qtdAtual:              Number(e.qtd_atual),
    qtdMin:                Number(e.qtd_min),
    unidade:               e.unidade || 'Unidade',
    ultimoReabastecimento: e.ultimo_reabastecimento || ''
  };
}

async function getEstoque() {
  const { data, error } = await sb.from('estoque').select('*').order('nome');
  if (error) return { error: error.message };
  return { success: true, data: data.map(mapEstoque) };
}

async function addItemEstoque(nome, categoria, qtdAtual, qtdMin, unidade) {
  const { data, error } = await sb.from('estoque').insert({
    nome: nome.trim(), categoria: categoria || '', qtd_atual: Number(qtdAtual) || 0,
    qtd_min: Number(qtdMin) || 0, unidade: unidade || 'Unidade'
  }).select('id').single();
  if (error) return { error: error.message };
  return { success: true, id: data.id };
}

async function updateItemEstoque(id, nome, categoria, qtdAtual, qtdMin, unidade) {
  const { error } = await sb.from('estoque').update({
    nome: nome.trim(), categoria: categoria || '', qtd_atual: Number(qtdAtual) || 0,
    qtd_min: Number(qtdMin) || 0, unidade: unidade || 'Unidade'
  }).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

async function movimentarEstoque(id, tipo, qtd) {
  const { data: item, error: selErr } = await sb.from('estoque').select('qtd_atual').eq('id', id).single();
  if (selErr) return { error: selErr.message };

  const novaQtd = tipo === 'entrada' ? Number(item.qtd_atual) + Number(qtd) : Number(item.qtd_atual) - Number(qtd);
  if (novaQtd < 0) return { error: 'Quantidade insuficiente em estoque' };

  const update = { qtd_atual: novaQtd };
  if (tipo === 'entrada') update.ultimo_reabastecimento = new Date().toISOString();

  const { error } = await sb.from('estoque').update(update).eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

async function deleteItemEstoque(id) {
  const { error } = await sb.from('estoque').delete().eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}
