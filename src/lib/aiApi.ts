import { getCompanyId } from './tenant';

function tenantFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('X-Company-Id', getCompanyId());
  return fetch(input, { ...init, headers });
}

export type AiTrend = 'melhorou' | 'piorou' | 'estavel';
export interface AiInsightItem { title: string; description: string; evidence?: string; severity?: 'baixa'|'media'|'alta'; type?: 'positivo'|'atencao'; }
export interface AiEvolutionItem { category: string; previous: number | null; current: number | null; trend: AiTrend; }
export interface AiThemeItem { theme: string; count: number; sentiment: 'positivo'|'negativo'|'neutro'; summary?: string; }
export interface AiReport {
  generatedAt: string; period: string; summary: string; status: 'positivo'|'atencao'|'critico'|'sem_dados'; confidenceNote?: string;
  highlights: AiInsightItem[]; alerts: AiInsightItem[]; evolution: AiEvolutionItem[]; themes: AiThemeItem[];
  productInsights: AiInsightItem[]; waiterInsights: AiInsightItem[]; criticalHours: AiInsightItem[]; recommendations: string[];
  weeklyPriority: { problem: string; reason: string; action: string } | null; finalPhrase: string;
}
export async function apiGenerateAiReport(period: 'today'|'7d'|'30d'|'all') {
  try { const res=await tenantFetch('/api/ai/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({period})}); const data=await res.json().catch(()=>({})); return res.ok?{success:true,report:data.report as AiReport}:{success:false,error:data.error||'Não foi possível gerar a análise.'}; }
  catch(err:any){ return {success:false,error:err?.message||'Falha de conexão com a IA.'}; }
}
export async function apiAskAiData(question:string, period:'today'|'7d'|'30d'|'all') {
  try { const res=await tenantFetch('/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,period})}); const data=await res.json().catch(()=>({})); return res.ok?{success:true,answer:String(data.answer||'')}:{success:false,error:data.error||'Não foi possível responder.'}; }
  catch(err:any){ return {success:false,error:err?.message||'Falha de conexão com a IA.'}; }
}

export async function apiGetAiEntitlement() {
  try { const res=await tenantFetch('/api/ai/entitlement'); const data=await res.json().catch(()=>({})); return { success: res.ok, pro: Boolean(data.pro) }; }
  catch { return { success:false, pro:false }; }
}
