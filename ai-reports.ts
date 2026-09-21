import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { CommerceError, businessDay, digest } from './commerce-security';
import { AI_REPORT_PROMPT } from './ai-report-prompt';
import { AI_SECTION_TITLES, assertPremiumCompany, buildAiDataset, validateAiOutput } from './ai-report-data';

export async function initAiSchema(pool: any) {
  await pool.query(`CREATE TABLE IF NOT EXISTS avaliacao_ai_reports (
    id TEXT PRIMARY KEY, empresa_id TEXT NOT NULL REFERENCES avaliacao_empresas(empresa_id) ON DELETE CASCADE,
    source_hash TEXT NOT NULL, report JSONB NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(empresa_id,source_hash)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS avaliacao_ai_usage (
    empresa_id TEXT NOT NULL REFERENCES avaliacao_empresas(empresa_id) ON DELETE CASCADE,
    business_day TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(empresa_id,business_day)
  )`);
}
export async function readPremiumCompany(pool: any, companyId: string) {
  const row = (await pool.query('SELECT empresa_id, plano, ativo, status_assinatura, vencimento_em, dados FROM avaliacao_empresas WHERE empresa_id=$1', [companyId])).rows[0];
  assertPremiumCompany(row); return row;
}
export async function reserveAiAttempt(pool: any, companyId: string, now = new Date()) {
  const rows = await pool.query(`INSERT INTO avaliacao_ai_usage(empresa_id,business_day,attempts,last_attempt)
    VALUES($1,$2,1,$3) ON CONFLICT(empresa_id,business_day) DO UPDATE
    SET attempts=avaliacao_ai_usage.attempts+1,last_attempt=EXCLUDED.last_attempt
    WHERE avaliacao_ai_usage.attempts < 10 AND avaliacao_ai_usage.last_attempt <= EXCLUDED.last_attempt - INTERVAL '60 seconds'
    RETURNING attempts`, [companyId,businessDay(now),now.toISOString()]);
  if(!rows.rows.length) throw new CommerceError(429,'Aguarde um minuto entre gerações. Cada empresa pode fazer até dez tentativas por dia.','AI_RATE_LIMIT');
  await pool.query('DELETE FROM avaliacao_ai_usage WHERE empresa_id=$1 AND business_day < $2',[companyId,businessDay(new Date(now.getTime()-7*86400000))]);
  return Number(rows.rows[0].attempts);
}
export async function callGemini(dataset: any, apiKey: string, model: string): Promise<unknown> {
  const client = new GoogleGenAI({ apiKey });
  try {
    const response = await client.models.generateContent({ model, contents: JSON.stringify(dataset), config: {
      systemInstruction: AI_REPORT_PROMPT, responseMimeType:'application/json',
      responseJsonSchema: {
        type:'object',required:['sections'],properties:{sections:{type:'array',minItems:11,maxItems:11,items:{
          type:'object',required:['key','paragraphs','evidenceIds'],properties:{
            key:{type:'string',enum:AI_SECTION_TITLES.map(([key])=>key)},
            paragraphs:{type:'array',minItems:1,maxItems:3,items:{type:'string'}},
            evidenceIds:{type:'array',maxItems:4,items:{type:'string'}},severity:{type:'string',enum:['baixa','média','alta']},
          },
        }}},
      },
      maxOutputTokens:8192, abortSignal:AbortSignal.timeout(55000), httpOptions:{timeout:55000},
    }});
    return JSON.parse(response.text || '{}');
  } catch {
    // Never expose upstream error bodies, API keys or customer comments in logs/responses.
    throw new CommerceError(502,'Não foi possível gerar o relatório de IA agora. Verifique a configuração do serviço ou tente novamente mais tarde.','AI_PROVIDER_ERROR');
  }
}
export async function generatePremiumReport(pool: any, companyId: string, options: { days?: number; date?: string; refresh?: boolean }, config: { apiKey: string; model: string }, generate=callGemini, now=new Date()) {
  const company = await readPremiumCompany(pool,companyId);
  const period: number | string = options.date ?? options.days!;
  const prepared = buildAiDataset(company.dados,period,now);
  if(!prepared.dataset.totals.current) throw new CommerceError(422,'Ainda não há avaliações nos dias completos selecionados. Escolha outro período.','AI_NO_DATA');
  const hash=digest(`${digest(AI_REPORT_PROMPT)}:${config.model}:${prepared.fingerprint}`);
  if(!options.refresh) {
    const cached=await pool.query('SELECT report FROM avaliacao_ai_reports WHERE empresa_id=$1 AND source_hash=$2',[companyId,hash]);
    if(cached.rows[0]) { await readPremiumCompany(pool,companyId); return {...cached.rows[0].report,cached:true}; }
  }
  if(!config.apiKey || !config.model) throw new CommerceError(503,'A IA Premium ainda precisa ser ativada pelo administrador da plataforma.','AI_NOT_CONFIGURED');
  await reserveAiAttempt(pool,companyId,now);
  const raw=await generate(prepared.dataset,config.apiKey,config.model);
  const validated=validateAiOutput(raw,prepared.dataset,prepared.customerNames);
  const report={
    id:crypto.randomUUID(),generatedAt:new Date().toISOString(),model:config.model,period:prepared.dataset.period,
    totals:prepared.dataset.totals,sufficient:prepared.dataset.sufficient,comparable:prepared.dataset.comparable,
    commentSample:prepared.dataset.commentSample,sections:validated.sections,
    facts:prepared.dataset.facts,companyName:prepared.dataset.companyName,staffLabels:prepared.staffLabels,
  };
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const latest=(await client.query('SELECT plano, ativo, status_assinatura, vencimento_em, dados FROM avaliacao_empresas WHERE empresa_id=$1 FOR UPDATE',[companyId])).rows[0];
    assertPremiumCompany(latest);
    if(buildAiDataset(latest.dados,period,now).fingerprint!==prepared.fingerprint) throw new CommerceError(409,'As avaliações mudaram durante a análise. Gere um novo relatório.','AI_DATA_CHANGED');
    await client.query(`INSERT INTO avaliacao_ai_reports(id,empresa_id,source_hash,report) VALUES($1,$2,$3,$4::jsonb)
      ON CONFLICT(empresa_id,source_hash) DO UPDATE SET id=EXCLUDED.id,report=EXCLUDED.report,criado_em=NOW()`,[report.id,companyId,hash,JSON.stringify(report)]);
    await client.query(`DELETE FROM avaliacao_ai_reports WHERE empresa_id=$1 AND id NOT IN
      (SELECT id FROM avaliacao_ai_reports WHERE empresa_id=$1 ORDER BY criado_em DESC LIMIT 20)`,[companyId]);
    await client.query('COMMIT');return {...report,cached:false};
  } catch(error) {await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
export function registerAiRoutes(app:any,pool:any,auth:any,editor:any,companyId:()=>string) {
  const configuration=()=>({apiKey:String(process.env.GEMINI_API_KEY||'').trim(),model:String(process.env.GEMINI_MODEL||'').trim()});
  app.get('/api/ai/status',auth,async(_req:any,res:any)=>{
    await readPremiumCompany(pool,companyId());const config=configuration();
    const usage=(await pool.query('SELECT attempts FROM avaliacao_ai_usage WHERE empresa_id=$1 AND business_day=$2',[companyId(),businessDay(new Date())])).rows[0];
    res.setHeader('Cache-Control','no-store');
    res.json({enabled:true,configured:Boolean(config.apiKey&&config.model),attemptsToday:Number(usage?.attempts||0),dailyLimit:10});
  });
  app.get('/api/ai/reports',auth,async(_req:any,res:any)=>{
    await readPremiumCompany(pool,companyId());
    const result=await pool.query('SELECT report FROM avaliacao_ai_reports WHERE empresa_id=$1 ORDER BY criado_em DESC LIMIT 20',[companyId()]);
    res.setHeader('Cache-Control','no-store');res.json({reports:result.rows.map((r:any)=>r.report)});
  });
  app.post('/api/ai/reports',auth,editor,async(req:any,res:any)=>{
    const days=req.body?.days;
    const date=req.body?.date;
    if(date!==undefined){
      if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new CommerceError(400,'Data inválida.');
    } else if(!Number.isInteger(days)) {
      throw new CommerceError(400,'Período inválido.');
    }
    const report=await generatePremiumReport(pool,companyId(),{days:date===undefined?days:undefined,date,refresh:req.body?.refresh===true},configuration());
    res.setHeader('Cache-Control','no-store');res.json({success:true,report});
  });
}
