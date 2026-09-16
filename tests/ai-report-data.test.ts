import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_SECTION_TITLES, assertPremiumCompany, buildAiDataset, redactAiText, validateAiOutput } from '../ai-report-data';
const now=new Date('2026-09-16T15:00:00Z');
const review=(date:string,score=4,extra:any={})=>({createdAt:date,ratings:{service:score,ambiance:score,products:score,waitTime:score},...extra});
const db=(reviews:any[])=>({settings:{name:'Loja'},reviews});
const validOutput=()=>({sections:AI_SECTION_TITLES.map(([key])=>({key,paragraphs:['A amostra exige cautela antes de concluir um padrão.'],evidenceIds:['fact_1']}))});

test('IA recusa Basic, Pro, plano ausente, Premium suspenso ou vencido',()=>{
  for(const plano of ['basic','pro',undefined,'PREMIUM'])assert.throws(()=>assertPremiumCompany({plano,ativo:true}));
  assert.throws(()=>assertPremiumCompany({plano:'premium',ativo:false}));
  assert.throws(()=>assertPremiumCompany({plano:'premium',ativo:true,status_assinatura:'suspended'}));
  assert.throws(()=>assertPremiumCompany({plano:'premium',ativo:true,vencimento_em:'2000-01-01'}));
  assert.doesNotThrow(()=>assertPremiumCompany({plano:'premium',ativo:true,status_assinatura:'active'}));
});
test('períodos completos usam o fuso brasileiro e não incluem hoje nem sobrepõem limites',()=>{
  const data=buildAiDataset(db([
    review('2026-09-16T02:59:59Z'),review('2026-09-16T03:00:00Z'),
    review('2026-09-09T03:00:00Z'),review('2026-09-09T02:59:59Z'),review('2026-09-02T03:00:00Z'),
  ]),7,now).dataset;
  assert.equal(data.totals.current,2);assert.equal(data.totals.previous,2);
  assert.equal(data.period.start,'2026-09-09T03:00:00.000Z');assert.equal(data.period.end,'2026-09-16T03:00:00.000Z');
});
test('médias ignoram notas inválidas e não criam comparações com amostras pequenas',()=>{
  const data=buildAiDataset(db([review('2026-09-15T14:00:00Z',5),review('2026-09-14T14:00:00Z',1),review('2026-09-13T14:00:00Z',99)]),7,now).dataset;
  assert.equal(data.totals.current,3);assert.equal(data.totals.average,3);assert.equal(data.totals.previousAverage,null);
  assert.equal(data.sufficient,false);assert.equal(data.comparable,false);assert.equal(data.categories[0].count,2);
});
test('pequena variação não é tratada como melhoria relevante',()=>{
  const rows=[...Array.from({length:10},()=>review('2026-09-15T14:00:00Z',4.2)),...Array.from({length:10},()=>review('2026-09-05T14:00:00Z',4))];
  const data=buildAiDataset(db(rows),7,now).dataset;
  assert.equal(data.comparable,true);assert.match(data.categories[0].direction,/Sem diferença/);
});
test('consumo conta avaliações e nunca atribui notas individuais a produtos',()=>{
  const data=buildAiDataset(db([review('2026-09-15T14:00:00Z',5,{consumedItems:[{id:'p',name:'Pizza'},{id:'p',name:'Pizza'}]})]),7,now).dataset;
  assert.deepEqual(data.products,[{name:'Pizza',count:1}]);assert.equal((data.products[0] as any).average,undefined);
  assert(data.facts.some(f=>f.text.includes('Não existem notas individuais')));
});
test('clientes e contatos são usados somente para agregação e removidos dos comentários',()=>{
  const data=buildAiDataset(db([review('2026-09-15T14:00:00Z',4,{customerName:'Lucas Wanderlei',customerPhone:'82987769844',criticism:'Lucas Wanderlei pediu contato em lucas@exemplo.com ou (82) 98776-9844. Rua das Flores, centro.'})]),7,now).dataset;
  const json=JSON.stringify(data);assert(!json.includes('Lucas Wanderlei'));assert(!json.includes('82987769844'));assert(!json.includes('lucas@exemplo.com'));assert(!json.includes('Rua das Flores'));
});
test('recorrência depende de histórico anterior e vouchers usam a coorte emitida',()=>{
  const data=buildAiDataset(db([review('2026-09-01T12:00:00Z',4,{customerPhone:'+5582987769844'}),review('2026-09-15T12:00:00Z',4,{customerPhone:'82987769844',rewardCode:'x',rewardClaimed:true})]),7,now).dataset;
  assert(data.facts.some(f=>f.text.includes('novos 0; recorrentes 1')));
  assert(data.facts.some(f=>f.text.includes('destes, 1 estão resgatados')));
});
test('comentários são limitados com contagem explícita da amostra',()=>{
  const data=buildAiDataset(db(Array.from({length:100},()=>review('2026-09-15T14:00:00Z',3,{criticism:'Demora no pedido'}))),7,now).dataset;
  assert.equal(data.comments.length,80);assert.deepEqual(data.commentSample,{included:80,total:100});
});
test('horários críticos exigem concentração e são horários das avaliações',()=>{
  const data=buildAiDataset(db(Array.from({length:10},(_,i)=>review('2026-09-15T23:00:00Z',i<5?2:5))),7,now).dataset;
  assert.equal(data.hours.length,1);assert.equal(data.hours[0].low,5);assert.match(data.hours[0].slot,/20h/);
  assert(data.facts.some(f=>f.text.includes('Não comprova horário de consumo')));
});
test('relatório rejeita números inventados, evidências inexistentes e seções incompletas',()=>{
  const {dataset}=buildAiDataset(db([review('2026-09-15T14:00:00Z')]),7,now);
  assert.equal(validateAiOutput(validOutput(),dataset,[]).sections.length,11);
  const bad=validOutput();bad.sections[0].paragraphs=['Recebeu 999 avaliações.'];assert.throws(()=>validateAiOutput(bad,dataset,[]));
  const invented=validOutput();invented.sections[0].evidenceIds=['inventado'];assert.throws(()=>validateAiOutput(invented,dataset,[]));
  assert.throws(()=>validateAiOutput({sections:[]},dataset,[]));
});
test('campos pessoais conhecidos são removidos também do texto devolvido pelo modelo',()=>{
  assert.equal(redactAiText('Lucas gostou, fale com ana@teste.com.', ['Lucas']),'[cliente] gostou, fale com [email].');
});
