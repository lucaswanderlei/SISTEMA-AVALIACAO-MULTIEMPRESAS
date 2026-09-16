import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, TrendingUp, MessageCircleQuestion, RefreshCw, Lightbulb, Clock3, Target, CheckCircle2 } from 'lucide-react';
import { apiAskAiData, apiGenerateAiReport, apiGetAiEntitlement, type AiReport } from '../lib/aiApi';

type Period = 'today'|'7d'|'30d'|'all';

export function AiInsightsPanel({ period }: { period: Period }) {
  const [report, setReport] = useState<AiReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [entitlement, setEntitlement] = useState<'loading'|'pro'|'blocked'>('loading');

  useEffect(() => {
    let active = true;
    apiGetAiEntitlement().then(r => { if (active) setEntitlement(r.pro ? 'pro' : 'blocked'); });
    return () => { active = false; };
  }, []);

  async function generate() {
    setLoading(true); setError('');
    const result = await apiGenerateAiReport(period);
    setLoading(false);
    if (!result.success || !result.report) { setError(result.error || 'Erro ao gerar relatório.'); return; }
    setReport(result.report);
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true); setAnswer(''); setError('');
    const result = await apiAskAiData(question.trim(), period);
    setAsking(false);
    if (!result.success) { setError(result.error || 'Erro ao consultar os dados.'); return; }
    setAnswer(result.answer || 'Não encontrei dados suficientes para responder.');
  }

  if (entitlement !== 'pro') return null;

  return <div className="space-y-5">
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5"/></div>
          <div><h3 className="font-black text-stone-900">Análise inteligente do período</h3><p className="text-xs text-stone-500 mt-1">A IA procura padrões, mudanças, reclamações recorrentes, horários críticos e ações práticas sem expor telefone dos clientes.</p></div>
        </div>
        <button onClick={generate} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white px-4 py-2.5 text-xs font-black">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}{loading ? 'Analisando...' : report ? 'Atualizar análise' : 'Gerar análise com IA'}
        </button>
      </div>
      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</div>}
    </div>

    {report && <>
      <div className="rounded-2xl bg-stone-950 text-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-violet-300 text-xs font-black uppercase tracking-wider"><Sparkles className="w-4 h-4"/> Resumo da IA</div>
        <p className="mt-3 text-sm leading-6 text-stone-100">{report.summary}</p>
        {report.confidenceNote && <p className="mt-3 text-[11px] text-stone-400">{report.confidenceNote}</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h4 className="font-black text-stone-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600"/> Principais destaques</h4>
          <div className="mt-3 space-y-3">{report.highlights.length ? report.highlights.map((x,i)=><div key={i} className="rounded-xl bg-emerald-50 p-3"><p className="text-sm font-black text-emerald-950">{x.title}</p><p className="text-xs text-emerald-900 mt-1 leading-5">{x.description}</p>{x.evidence && <p className="text-[11px] text-emerald-700 mt-1">Evidência: {x.evidence}</p>}</div>) : <p className="text-xs text-stone-500">Sem destaque relevante com segurança neste período.</p>}</div>
        </section>
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <h4 className="font-black text-stone-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600"/> Pontos de atenção</h4>
          <div className="mt-3 space-y-3">{report.alerts.length ? report.alerts.map((x,i)=><div key={i} className="rounded-xl bg-amber-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-black text-amber-950">{x.title}</p>{x.severity && <span className="text-[10px] font-black uppercase rounded-full bg-white border border-amber-200 px-2 py-1">{x.severity}</span>}</div><p className="text-xs text-amber-900 mt-1 leading-5">{x.description}</p>{x.evidence && <p className="text-[11px] text-amber-700 mt-1">Evidência: {x.evidence}</p>}</div>) : <p className="text-xs text-stone-500">Nenhum problema recorrente relevante identificado.</p>}</div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h4 className="font-black flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600"/> Evolução</h4><div className="mt-3 space-y-2">{report.evolution.map((x,i)=><div key={i} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs"><span className="font-bold">{x.trend==='melhorou'?'↑':x.trend==='piorou'?'↓':'→'} {x.category}</span><span className="font-black">{x.previous == null ? '—' : x.previous.toFixed(1)} → {x.current == null ? '—' : x.current.toFixed(1)}</span></div>)}</div></section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h4 className="font-black flex items-center gap-2"><Clock3 className="w-4 h-4 text-rose-600"/> Horários críticos</h4><div className="mt-3 space-y-2">{report.criticalHours.length ? report.criticalHours.map((x,i)=><div key={i} className="rounded-xl bg-rose-50 p-3"><p className="text-sm font-black text-rose-950">{x.title}</p><p className="text-xs text-rose-900 mt-1">{x.description}</p></div>) : <p className="text-xs text-stone-500">Sem concentração negativa suficiente por horário.</p>}</div></section>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h4 className="font-black">O que os clientes estão dizendo</h4><div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{report.themes.length ? report.themes.map((x,i)=><div key={i} className="rounded-xl bg-stone-50 p-3"><div className="flex justify-between gap-2"><p className="text-sm font-black">{x.theme}</p><span className="text-[10px] font-black bg-white border rounded-full px-2 py-1">{x.count} menções</span></div><p className="text-xs text-stone-600 mt-1">{x.summary}</p></div>) : <p className="text-xs text-stone-500">Não há comentários suficientes para agrupar temas.</p>}</div></section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h4 className="font-black">Produtos</h4><div className="mt-3 space-y-2">{report.productInsights.length ? report.productInsights.map((x,i)=><div key={i} className="rounded-xl bg-stone-50 p-3"><p className="text-sm font-black">{x.title}</p><p className="text-xs text-stone-600 mt-1">{x.description}</p></div>) : <p className="text-xs text-stone-500">O sistema ainda não possui dados específicos de produtos suficientes para uma conclusão.</p>}</div></section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h4 className="font-black">Atendimento</h4><div className="mt-3 space-y-2">{report.waiterInsights.length ? report.waiterInsights.map((x,i)=><div key={i} className="rounded-xl bg-stone-50 p-3"><p className="text-sm font-black">{x.title}</p><p className="text-xs text-stone-600 mt-1">{x.description}</p></div>) : <p className="text-xs text-stone-500">Sem padrão relevante de atendentes neste período.</p>}</div></section>
      </div>

      <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm"><h4 className="font-black text-stone-900 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-blue-700"/> Recomendações práticas</h4><div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">{report.recommendations.map((x,i)=><div key={i} className="rounded-xl bg-white border border-blue-100 p-3 text-xs leading-5"><span className="font-black text-blue-700 mr-1">{i+1}.</span>{x}</div>)}</div></section>

      {report.weeklyPriority && <section className="rounded-2xl border-2 border-violet-300 bg-violet-50 p-5 shadow-sm"><h4 className="font-black flex items-center gap-2 text-violet-950"><Target className="w-5 h-5"/> Prioridade da semana</h4><div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs"><div><span className="font-black block text-violet-700">Problema</span>{report.weeklyPriority.problem}</div><div><span className="font-black block text-violet-700">Motivo</span>{report.weeklyPriority.reason}</div><div><span className="font-black block text-violet-700">Ação sugerida</span>{report.weeklyPriority.action}</div></div></section>}
    </>}

    <form onSubmit={ask} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><MessageCircleQuestion className="w-5 h-5 text-violet-700"/><div><h4 className="font-black">Pergunte aos seus dados</h4><p className="text-xs text-stone-500">Ex.: “Por que minha nota caiu?”, “Qual horário tem mais reclamações?” ou “O que os clientes acham do atendimento?”</p></div></div>
      <div className="mt-4 flex flex-col sm:flex-row gap-2"><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Faça uma pergunta sobre as avaliações..." className="flex-1 rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"/><button disabled={asking || !question.trim()} className="rounded-xl bg-stone-900 text-white px-4 py-2.5 text-xs font-black disabled:opacity-50">{asking?'Consultando...':'Perguntar à IA'}</button></div>
      {answer && <div className="mt-4 rounded-xl bg-violet-50 border border-violet-100 p-4 text-sm leading-6 text-stone-800">{answer}</div>}
    </form>
  </div>;
}
