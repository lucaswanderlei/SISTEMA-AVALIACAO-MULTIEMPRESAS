import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {initAiSchema,generatePremiumReport,readPremiumCompany,reserveAiAttempt} from '../ai-reports';
import {AI_SECTION_TITLES} from '../ai-report-data';
const pg=new PGlite();let queue=Promise.resolve();
const pool={async connect(){const prev=queue;let release!:()=>void;queue=new Promise<void>(r=>{release=r;});await prev;return{query:(sql:string,args?:any[])=>pg.query(sql,args),release};},async query(sql:string,args?:any[]){const c=await this.connect();try{return await c.query(sql,args);}finally{c.release();}}};
const now=new Date('2026-09-16T15:00:00Z');const config={apiKey:'test-only',model:'test-model'};let calls=0;
const fake=async()=>{calls++;return{sections:AI_SECTION_TITLES.map(([key])=>({key,paragraphs:['Há pouco volume para conclusões confiáveis.'],evidenceIds:['fact_1']}))};};
before(async()=>{await pool.query(`CREATE TABLE avaliacao_empresas(empresa_id TEXT PRIMARY KEY,plano TEXT,ativo BOOLEAN DEFAULT TRUE,status_assinatura TEXT DEFAULT 'active',vencimento_em TIMESTAMPTZ,dados JSONB)`);await initAiSchema(pool);});
beforeEach(async()=>{calls=0;await pool.query('TRUNCATE avaliacao_empresas CASCADE');for(const [id,plan]of[['a','premium'],['b','premium'],['basic','basic'],['pro','pro']])await pool.query('INSERT INTO avaliacao_empresas(empresa_id,plano,dados)VALUES($1,$2,$3::jsonb)',[id,plan,JSON.stringify({settings:{name:id},reviews:[{createdAt:'2026-09-15T14:00:00Z',ratings:{service:4,ambiance:4,products:4,waitTime:4}}]})]);});
after(async()=>pg.close());
test('Basic e Pro são bloqueados antes de chamar a IA ou consultar resultado em cache',async()=>{
  for(const id of ['basic','pro'])await assert.rejects(generatePremiumReport(pool,id,{days:7},config,fake,now),{code:'PREMIUM_REQUIRED'});
  assert.equal(calls,0);
});
test('gera e persiste onze seções, reutilizando cache sem consumir nova tentativa',async()=>{
  const first=await generatePremiumReport(pool,'a',{days:7},config,fake,now);assert.equal(first.sections.length,11);
  const cached=await generatePremiumReport(pool,'a',{days:7},config,fake,now);assert.equal(cached.cached,true);assert.equal(first.id,cached.id);assert.equal(calls,1);
  assert.equal((await pool.query("SELECT attempts FROM avaliacao_ai_usage WHERE empresa_id='a'")).rows[0].attempts,1);
});
test('cada empresa tem histórico e cache próprios',async()=>{
  const a=await generatePremiumReport(pool,'a',{days:7},config,fake,now);const b=await generatePremiumReport(pool,'b',{days:7},config,fake,now);
  assert.notEqual(a.id,b.id);assert.equal(calls,2);
  assert.equal((await pool.query("SELECT report FROM avaliacao_ai_reports WHERE empresa_id='b'")).rows.length,1);
});
test('sem chave ou sem avaliações não simula relatório nem chama provedor',async()=>{
  await assert.rejects(generatePremiumReport(pool,'a',{days:7},{apiKey:'',model:''},fake,now),{code:'AI_NOT_CONFIGURED'});
  await pool.query("UPDATE avaliacao_empresas SET dados=jsonb_set(dados,'{reviews}','[]'::jsonb) WHERE empresa_id='a'");
  await assert.rejects(generatePremiumReport(pool,'a',{days:7},config,fake,now),{code:'AI_NO_DATA'});assert.equal(calls,0);
});
test('downgrade durante a geração impede salvar e entregar o relatório',async()=>{
  const downgrade=async()=>{await pool.query("UPDATE avaliacao_empresas SET plano='pro' WHERE empresa_id='a'");return fake();};
  await assert.rejects(generatePremiumReport(pool,'a',{days:7},config,downgrade,now),{code:'PREMIUM_REQUIRED'});
  assert.equal((await pool.query('SELECT * FROM avaliacao_ai_reports')).rows.length,0);
});
test('downgrade também impede recuperar relatório já salvo',async()=>{
  await generatePremiumReport(pool,'a',{days:7},config,fake,now);await pool.query("UPDATE avaliacao_empresas SET plano='basic' WHERE empresa_id='a'");
  await assert.rejects(readPremiumCompany(pool,'a'),{code:'PREMIUM_REQUIRED'});
  await assert.rejects(generatePremiumReport(pool,'a',{days:7},config,fake,now),{code:'PREMIUM_REQUIRED'});assert.equal(calls,1);
});
test('alteração nos dados durante a análise evita salvar relatório desatualizado',async()=>{
  const change=async()=>{await pool.query("UPDATE avaliacao_empresas SET dados=jsonb_set(dados,'{reviews}','[]'::jsonb) WHERE empresa_id='a'");return fake();};
  await assert.rejects(generatePremiumReport(pool,'a',{days:7},config,change,now),{code:'AI_DATA_CHANGED'});
  assert.equal((await pool.query('SELECT * FROM avaliacao_ai_reports')).rows.length,0);
});
test('quota persistente impede cliques simultâneos e mais de dez tentativas diárias',async()=>{
  const results=await Promise.allSettled([reserveAiAttempt(pool,'a',now),reserveAiAttempt(pool,'a',now)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  for(let i=1;i<10;i++)await reserveAiAttempt(pool,'a',new Date(now.getTime()+i*61000));
  await assert.rejects(reserveAiAttempt(pool,'a',new Date(now.getTime()+11*61000)),{code:'AI_RATE_LIMIT'});
  await reserveAiAttempt(pool,'b',now);
});
test('resposta inválida do provedor não entra no histórico',async()=>{
  await assert.rejects(generatePremiumReport(pool,'a',{days:7},config,async()=>({sections:[]}),now),{code:'AI_INVALID_OUTPUT'});
  assert.equal((await pool.query('SELECT * FROM avaliacao_ai_reports')).rows.length,0);
});
