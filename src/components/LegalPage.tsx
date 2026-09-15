import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, LockKeyhole, Mail, Phone, Send, ShieldCheck } from 'lucide-react';
import { apiFetchSync, tenantFetch } from '../lib/api';
import { withCompanyParam } from '../lib/tenant';
import type { RestaurantSettings } from '../types';

type LegalKind = 'privacy' | 'terms';

type RequestType = 'access' | 'correction' | 'deletion' | 'marketing_revocation';

const DEFAULT_SETTINGS: Partial<RestaurantSettings> = {
  name: 'Estabelecimento',
  legalName: '',
  privacyContactEmail: '',
  privacyContactPhone: '',
};

export const LegalPage: React.FC<{ kind: LegalKind }> = ({ kind }) => {
  const [settings, setSettings] = useState<Partial<RestaurantSettings>>(DEFAULT_SETTINGS);
  const [requestType, setRequestType] = useState<RequestType>('access');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void apiFetchSync().then((data) => {
      if (data?.settings) setSettings(data.settings);
    });
  }, []);

  const companyName = settings.name || 'Estabelecimento';
  const legalName = settings.legalName || companyName;

  const submitPrivacyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await tenantFetch('/api/privacy/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: requestType, name, phone, email, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível enviar a solicitação.');
      setFeedback({ type: 'success', text: `Solicitação registrada${data.protocol ? ` sob o protocolo ${data.protocol}` : ''}. O estabelecimento poderá entrar em contato para confirmar sua identidade antes de concluir o pedido.` });
      setMessage('');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Falha ao enviar a solicitação.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <a href={withCompanyParam('/')} className="inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-900 mb-5">
          <ArrowLeft className="w-4 h-4" /> Voltar para a avaliação
        </a>

        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 bg-gradient-to-br from-stone-950 via-stone-900 to-rose-950 text-white">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-white/10 border border-white/10">
                {kind === 'privacy' ? <ShieldCheck className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-300 font-bold">{companyName}</p>
                <h1 className="text-2xl sm:text-3xl font-black">{kind === 'privacy' ? 'Aviso de Privacidade' : 'Termos da Avaliação e Cortesia'}</h1>
              </div>
            </div>
          </div>

          {kind === 'privacy' ? (
            <div className="p-6 sm:p-8 space-y-7 text-sm leading-relaxed text-stone-700">
              <section>
                <h2 className="font-black text-stone-900 text-lg mb-2">Quem trata seus dados</h2>
                <p><strong>{legalName}</strong> utiliza este formulário para registrar sua avaliação, identificar seu voucher e manter o relacionamento relacionado ao atendimento.</p>
              </section>

              <section>
                <h2 className="font-black text-stone-900 text-lg mb-2">Quais dados são coletados</h2>
                <p>Podem ser coletados nome, telefone/WhatsApp, mesa, notas atribuídas, comentários, atendente avaliado, informações do voucher e registros técnicos necessários para manter a segurança e o funcionamento do serviço.</p>
              </section>

              <section>
                <h2 className="font-black text-stone-900 text-lg mb-2">Para que os dados são usados</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>registrar e analisar sua experiência no estabelecimento;</li>
                  <li>emitir, validar e comunicar a cortesia/voucher vinculada à avaliação;</li>
                  <li>atender solicitações e prevenir usos indevidos do programa de cortesias;</li>
                  <li>enviar novidades e ofertas apenas quando essa opção for disponibilizada e escolhida por você.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-black text-stone-900 text-lg mb-2">Compartilhamento e segurança</h2>
                <p>Os dados podem ser processados por fornecedores de tecnologia necessários à operação do sistema e das comunicações. O estabelecimento deve limitar o acesso aos dados às pessoas autorizadas e adotar medidas de segurança compatíveis com o serviço.</p>
              </section>

              <section>
                <h2 className="font-black text-stone-900 text-lg mb-2">Seus pedidos de privacidade</h2>
                <p>Você pode solicitar acesso, correção, exclusão/anonimização de dados pessoais ou revogação de comunicações promocionais. Antes de executar pedidos sensíveis, o estabelecimento poderá pedir confirmação de identidade.</p>
                {(settings.privacyContactEmail || settings.privacyContactPhone) && (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                    {settings.privacyContactEmail && <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 rounded-xl"><Mail className="w-3.5 h-3.5" />{settings.privacyContactEmail}</span>}
                    {settings.privacyContactPhone && <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 rounded-xl"><Phone className="w-3.5 h-3.5" />{settings.privacyContactPhone}</span>}
                  </div>
                )}
              </section>

              <form onSubmit={submitPrivacyRequest} className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 font-black text-stone-900"><LockKeyhole className="w-5 h-5 text-rose-600" />Solicitar atendimento de privacidade</div>
                  <p className="text-xs text-stone-500 mt-1">O pedido será encaminhado à empresa responsável pelos dados desta avaliação.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-stone-700">Tipo de solicitação
                    <select value={requestType} onChange={(e) => setRequestType(e.target.value as RequestType)} className="mt-1 w-full p-3 rounded-xl border border-stone-300 bg-white text-sm">
                      <option value="access">Acessar meus dados</option>
                      <option value="correction">Corrigir meus dados</option>
                      <option value="deletion">Excluir/anonimizar meus dados</option>
                      <option value="marketing_revocation">Parar comunicações promocionais</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-stone-700">Nome
                    <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full p-3 rounded-xl border border-stone-300 bg-white text-sm" placeholder="Seu nome" />
                  </label>
                  <label className="text-xs font-bold text-stone-700">Telefone usado na avaliação *
                    <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full p-3 rounded-xl border border-stone-300 bg-white text-sm" placeholder="(82) 99999-9999" />
                  </label>
                  <label className="text-xs font-bold text-stone-700">E-mail para retorno (opcional)
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full p-3 rounded-xl border border-stone-300 bg-white text-sm" placeholder="voce@email.com" />
                  </label>
                </div>
                <label className="text-xs font-bold text-stone-700 block">Detalhes (opcional)
                  <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full p-3 rounded-xl border border-stone-300 bg-white text-sm resize-y" placeholder="Explique o que precisa ser corrigido ou qualquer informação útil." />
                </label>

                {feedback && <div className={`p-3 rounded-xl text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>{feedback.text}</div>}
                <button disabled={busy} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-black inline-flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> {busy ? 'Enviando...' : 'Enviar solicitação'}
                </button>
              </form>

              <p className="text-[11px] text-stone-400">Versão do aviso: 2026-09-v1. O conteúdo operacional pode ser complementado pela política própria do estabelecimento.</p>
            </div>
          ) : (
            <div className="p-6 sm:p-8 space-y-6 text-sm leading-relaxed text-stone-700">
              <section><h2 className="font-black text-stone-900 text-lg mb-2">1. Finalidade</h2><p>Este formulário permite registrar sua opinião sobre a experiência em <strong>{companyName}</strong> e, quando disponível, emitir uma cortesia vinculada à avaliação.</p></section>
              <section><h2 className="font-black text-stone-900 text-lg mb-2">2. Cortesias e vouchers</h2><p>As condições de validade, prazo, disponibilidade e resgate são exibidas no voucher gerado. A cortesia não é convertível em dinheiro e pode estar sujeita às regras específicas informadas pelo estabelecimento.</p></section>
              <section><h2 className="font-black text-stone-900 text-lg mb-2">3. Uso adequado</h2><p>O usuário deve informar dados verdadeiros e não deve tentar obter múltiplas cortesias por meios artificiais, manipular o sistema ou utilizar códigos pertencentes a terceiros.</p></section>
              <section><h2 className="font-black text-stone-900 text-lg mb-2">4. Disponibilidade</h2><p>O serviço pode sofrer indisponibilidades temporárias por manutenção, internet ou serviços de terceiros. O estabelecimento poderá validar manualmente situações excepcionais.</p></section>
              <section><h2 className="font-black text-stone-900 text-lg mb-2">5. Privacidade</h2><p>O tratamento de dados pessoais utilizado neste fluxo é explicado no <a href={withCompanyParam('/privacidade')} className="font-black text-rose-700 underline">Aviso de Privacidade</a>.</p></section>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex gap-2"><CheckCircle2 className="w-5 h-5 shrink-0" /><p className="text-xs font-semibold">Ao concluir a avaliação, você confirma que as informações enviadas refletem sua experiência e que leu as regras apresentadas no fluxo.</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
