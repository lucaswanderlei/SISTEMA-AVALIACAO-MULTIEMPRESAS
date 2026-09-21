import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw, Copy, Clock, AlertCircle } from 'lucide-react';
import { tenantFetch } from '../lib/api';

type Report = {
  id:string; generatedAt:string; cached?:boolean; companyName:string;
  period:{days:number;date?:string;start:string;end:string}; totals:{current:number;previous:number;average:number|null;previousAverage:number|null};
  sufficient:boolean; comparable:boolean; commentSample:{included:number;total:number};
  sections:Array<{key:string;title:string;paragraphs:string[];evidenceIds:string[];severity?:string}>;
  facts:Array<{id:string;text:string}>; staffLabels?:Array<{alias:string;name:string}>;
};
type Status={configured:boolean;attemptsToday:number;dailyLimit:number};
const date=(value:string)=>new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
const range=(r:Report)=>{
  const startLabel=date(r.period.start),endLabel=date(new Date(new Date(r.period.end).getTime()-1).toISOString());
  return startLabel===endLabel?startLabel:`${startLabel} a ${endLabel}`;
};
const mean=(value:number|null)=>value==null?'—':value.toLocaleString('pt-BR',{maximumFractionDigits:2});
export function PremiumAiReport({canGenerate}:{canGenerate:boolean}) {
  const [mode,setMode]=useState<'days'|'day'>('days');
  const [days,setDays]=useState(30),[selectedDate,setSelectedDate]=useState('');
  const [status,setStatus]=useState<Status|null>(null);
  const yesterday=(()=>{const sp=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}));sp.setDate(sp.getDate()-1);return sp.toISOString().slice(0,10);})();
  const [reports,setReports]=useState<Report[]>([]),[report,setReport]=useState<Report|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const alive=useRef(true),inflight=useRef(false);
  const request=async(url:string,init?:RequestInit)=>{
    const response=await tenantFetch(url,init);const body=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===401||response.status===403){setReport(null);setReports([]);setStatus(null);}
      throw new Error(body.error||'Não foi possível carregar a análise.');
    }
    return body;
  };
  useEffect(()=>{
    alive.current=true;
    void Promise.all([request('/api/ai/status',{cache:'no-store'}),request('/api/ai/reports',{cache:'no-store'})])
      .then(([s,h])=>{if(alive.current){setStatus(s);setReports(h.reports||[]);setReport(h.reports?.[0]||null);}})
      .catch(e=>{if(alive.current)setError(e.message);}).finally(()=>{if(alive.current)setLoading(false);});
    return()=>{alive.current=false;};
  },[]);
  const generate=async(refresh=false)=>{
    if(inflight.current)return;inflight.current=true;setBusy(true);setError('');setNotice('');
    try{
      const body=await request('/api/ai/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='day'?{date:selectedDate,refresh}:{days,refresh})});
      if(!alive.current)return;
      setReport(body.report);setReports(old=>[body.report,...old.filter(r=>r.id!==body.report.id&&!(r.period.start===body.report.period.start&&r.period.end===body.report.period.end))].slice(0,20));
      setNotice(body.report.cached?'Relatório já disponível para esses dados. Nenhuma nova geração foi necessária.':'Análise concluída.');
    }catch(e:any){if(alive.current)setError(e.message);}
    finally{
      if(alive.current){setBusy(false);void request('/api/ai/status',{cache:'no-store'}).then(s=>{if(alive.current)setStatus(s);}).catch(()=>{});}
      inflight.current=false;
    }
  };
  const copy=async()=>{
    if(!report)return;
    const text=[`Análise de IA — ${report.companyName}`,range(report),...report.sections.flatMap(section=>[
      `\n${section.title}`, ...section.paragraphs,
      ...section.evidenceIds.map(id=>report.facts.find(f=>f.id===id)?.text||''),
    ])].join('\n');
    try{await navigator.clipboard.writeText(text);setNotice('Relatório copiado.');}catch{setError('Não foi possível copiar. Selecione o texto do relatório.');}
  };
  return <section className="space-y-5">
    <div className="rounded-2xl bg-gradient-to-br from-stone-950 to-rose-950 text-white p-6 sm:p-8">
      <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wide"><Sparkles className="w-4 h-4"/>Premium</div>
      <h2 className="text-2xl font-black mt-2">Inteligência das avaliações</h2>
      <p className="text-sm text-stone-300 mt-2 max-w-2xl">Entenda o que se repete na experiência dos clientes e escolha a próxima melhoria com base nas avaliações recebidas.</p>
    </div>
    {loading&&<p role="status" className="text-sm text-stone-500">Carregando suas análises...</p>}
    {error&&<div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>{error}</div>}
    {notice&&<p role="status" className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm">{notice}</p>}
    {!loading&&status&&!status.configured&&<div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">A análise de IA está incluída no seu Premium e aguarda ativação pelo administrador da plataforma. Relatórios já gerados continuam disponíveis abaixo.</div>}
    {status&&<div className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-wrap items-end gap-3">
      <label className="text-xs font-bold text-stone-600">Período da análise
        <select value={mode==='day'?'day':String(days)} disabled={busy} onChange={e=>{const v=e.target.value;if(v==='day'){setMode('day');}else{setMode('days');setDays(Number(v));}}} className="block mt-1 rounded-xl border border-stone-300 bg-white text-stone-900 px-3 py-2.5 text-sm">
          <option value={7}>Últimos 7 dias completos</option><option value={30}>Últimos 30 dias completos</option><option value={90}>Últimos 90 dias completos</option>
          <option value="day">Dia específico</option>
        </select>
      </label>
      {mode==='day'&&<label className="text-xs font-bold text-stone-600">Escolha o dia
        <input type="date" value={selectedDate} max={yesterday} disabled={busy} onChange={e=>setSelectedDate(e.target.value)} className="block mt-1 rounded-xl border border-stone-300 bg-white text-stone-900 px-3 py-2.5 text-sm" />
      </label>}
      {canGenerate&&<button disabled={busy||!status.configured||(mode==='day'&&!selectedDate)} onClick={()=>void generate()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm disabled:opacity-50"><Sparkles className="w-4 h-4"/>{busy?'Analisando avaliações...':'Gerar análise'}</button>}
      {canGenerate&&report&&<button disabled={busy||!status.configured||(mode==='day'&&!selectedDate)} onClick={()=>void generate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-sm disabled:opacity-50"><RefreshCw className="w-4 h-4"/>Gerar novamente</button>}
      <p className="w-full text-xs text-stone-500">Até ontem • Comparação com o dia ou período anterior de mesma duração. {canGenerate?`${status.attemptsToday}/${status.dailyLimit} tentativas utilizadas hoje.`:'Seu acesso permite consultar as análises já geradas.'}</p>
    </div>}
    {busy&&<p role="status" className="text-sm text-stone-500 flex gap-2 items-center"><Clock className="w-4 h-4"/>A análise pode levar até um minuto.</p>}
    {reports.length>0&&<label className="block text-xs font-bold text-stone-600">Análises salvas
      <select value={report?.id||''} disabled={busy} onChange={e=>{setReport(reports.find(r=>r.id===e.target.value)||null);setNotice('');}} className="mt-1 block w-full border border-stone-300 bg-white rounded-xl px-3 py-2.5 text-sm text-stone-800">
        {reports.map(r=><option key={r.id} value={r.id}>{range(r)} • gerado em {new Date(r.generatedAt).toLocaleString('pt-BR')}</option>)}
      </select>
    </label>}
    {!report&&!loading&&!busy&&status?.configured&&<div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">Nenhuma análise salva. {canGenerate?'Escolha um período e gere o primeiro relatório.':'Peça ao administrador da empresa para gerar uma análise.'}</div>}
    {report&&<>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-stone-900">{range(report)}</h3><p className="text-xs text-stone-500">Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')}</p></div><button onClick={()=>void copy()} className="text-sm font-semibold text-stone-600 flex gap-2 items-center border border-stone-300 rounded-xl px-3 py-2"><Copy className="w-4 h-4"/>Copiar relatório</button></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
        ['Avaliações',String(report.totals.current)],['Média geral',mean(report.totals.average)],['Avaliações anteriores',String(report.totals.previous)],['Média anterior',mean(report.totals.previousAverage)],
      ].map(([label,value])=><div key={label} className="bg-white rounded-xl border border-stone-200 p-4"><p className="text-xs text-stone-500">{label}</p><p className="font-black text-2xl text-stone-900 mt-1">{value}</p></div>)}</div>
      {!report.sufficient&&<p className="p-3 bg-amber-50 text-amber-900 rounded-xl text-sm">Há poucas avaliações neste período. O relatório apresenta observações iniciais, sem conclusões confiáveis de tendência.</p>}
      <div className="space-y-4">{report.sections.map((section,index)=><article key={section.key} className={`rounded-2xl border p-5 sm:p-6 ${section.key==='priority'?'bg-rose-50 border-rose-200':'bg-white border-stone-200'}`}>
        <div className="flex items-center gap-2 flex-wrap"><h4 className="text-base font-bold text-stone-900">{index+1}. {section.title}</h4>{section.severity&&<span className="text-xs rounded-full px-2 py-0.5 bg-stone-100 text-stone-600">Gravidade {section.severity}</span>}</div>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-stone-700">{section.paragraphs.map((p,i)=><p key={i} className="whitespace-pre-line">{p}</p>)}</div>
        {section.key==='service' && (report.staffLabels || []).length>0 && <p className="mt-3 text-xs text-stone-500">{report.staffLabels!.map(person=>`${person.alias}: ${person.name}`).join(' • ')}</p>}
        {section.evidenceIds.length>0&&<details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-stone-500">Ver evidências</summary><ul className="mt-3 pt-3 border-t border-stone-100 space-y-1 text-xs leading-relaxed text-stone-500">{[...new Set(section.evidenceIds.map(id=>report.facts.find(f=>f.id===id)?.text).filter(Boolean))].map(text=><li key={text}>{text}</li>)}</ul></details>}
      </article>)}</div>
      <p className="text-xs text-stone-500 leading-relaxed">Análise assistida por IA. Confira as evidências antes de tomar decisões. Comentários analisados: {report.commentSample.included} de {report.commentSample.total} avaliações com texto. Frequência de consumo não representa nota individual de produto.</p>
    </>}
  </section>;
}
