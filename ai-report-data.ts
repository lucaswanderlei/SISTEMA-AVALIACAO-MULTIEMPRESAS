import { businessDay, CommerceError, digest } from './commerce-security';

export const AI_SECTION_TITLES = [
  ['summary', 'Resumo do período'], ['positives', 'Principais destaques positivos'],
  ['attention', 'Pontos de atenção'], ['evolution', 'Evolução'],
  ['comments', 'O que os clientes estão dizendo'], ['products', 'Produtos'],
  ['service', 'Atendimento'], ['hours', 'Horários críticos'],
  ['recommendations', 'Recomendações'], ['priority', 'Prioridade da semana'], ['closing', 'Frase final'],
] as const;
export type AiFact = { id: string; text: string };
const categories = { service: 'Atendimento', ambiance: 'Ambiente', products: 'Qualidade dos produtos', waitTime: 'Tempo de espera' };
const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 5;
const average = (values: number[]) => values.length ? Math.round(values.reduce((a,b) => a+b,0) / values.length * 100) / 100 : null;
const overall = (r: any): number | null => {
  const values = Object.keys(categories).map(key => r.ratings?.[key]);
  return values.every(valid) ? average(values) : null;
};
const number = (v: number | null) => v == null ? 'sem dados' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const phoneKey = (v: any) => {
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10 && /^[6-9]/.test(digits.slice(2))) digits = `${digits.slice(0,2)}9${digits.slice(2)}`;
  return digits.length >= 10 ? digits : '';
};
export function assertPremiumCompany(company: any) {
  if (!company || company.plano !== 'premium') throw new CommerceError(403, 'A análise de IA está disponível somente no plano Premium.', 'PREMIUM_REQUIRED');
  if (!company.ativo || company.status_assinatura === 'suspended' || (company.vencimento_em && new Date(company.vencimento_em).getTime() <= Date.now())) {
    throw new CommerceError(403, 'A assinatura Premium precisa estar ativa.', 'PREMIUM_INACTIVE');
  }
}
export function redactAiText(value: unknown, customerNames: string[] = []): string {
  let text = String(value || '').slice(0, 3000);
  for (const name of customerNames) {
    if (name.trim().length < 3) continue;
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'giu'), '$1[cliente]');
  }
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[contato]')
    .replace(/\b(?:rua|avenida|av\.|travessa|alameda|cep)\s+[^\n;,]{3,100}/gi, '[endereço]')
    .replace(/\b\d{5,}\b/g, '[identificador]');
}
export function buildAiDataset(db: any, period: number | { start: string; end: string }, now = new Date()) {
  const isCustomRange = typeof period === 'object' && period !== null;
  const todayStart = new Date(`${businessDay(now)}T00:00:00-03:00`).getTime();
  const parseDay = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CommerceError(400, 'Data inválida.');
    const t = new Date(`${value}T00:00:00-03:00`).getTime();
    if (!Number.isFinite(t)) throw new CommerceError(400, 'Data inválida.');
    return t;
  };
  let days: number, start: number, end: number, previousStart: number;
  let customRange: { start: string; end: string } | undefined;
  if (isCustomRange) {
    const startMs = parseDay(period.start), endMs = parseDay(period.end) + 86400000;
    if (startMs >= endMs) throw new CommerceError(400, 'A data final deve ser igual ou depois da inicial.');
    if (endMs > todayStart) throw new CommerceError(400, 'Escolha um intervalo completo, até ontem.');
    start = startMs; end = endMs; days = Math.round((end - start) / 86400000); previousStart = start - days * 86400000;
    customRange = { start: period.start, end: period.end };
  } else {
    if (![7,30,90].includes(period)) throw new CommerceError(400, 'Escolha um período de 7, 30 ou 90 dias, ou um intervalo personalizado.');
    end = todayStart; start = end - period * 86400000; previousStart = start - period * 86400000; days = period;
  }
  const all = (Array.isArray(db.reviews) ? db.reviews : []).filter((r: any) => Number.isFinite(new Date(r.createdAt).getTime()));
  const inRange = (r: any, a: number, b: number) => { const t = new Date(r.createdAt).getTime(); return t >= a && t < b; };
  const current = all.filter((r: any) => inRange(r,start,end));
  const previous = all.filter((r: any) => inRange(r,previousStart,start));
  const customerNames = [...new Set<string>(all.flatMap((r: any) => {
    const name = String(r.customerName || '').trim(); return [name, name.split(/\s+/)[0]].filter(n => n.length >= 3);
  }))].sort((a,b) => b.length-a.length);
  const staffNames = (Array.isArray(db.waiters) ? db.waiters : []).flatMap((w: any) => [w.name, w.nickname]).filter((v: any) => typeof v === 'string' && v.length >= 3);
  const safe = (text: unknown) => redactAiText(text, [...customerNames, ...staffNames]);
  const facts: AiFact[] = [];
  const add = (text: string) => { const fact = { id: `fact_${facts.length + 1}`, text }; facts.push(fact); return fact.id; };
  const currentMean = average(current.map(overall).filter(valid));
  const previousMean = average(previous.map(overall).filter(valid));
  add(`Período atual: ${current.length} avaliações; média geral ${number(currentMean)}. Período anterior: ${previous.length} avaliações; média geral ${number(previousMean)}. Notas de 1 a 5.`);
  add('Períodos de dias completos, até ontem, no fuso America/Sao_Paulo. Sem dados de hoje. Diferenças são descritivas; não comprovam tendência estatística nem causa.');
  const sufficient = current.length >= 10;
  const comparable = sufficient && previous.length >= 10;
  if (!sufficient) add('Amostra atual com menos de 10 avaliações: volume insuficiente para conclusões confiáveis, rankings, gravidade alta ou tendências.');
  if (!comparable) add('Comparação inconclusiva: pelo menos um período tem menos de 10 avaliações. Não afirmar melhora, piora ou estabilidade.');
  const categoryStats: any[] = [];
  for (const [key,label] of Object.entries(categories)) {
    const values = current.map((r: any) => r.ratings?.[key]).filter(valid);
    const older = previous.map((r: any) => r.ratings?.[key]).filter(valid);
    const mean = average(values), prior = average(older);
    const delta = mean != null && prior != null ? Math.round((mean-prior)*100)/100 : null;
    const direction = values.length >= 10 && older.length >= 10 && delta != null
      ? Math.abs(delta) < 0.3 ? '→ Sem diferença descritiva relevante' : delta > 0 ? '↑ Melhorou na comparação descritiva' : '↓ Piorou na comparação descritiva'
      : 'Sem volume suficiente para comparar';
    categoryStats.push({ key, label, average: mean, count: values.length, previousAverage: prior, previousCount: older.length, direction });
    add(`${label}: média atual ${number(mean)} em ${values.length} notas; anterior ${number(prior)} em ${older.length} notas. ${direction}. Notas abaixo de 4: ${values.filter((v: number) => v < 4).length}.`);
  }
  const distribution = [1,2,3,4,5].map(star => ({ stars: star, count: current.filter((r: any) => { const n=overall(r); return n!=null && Math.round(n)===star; }).length }));
  add(`Distribuição da média geral arredondada: ${distribution.map(row => `${row.stars} estrela(s): ${row.count}`).join('; ')}. Avaliações com notas incompletas não entram na distribuição.`);
  const beforePhones = new Set(all.filter((r: any) => new Date(r.createdAt).getTime() < start).map((r: any) => phoneKey(r.customerPhoneNormalized || r.customerPhone)).filter(Boolean));
  const phones = new Set<string>(current.map((r: any) => phoneKey(r.customerPhoneNormalized || r.customerPhone)).filter(Boolean));
  const recurring = [...phones].filter(p => beforePhones.has(p)).length;
  add(`Clientes únicos identificáveis no período: novos ${phones.size-recurring}; recorrentes ${recurring}. Recorrente significa telefone com avaliação anterior ao início do período, dentro do histórico disponível; contatos não são enviados ao modelo.`);
  const vouchers = current.filter((r: any) => r.rewardCode);
  add(`Vouchers emitidos nas avaliações do período: ${vouchers.length}; destes, ${vouchers.filter((r: any) => r.rewardClaimed).length} estão resgatados na data desta análise. Não é o total de resgates ocorridos dentro do período.`);
  const productMap = new Map<string,{ name: string; count: number }>();
  for (const r of current) {
    const seen = new Set();
    for (const item of Array.isArray(r.consumedItems) ? r.consumedItems : []) {
      if (!item?.id || seen.has(item.id)) continue; seen.add(item.id);
      const row=productMap.get(item.id)||{name:safe(item.name),count:0};row.count++;productMap.set(item.id,row);
    }
  }
  const products=[...productMap.values()].sort((a,b)=>b.count-a.count).slice(0,15);
  add('Os produtos têm apenas registro de consumo. Não existem notas individuais por produto. É proibido atribuir a nota geral de produtos a um item, indicar melhor/pior avaliado ou evolução da qualidade por produto.');
  for (const p of products) add(`Item consumido: ${p.name}; selecionado em ${p.count} avaliações. Frequência na amostra, não quantidade vendida nem nota individual.`);
  const staffMap=new Map<string,number[]>();
  for (const r of current) if (r.waiterId && valid(r.waiterRating)) staffMap.set(r.waiterId,[...(staffMap.get(r.waiterId)||[]),r.waiterRating]);
  // No real employee/customer names are sent to the model.
  const staffEntries=[...staffMap.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(0,20);
  const staff=staffEntries.map(([,values],i)=>({alias:`Atendente ${String.fromCharCode(65+i)}`,count:values.length,average:average(values)}));
  // This lookup stays local and is never included in the provider dataset.
  const staffLabels=staffEntries.map(([id],i)=>({alias:staff[i].alias,name:String((db.waiters || []).find((w:any)=>w.id===id)?.name || current.find((r:any)=>r.waiterId===id)?.waiterName || staff[i].alias)}));
  for (const person of staff) add(`${person.alias} (identificação anônima): média ${number(person.average)} em ${person.count} notas específicas. ${person.count<10?'Amostra insuficiente para concluir um padrão.':'Comparação descritiva, sem avaliações pessoais.'}`);
  const hoursMap=new Map<string,{count:number;low:number}>();
  for (const r of current) {
    const date=new Date(r.createdAt);const parts=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',hour:'2-digit',hourCycle:'h23'}).formatToParts(date);
    const weekday=parts.find(p=>p.type==='weekday')?.value;const hour=Number(parts.find(p=>p.type==='hour')?.value);const slot=Math.floor(hour/2)*2;
    const key=`${weekday}, ${slot}h–${slot+2}h`;const row=hoursMap.get(key)||{count:0,low:0};row.count++;if((overall(r)??5)<4)row.low++;hoursMap.set(key,row);
  }
  const hours=[...hoursMap.entries()].filter(([,v])=>v.count>=10&&v.low>=5&&v.low/v.count>=0.4).sort((a,b)=>b[1].low-a[1].low).slice(0,3).map(([slot,value])=>({slot,...value}));
  if (!hours.length) add('Sem concentração de notas baixas com volume suficiente por dia/faixa de horário. O horário registrado é o da avaliação, não necessariamente o da visita.');
  for (const slot of hours) add(`Horário de envio da avaliação: ${slot.slot}; ${slot.low} médias abaixo de 4 em ${slot.count} avaliações. Não comprova horário de consumo nem causa operacional.`);
  const commented = [...current].filter((r:any)=>r.criticism||r.suggestion||(r.quickTags||[]).length).sort((a:any,b:any)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const comments=commented.slice(0,80).map((r:any,i:number)=>({id:`comment_${i+1}`, criticism:safe(r.criticism).slice(0,500), suggestion:safe(r.suggestion).slice(0,500),tags:(Array.isArray(r.quickTags)?r.quickTags:[]).slice(0,15).map((v:any)=>safe(v).slice(0,150))}));
  add(`Comentários e destaques enviados ao modelo: ${comments.length} de ${commented.length} avaliações com texto; seleção das mais recentes. Temas de comentários referem-se somente a esta amostra, nunca extrapolar sua contagem para todo o período.`);
  // Facts are the only source of numbers in the output. Comment references contain no raw quote.
  for (const comment of comments) facts.push({id:comment.id,text:'Comentário anonimizado presente na amostra analisada.'});
  const dataset = {
    companyName:safe(db.settings?.name || 'Estabelecimento'),
    period:{days,range:customRange,start:new Date(start).toISOString(),end:new Date(end).toISOString(),previousStart:new Date(previousStart).toISOString(),previousEnd:new Date(start).toISOString(),timezone:'America/Sao_Paulo',endExclusive:true},
    totals:{current:current.length,previous:previous.length,average:currentMean,previousAverage:previousMean},
    sufficient,comparable,categories:categoryStats,distribution,products,staff,hours,comments,
    commentSample:{included:comments.length,total:commented.length},facts,
  };
  return { dataset, fingerprint:digest(JSON.stringify(dataset)), customerNames, staffLabels };
}
export function validateAiOutput(raw: unknown, dataset: ReturnType<typeof buildAiDataset>['dataset'], customerNames: string[]) {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).sections) || (raw as any).sections.length!==11) throw new CommerceError(502,'A IA devolveu um relatório incompleto. Tente novamente.','AI_INVALID_OUTPUT');
  const validFacts=new Set(dataset.facts.map(f=>f.id));
  let words=0;
  const sections=AI_SECTION_TITLES.map(([key,title],index)=>{
    const section=(raw as any).sections[index];
    if(section?.key!==key||!Array.isArray(section.paragraphs)||!section.paragraphs.length||section.paragraphs.length>3||!Array.isArray(section.evidenceIds)||section.evidenceIds.length>4||section.evidenceIds.some((id:any)=>!validFacts.has(id)))throw new CommerceError(502,'A IA devolveu referências inválidas. Tente novamente.','AI_INVALID_OUTPUT');
    const paragraphs=section.paragraphs.map((p:any)=>{
      if(typeof p!=='string'||!p.trim()||p.length>900||/\d/.test(p))throw new CommerceError(502,'A IA devolveu texto fora do formato seguro. Tente novamente.','AI_INVALID_OUTPUT');
      const clean=redactAiText(p,customerNames);words+=clean.split(/\s+/).length;return clean;
    });
    if(!section.evidenceIds.length&& !['closing','priority','recommendations'].includes(key))throw new CommerceError(502,'Faltaram evidências no relatório.','AI_INVALID_OUTPUT');
    const severity=['baixa','média','alta'].includes(section.severity)?section.severity:undefined;
    if(!dataset.sufficient && severity==='alta')throw new CommerceError(502,'A IA extrapolou a amostra disponível.','AI_INVALID_OUTPUT');
    return {key,title,paragraphs,evidenceIds:[...new Set<string>(section.evidenceIds)],...(severity?{severity}:{})};
  });
  if(words>450)throw new CommerceError(502,'O relatório excedeu o tamanho esperado. Tente novamente.','AI_INVALID_OUTPUT');
  return {sections};
}
