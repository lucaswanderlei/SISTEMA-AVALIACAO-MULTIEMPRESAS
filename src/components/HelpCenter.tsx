import { BookOpen, CheckCircle2, ClipboardList, Gift, MessageCircle, QrCode, Settings2, X } from 'lucide-react';

type HelpCenterProps = {
  open: boolean;
  onClose: () => void;
  companyName: string;
};

const steps = [
  { icon: Settings2, title: '1. Configure sua empresa', text: 'No Painel do Restaurante, complete nome, logo, cores, categorias e as opções que aparecerão na avaliação.' },
  { icon: ClipboardList, title: '2. Cadastre os itens consumidos', text: 'Adicione produtos e serviços para que o cliente informe o que consumiu. Você pode criar, editar ou excluir itens a qualquer momento.' },
  { icon: Gift, title: '3. Configure os prêmios', text: 'Defina os brindes da roleta, quantidade disponível, validade e regras de resgate. O sistema gera o voucher com segurança.' },
  { icon: QrCode, title: '4. Gere e imprima os QR Codes', text: 'Abra Placas & Totens QR, escolha o modelo e imprima para colocar em mesas, balcão ou embalagens.' },
  { icon: MessageCircle, title: '5. Acompanhe as avaliações', text: 'No painel você vê notas, críticas, itens avaliados, clientes recorrentes e contatos autorizados para relacionamento.' },
  { icon: CheckCircle2, title: '6. Resgate os vouchers', text: 'Quando o cliente voltar, informe ou escaneie o código do voucher. O resgate é validado pelo sistema e não pode ser repetido.' },
];

export function HelpCenter({ open, onClose, companyName }: HelpCenterProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-stone-950/45 p-3 sm:p-6 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Central de ajuda">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-stone-50 rounded-3xl shadow-2xl border border-white">
        <div className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur border-b border-stone-200 px-5 sm:px-7 py-5 flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-11 h-11 shrink-0 rounded-2xl bg-rose-700 text-white grid place-items-center"><BookOpen className="w-5 h-5" /></div>
            <div><p className="text-xs uppercase tracking-wider font-black text-rose-700">Central de ajuda</p><h2 className="text-xl sm:text-2xl font-black text-stone-900 leading-tight">Como usar o {companyName || 'Avalia e Ganha'}</h2></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-stone-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl" aria-label="Fechar ajuda"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 sm:p-7">
          <div className="rounded-2xl bg-rose-700 text-white p-5 mb-6"><p className="font-black text-lg">Primeiro acesso?</p><p className="text-sm leading-relaxed text-rose-100 mt-1">Siga esta ordem para deixar o sistema pronto: empresa → itens → prêmios → QR Code → acompanhamento.</p></div>
          <div className="grid sm:grid-cols-2 gap-3">
            {steps.map(({ icon: Icon, title, text }) => <article key={title} className="bg-white border border-stone-200 rounded-2xl p-4"><div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 grid place-items-center mb-3"><Icon className="w-4 h-4" /></div><h3 className="font-black text-stone-900 text-sm">{title}</h3><p className="text-xs text-stone-600 leading-relaxed mt-1.5">{text}</p></article>)}
          </div>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-900">Dica importante</p><p className="text-xs text-amber-800 leading-relaxed mt-1">Faça um teste completo antes de entregar o QR Code ao cliente: avalie, gire a roleta e valide o voucher no painel.</p></div>
        </div>
      </div>
    </div>
  );
}
