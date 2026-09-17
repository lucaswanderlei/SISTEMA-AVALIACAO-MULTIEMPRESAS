import crypto from 'node:crypto';
import { CommerceError } from './commerce-security';
export const PLANS = ['basic', 'pro', 'premium'] as const;
export function quote(prices: any, plan: string, cycle: string, discount: number) {
  if (!(PLANS as readonly string[]).includes(plan) || !['monthly','annual'].includes(cycle)) throw new CommerceError(400,'Plano ou período inválido.');
  if (!Number.isFinite(discount) || discount < 0 || discount > 90) throw new CommerceError(400,'O desconto deve estar entre 0 e 90%.');
  const monthly = Math.round(Number(prices[plan]) * 100);
  if (!Number.isSafeInteger(monthly) || monthly < 100 || monthly > 10000000) throw new CommerceError(400,'Defina um preço mensal válido no SuperAdmin (R$ 1 a R$ 100.000).');
  const months = cycle === 'annual' ? 12 : 1;
  return { amount: Math.round(monthly * months * (cycle === 'annual' ? 1-discount/100 : 1)), months };
}
export function addMonths(date: Date, months: number) {
  const d = new Date(date); const day=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+months);
  const last = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(day,last)); return d;
}
export function verifyWebhook(secret: string, id: string, requestId: string, signature: string, now=Date.now()) {
  if (!secret || !/^[a-zA-Z0-9_-]{1,160}$/.test(id) || !/^[a-zA-Z0-9_-]{1,160}$/.test(requestId)) return false;
  const parts=signature.split(',').map(x=>x.trim().split('=')); const ts=parts.find(x=>x[0]==='ts')?.[1];
  if (!ts || !/^\d{10,13}$/.test(ts)) return false;
  const time=Number(ts)*(ts.length===10?1000:1);
  if (Math.abs(now-time)>10*60*1000) return false;
  const expected=crypto.createHmac('sha256',secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest();
  return parts.some(([k,v])=>k==='v1' && /^[a-f0-9]{64}$/i.test(v||'') && crypto.timingSafeEqual(expected,Buffer.from(v,'hex')));
}
export function validCheckoutUrl(value: unknown) {
  try {const u=new URL(String(value)); return u.protocol==='https:' && (u.hostname==='mercadopago.com.br'||u.hostname.endsWith('.mercadopago.com.br')) ? u.toString() : null;} catch {return null;}
}
export function validatePayment(p:any, order:any, config:{collector:string;live:boolean}, recurringId?:string) {
  if (!/^\d+$/.test(String(p.id)) || String(p.collector_id)!==config.collector || p.live_mode!==config.live || p.currency_id!=='BRL' || Math.round(Number(p.transaction_amount)*100)!==Number(order.amount)) throw new CommerceError(409,'Pagamento incompatível com a cobrança.','BILLING_MISMATCH');
  if (order.method==='pix') {
    if (p.payment_method_id!=='pix'||p.external_reference!==order.id || (order.remote_id && String(p.id)!==order.remote_id)) throw new CommerceError(409,'Pagamento não pertence à cobrança.');
  } else if (!recurringId || recurringId!==order.remote_id) throw new CommerceError(409,'Assinatura do pagamento não confere.');
}
export function publicOrder(o:any) {
  return {id:o.id,plan:o.plan,cycle:o.cycle,method:o.method,amount:Number(o.amount),status:o.status,createdAt:o.created_at,
    checkoutUrl:validCheckoutUrl(o.checkout_url),pixCode:o.pix_code||null,pixExpiresAt:o.pix_expires_at,remoteId:o.remote_id};
}
