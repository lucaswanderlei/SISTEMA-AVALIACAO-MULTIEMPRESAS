import crypto from 'node:crypto';
import { CommerceError } from './commerce-security';
import { quote, addMonths, verifyWebhook, validatePayment, publicOrder, validCheckoutUrl, PLANS } from './billing-core';

export async function initBillingSchema(pool:any) {
  for (const statement of `CREATE TABLE IF NOT EXISTS avaliacao_billing_orders (
    id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES avaliacao_empresas(empresa_id),
    plan TEXT NOT NULL, cycle TEXT NOT NULL, method TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0),
    months INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'creating', payer_email TEXT NOT NULL,
    remote_id TEXT UNIQUE, checkout_url TEXT, pix_code TEXT, pix_expires_at TIMESTAMPTZ,
    request_body JSONB NOT NULL, dispatched BOOLEAN NOT NULL DEFAULT FALSE,
    remote_updated_at TIMESTAMPTZ, lease_until TIMESTAMPTZ, checked_at TIMESTAMPTZ NOT NULL DEFAULT '2000-01-01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS billing_one_open_order ON avaliacao_billing_orders(company_id)
    WHERE status IN ('creating','uncertain','pending','in_process','authorized','paused');
  CREATE TABLE IF NOT EXISTS avaliacao_billing_payments (
    id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES avaliacao_billing_orders(id), status TEXT NOT NULL,
    amount INTEGER NOT NULL, refunded INTEGER NOT NULL DEFAULT 0, paid_at TIMESTAMPTZ,
    provider_updated_at TIMESTAMPTZ NOT NULL, granted_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS avaliacao_billing_events (
    event_key TEXT PRIMARY KEY, topic TEXT NOT NULL, resource_id TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, next_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    done BOOLEAN NOT NULL DEFAULT FALSE, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`.split(';').filter(s=>s.trim())) await pool.query(statement);
}
function config() {
  const token=String(process.env.MP_ACCESS_TOKEN||'').trim(), secret=String(process.env.MP_WEBHOOK_SECRET||'').trim();
  const collector=String(process.env.MP_COLLECTOR_ID||'').trim(), base=String(process.env.PUBLIC_APP_URL||'').replace(/\/$/,'');
  let valid=false;try {const u=new URL(base);valid=u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/';}catch{}
  return {token,secret,collector,base,live:process.env.MP_LIVE_MODE!=='false',ready:Boolean(token&&secret&&/^\d+$/.test(collector)&&valid)};
}
export type MpApi=(path:string,method?:string,body?:any,key?:string)=>Promise<any>;
export const mpApi:MpApi=async(path,method='GET',body?,key?)=>{
  const c=config();if(!c.ready) throw new CommerceError(503,'O administrador ainda precisa configurar o Mercado Pago.','BILLING_NOT_CONFIGURED');
  try {
    const r=await fetch(`https://api.mercadopago.com${path}`,{method,headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json',...(key?{'X-Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    if(!r.ok) { const error = new CommerceError(502,`Mercado Pago não confirmou a operação (HTTP ${r.status}). Verifique as credenciais e os dados do pagador.`,'MP_ERROR'); (error as any).definitiveRejection = [400,401,403,404,422].includes(r.status); throw error; }
    return await r.json();
  } catch(e) {if(e instanceof CommerceError)throw e;throw new CommerceError(502,'Não foi possível confirmar a resposta do Mercado Pago. A cobrança será consultada novamente.','MP_UNCERTAIN');}
};
async function tx(pool:any,work:(c:any)=>Promise<any>){const c=await pool.connect();try{await c.query('BEGIN');const r=await work(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function discount(pool:any){const r=await pool.query('SELECT dados FROM avaliacao_plataforma_config WHERE id=1');return Number(r.rows[0]?.dados?.annualDiscountPercent||0);}
function assertCompany(c:any) {
  if(!c)throw new CommerceError(404,'Empresa não encontrada.');
  if(!c.ativo || c.status_assinatura==='suspended')throw new CommerceError(403,'Empresa suspensa administrativamente. Entre em contato com o suporte antes de contratar.');
}
export async function prepareOrder(pool:any, companyId:string, input:any, prices:any, annualDiscount:number, base:string) {
  const {plan,cycle,method}=input;
  if(!['pix','card'].includes(method))throw new CommerceError(400,'Escolha Pix ou cartão.');
  const email=String(input.email||'').trim().toLowerCase();
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new CommerceError(400,'Informe um e-mail válido para o pagamento.');
  const price=quote(prices,plan,cycle,annualDiscount);
  return tx(pool,async c=>{
    const company=(await c.query('SELECT * FROM avaliacao_empresas WHERE empresa_id=$1 FOR UPDATE',[companyId])).rows[0];assertCompany(company);
    const existing=(await c.query("SELECT * FROM avaliacao_billing_orders WHERE company_id=$1 AND status IN ('creating','uncertain','pending','in_process','authorized','paused')",[companyId])).rows[0];
    if(existing) {
      if(existing.plan===plan&&existing.cycle===cycle&&existing.method===method)return existing;
      throw new CommerceError(409,'Já existe uma cobrança ou assinatura em andamento. Consulte ou cancele antes de mudar.');
    }
    if(company.status_assinatura==='active' && (!company.vencimento_em||new Date(company.vencimento_em)>new Date()) && company.plano!==plan)throw new CommerceError(409,'A mudança de plano fica disponível após o vencimento. Para antecipar, fale com o suporte.');
    const recent=await c.query("SELECT COUNT(*)::int AS n FROM avaliacao_billing_orders WHERE company_id=$1 AND created_at>NOW()-INTERVAL '1 day'",[companyId]);
    if(recent.rows[0].n>=10)throw new CommerceError(429,'Limite diário de novas cobranças atingido.');
    const id=crypto.randomUUID();const amount=price.amount/100;
    const common={external_reference:id};
    const billingEmail=String(company.email_cobranca||email).trim().toLowerCase();
    const document=String(company.documento_cobranca||'').replace(/\D/g,'');
    const documentType=String(company.tipo_documento_cobranca||'').toUpperCase();
    const payer={email:billingEmail,...((documentType==='CPF'||documentType==='CNPJ')&&document?{identification:{type:documentType,number:document}}:{})};
    const body=method==='pix'?{...common,transaction_amount:amount,description:`Avalia e Ganha • ${plan} • ${cycle==='annual'?'anual':'mensal'}`,payment_method_id:'pix',payer,date_of_expiration:new Date(Date.now()+30*60*1000).toISOString(),notification_url:`${base}/api/billing/webhook?source_news=webhooks`}
      :{...common,reason:`Avalia e Ganha • ${plan} • ${cycle==='annual'?'anual':'mensal'}`,payer_email:billingEmail,auto_recurring:{frequency:price.months,frequency_type:'months',transaction_amount:amount,currency_id:'BRL',...(company.vencimento_em&&new Date(company.vencimento_em).getTime()>Date.now()+3600000?{start_date:new Date(company.vencimento_em).toISOString()}: {})},back_url:`${base}/assinatura?empresa=${encodeURIComponent(companyId)}`,status:'pending'};
    return (await c.query(`INSERT INTO avaliacao_billing_orders(id,company_id,plan,cycle,method,amount,months,payer_email,request_body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,[id,companyId,plan,cycle,method,price.amount,price.months,billingEmail,JSON.stringify(body)])).rows[0];
  });
}
export async function createRemote(pool:any,order:any,api:MpApi=mpApi) {
  if(order.remote_id)return order;
  const claimed=(await pool.query("UPDATE avaliacao_billing_orders SET lease_until=NOW()+INTERVAL '90 seconds',dispatched=TRUE WHERE id=$1 AND remote_id IS NULL AND (lease_until IS NULL OR lease_until<NOW()) AND (method='pix' OR dispatched=FALSE) RETURNING *",[order.id])).rows[0];
  if(!claimed)return (await pool.query('SELECT * FROM avaliacao_billing_orders WHERE id=$1',[order.id])).rows[0];
  try {
    const remote=await api(order.method==='pix'?'/v1/payments':'/preapproval','POST',claimed.request_body,claimed.id);
    if(!remote.id)throw new CommerceError(502,'Resposta de pagamento incompleta.');
    // Status is reconciled separately; creation/authorization alone NEVER grants access.
    await pool.query("UPDATE avaliacao_billing_orders SET remote_id=COALESCE(remote_id,$2),checkout_url=$3,pix_code=$4,pix_expires_at=$5,status=CASE WHEN status='creating' OR status='uncertain' THEN 'pending' ELSE status END,lease_until=NULL,updated_at=NOW() WHERE id=$1",[order.id,String(remote.id),validCheckoutUrl(remote.init_point),remote.point_of_interaction?.transaction_data?.qr_code||null,remote.date_of_expiration||null]);
  } catch(e) {await pool.query("UPDATE avaliacao_billing_orders SET status=CASE WHEN status IN ('creating','uncertain') THEN $2 ELSE status END,lease_until=NULL WHERE id=$1",[order.id,(e as any).definitiveRejection?'rejected':'uncertain']);throw e;}
  return (await pool.query('SELECT * FROM avaliacao_billing_orders WHERE id=$1',[order.id])).rows[0];
}
export async function applyPayment(pool:any,orderId:string,p:any,cfg:{collector:string;live:boolean},recurringId?:string) {
  return tx(pool,async c=>{
    // All billing mutations take company before order locks.
    const link=(await c.query('SELECT company_id FROM avaliacao_billing_orders WHERE id=$1',[orderId])).rows[0];if(!link)return;
    const company=(await c.query('SELECT * FROM avaliacao_empresas WHERE empresa_id=$1 FOR UPDATE',[link.company_id])).rows[0];
    const o=(await c.query('SELECT * FROM avaliacao_billing_orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];validatePayment(p,o,cfg,recurringId);
    const updated=new Date(p.date_last_updated||p.date_created);if(!Number.isFinite(updated.getTime()))throw new CommerceError(409,'Data do pagamento inválida.');
    const old=(await c.query('SELECT * FROM avaliacao_billing_payments WHERE id=$1 FOR UPDATE',[String(p.id)])).rows[0];
    if(old&&old.order_id!==o.id)throw new CommerceError(409,'Pagamento já associado a outra cobrança.');
    if(old&&new Date(old.provider_updated_at)>updated)return;
    const refunded=Math.round(Number(p.transaction_amount_refunded||0)*100);
    const reversal=['refunded','charged_back'].includes(p.status)||refunded>0;
    let until=old?.granted_until||null;const paidAt=p.date_approved?new Date(p.date_approved):null;
    if(p.status==='approved'&&!reversal&&!until) {
      if(!paidAt||!Number.isFinite(paidAt.getTime())||paidAt.getTime()>Date.now()+300000)throw new CommerceError(409,'Data de aprovação inválida.');
      if(o.method==='pix'&&(await c.query('SELECT id FROM avaliacao_billing_payments WHERE order_id=$1 AND granted_until IS NOT NULL',[o.id])).rows.length)throw new CommerceError(409,'Cobrança Pix já possui um pagamento.');
      // Months are calendar months; delayed notifications cannot create free time from receipt date.
      const baseline=company.vencimento_em?new Date(company.vencimento_em):paidAt;
      until=addMonths(baseline>paidAt?baseline:paidAt,Number(o.months));
      await c.query("UPDATE avaliacao_empresas SET plano=$2,vencimento_em=$3,status_assinatura=CASE WHEN status_assinatura='suspended' THEN status_assinatura ELSE 'active' END,atualizado_em=NOW() WHERE empresa_id=$1",[o.company_id,o.plan,until]);
    }
    if(reversal&&until&&new Date(until)>new Date())await c.query("UPDATE avaliacao_empresas SET status_assinatura='suspended',atualizado_em=NOW() WHERE empresa_id=$1",[o.company_id]);
    await c.query(`INSERT INTO avaliacao_billing_payments(id,order_id,status,amount,refunded,paid_at,provider_updated_at,granted_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,refunded=EXCLUDED.refunded,provider_updated_at=EXCLUDED.provider_updated_at,granted_until=EXCLUDED.granted_until,checked_at=NOW()`,[String(p.id),o.id,String(p.status),o.amount,refunded,paidAt,updated,until]);
    if(o.method==='pix')await c.query('UPDATE avaliacao_billing_orders SET status=$2,remote_id=COALESCE(remote_id,$3),updated_at=NOW() WHERE id=$1',[o.id,String(p.status),String(p.id)]);
    return until;
  });
}
async function syncSubscription(pool:any,remote:any) {
  const o=(await pool.query('SELECT * FROM avaliacao_billing_orders WHERE id=$1',[String(remote.external_reference||'')])).rows[0];if(!o||o.method!=='card')return null;
  if(o.remote_id&&o.remote_id!==String(remote.id))throw new CommerceError(409,'Assinatura duplicada no provedor.');
  const c=config();const a=remote.auto_recurring;
  const changed=new Date(remote.last_modified||remote.date_created);
  if(!Number.isFinite(changed.getTime()))throw new CommerceError(409,'Data da assinatura inválida.');
  if(String(remote.collector_id)!==c.collector||a?.currency_id!=='BRL'||Math.round(Number(a.transaction_amount)*100)!==o.amount||Number(a.frequency)!==o.months||a.frequency_type!=='months')throw new CommerceError(409,'Dados da assinatura divergentes.');
  if(!['pending','in_process','authorized','paused','cancelled'].includes(remote.status))throw new CommerceError(409,'Estado da assinatura não reconhecido.');
  await pool.query("UPDATE avaliacao_billing_orders SET remote_id=$2,checkout_url=$3,status=CASE WHEN status='cancelled' THEN status ELSE $4 END,remote_updated_at=$5,updated_at=NOW() WHERE id=$1 AND (remote_updated_at IS NULL OR remote_updated_at<=$5)",[o.id,String(remote.id),validCheckoutUrl(remote.init_point),remote.status,changed]);
  return {...o,remote_id:String(remote.id)};
}
async function syncAuthorized(pool:any,id:string,api:MpApi) {
  const a=await api(`/authorized_payments/${encodeURIComponent(id)}`);
  const s=await api(`/preapproval/${encodeURIComponent(String(a.preapproval_id))}`);
  const o=await syncSubscription(pool,s);if(!o)return;
  if(a.payment?.id) {
    const p=await api(`/v1/payments/${encodeURIComponent(String(a.payment.id))}`);
    await applyPayment(pool,o.id,p,config(),String(a.preapproval_id));
  }
}
export async function reconcileOrder(pool:any,order:any,api:MpApi=mpApi) {
  await pool.query('UPDATE avaliacao_billing_orders SET checked_at=NOW() WHERE id=$1',[order.id]);
  let o=order;
  if(!o.remote_id) {
    if(o.method==='pix')o=await createRemote(pool,o,api);
    else if(!o.dispatched)o=await createRemote(pool,o,api);
    else {
      const r=await api(`/preapproval/search?external_reference=${encodeURIComponent(o.id)}`);
      const matches=(r.results||[]).filter((s:any)=>s.external_reference===o.id);
      if(matches.length>1)throw new CommerceError(409,'Mais de uma assinatura encontrada; verifique no Mercado Pago.');
      if(matches.length===1)o=await syncSubscription(pool,await api(`/preapproval/${encodeURIComponent(String(matches[0].id))}`));
    }
  }
  if(!o?.remote_id)return;
  if(o.method==='pix')return applyPayment(pool,o.id,await api(`/v1/payments/${encodeURIComponent(o.remote_id)}`),config());
  await syncSubscription(pool,await api(`/preapproval/${encodeURIComponent(o.remote_id)}`));
  // Paginate to recover every missed renewal after a restart/outage.
  for(let offset=0;offset<10000;offset+=100) {
    const r=await api(`/authorized_payments/search?preapproval_id=${encodeURIComponent(o.remote_id)}&limit=100&offset=${offset}`);
    const items=r.results||[];
    for(const a of items)await syncAuthorized(pool,String(a.id),api);
    if(items.length<100)break;
  }
}
export async function handleBillingEvent(pool:any,topic:string,id:string,api:MpApi=mpApi) {
  if(topic==='subscription_preapproval') {await syncSubscription(pool,await api(`/preapproval/${encodeURIComponent(id)}`));return;}
  if(topic==='subscription_authorized_payment') {await syncAuthorized(pool,id,api);return;}
  const p=await api(`/v1/payments/${encodeURIComponent(id)}`);
  const o=(await pool.query('SELECT * FROM avaliacao_billing_orders WHERE id=$1',[String(p.external_reference||'')])).rows[0];
  if(o?.method==='pix')await applyPayment(pool,o.id,p,config());
  else if(o)await reconcileOrder(pool,o,api);
  else {
    // Recurring payments can omit external_reference; previously linked payments remain traceable.
    const old=(await pool.query('SELECT o.* FROM avaliacao_billing_orders o JOIN avaliacao_billing_payments p ON p.order_id=o.id WHERE p.id=$1',[id])).rows[0];
    if(old)await applyPayment(pool,old.id,p,config(),old.method==='card'?old.remote_id:undefined);
  }
}
export function registerBillingRoutes(app:any,pool:any,owner:any,superAdmin:any,companyId:()=>string,prices:()=>Promise<any>) {
  app.post('/api/billing/webhook',async(req:any,res:any)=>{
    const c=config();if(!c.ready)return res.status(503).json({error:'Pagamento não configurado.'});
    const id=typeof req.query['data.id']==='string'?req.query['data.id']:'';
    if(!verifyWebhook(c.secret,id,String(req.header('x-request-id')||''),String(req.header('x-signature')||'')))return res.status(401).json({error:'Assinatura inválida.'});
    const topic=String(req.body?.type||req.query.type||'');
    if(!['payment','subscription_preapproval','subscription_authorized_payment'].includes(topic))return res.sendStatus(200);
    if(req.body?.data?.id!=null&&String(req.body.data.id).toLowerCase()!==id.toLowerCase())return res.sendStatus(400);
    const key=crypto.createHash('sha256').update(`${topic}:${id}:${req.header('x-request-id')}`).digest('hex');
    await pool.query('INSERT INTO avaliacao_billing_events(event_key,topic,resource_id)VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[key,topic,id]);
    res.sendStatus(200); // Durable acceptance. Worker retries provider/database failures.
  });
  app.get('/api/billing',owner,async(_req:any,res:any)=>{
    const id=companyId();const d=await discount(pool);const p=await prices();
    const company=(await pool.query('SELECT empresa_id,nome,plano,ativo,status_assinatura,vencimento_em,email_cobranca,telefone_cobranca,documento_cobranca,tipo_documento_cobranca FROM avaliacao_empresas WHERE empresa_id=$1',[id])).rows[0];
    const orders=(await pool.query('SELECT * FROM avaliacao_billing_orders WHERE company_id=$1 ORDER BY created_at DESC LIMIT 30',[id])).rows.map(publicOrder);
    const payments=(await pool.query('SELECT p.id,p.status,p.amount,p.refunded,p.paid_at,p.granted_until,o.plan,o.cycle FROM avaliacao_billing_payments p JOIN avaliacao_billing_orders o ON o.id=p.order_id WHERE o.company_id=$1 ORDER BY p.created_at DESC LIMIT 100',[id])).rows;
    const offers=PLANS.map(plan=>{try{return {plan,monthly:quote(p,plan,'monthly',d).amount,annual:quote(p,plan,'annual',d).amount};}catch{return {plan,monthly:0,annual:0};}});
    res.setHeader('Cache-Control','no-store');res.json({company,offers,annualDiscountPercent:d,configured:config().ready,orders,payments});
  });
  app.post('/api/billing/orders',owner,async(req:any,res:any)=>{
    const c=config();if(!c.ready)throw new CommerceError(503,'Configure o Mercado Pago antes de gerar cobranças.');
    const o=await prepareOrder(pool,companyId(),req.body||{},await prices(),await discount(pool),c.base);
    res.json({order:publicOrder(await createRemote(pool,o))});
  });
  async function owned(id:string){const o=(await pool.query('SELECT * FROM avaliacao_billing_orders WHERE id=$1 AND company_id=$2',[id,companyId()])).rows[0];if(!o)throw new CommerceError(404,'Cobrança não encontrada.');return o;}
  app.post('/api/billing/orders/:id/sync',owner,async(req:any,res:any)=>{
    const o=await owned(req.params.id);
    const gate=await pool.query("UPDATE avaliacao_billing_orders SET checked_at=NOW() WHERE id=$1 AND checked_at<NOW()-INTERVAL '15 seconds' RETURNING id",[o.id]);
    if(!gate.rows.length)throw new CommerceError(429,'Aguarde alguns segundos antes de consultar novamente.');
    await reconcileOrder(pool,o);res.json({success:true});
  });
  app.post('/api/billing/orders/:id/cancel',owner,async(req:any,res:any)=>{
    const o=await owned(req.params.id);
    if(['cancelled','approved','refunded','charged_back','rejected'].includes(o.status))return res.json({success:true});
    if(!o.remote_id) {await reconcileOrder(pool,o);throw new CommerceError(409,'Cobrança em confirmação. Atualize o status antes de cancelar.');}
    if(o.method==='card') {
      await mpApi(`/preapproval/${encodeURIComponent(o.remote_id)}`,'PUT',{status:'cancelled'});
      const s=await mpApi(`/preapproval/${encodeURIComponent(o.remote_id)}`);
      if(s.status!=='cancelled')throw new CommerceError(502,'Cancelamento ainda não confirmado.');
      await syncSubscription(pool,s);
    } else {
      await mpApi(`/v1/payments/${encodeURIComponent(o.remote_id)}`,'PUT',{status:'cancelled'});
      const p=await mpApi(`/v1/payments/${encodeURIComponent(o.remote_id)}`);
      await applyPayment(pool,o.id,p,config());
    }
    res.json({success:true});
  });
  app.get('/api/admin/billing',superAdmin,async(_req:any,res:any)=>{
    const c=config();res.json({configured:c.ready,annualDiscountPercent:await discount(pool),webhookUrl:c.base?`${c.base}/api/billing/webhook`:'',
      pendingEvents:(await pool.query('SELECT COUNT(*)::int AS n FROM avaliacao_billing_events WHERE done=FALSE')).rows[0].n,
      orders:(await pool.query('SELECT o.id,o.company_id,e.nome,o.plan,o.cycle,o.method,o.amount,o.status,o.created_at FROM avaliacao_billing_orders o JOIN avaliacao_empresas e ON e.empresa_id=o.company_id ORDER BY o.created_at DESC LIMIT 100')).rows,
      payments:(await pool.query('SELECT p.id,p.status,p.amount,p.refunded,p.paid_at,o.company_id,e.nome FROM avaliacao_billing_payments p JOIN avaliacao_billing_orders o ON o.id=p.order_id JOIN avaliacao_empresas e ON e.empresa_id=o.company_id ORDER BY p.created_at DESC LIMIT 100')).rows});
  });
  app.put('/api/admin/billing',superAdmin,async(req:any,res:any)=>{
    const d=req.body?.annualDiscountPercent;
    if(typeof d!=='number'||!Number.isFinite(d)||d<0||d>90)throw new CommerceError(400,'Informe um desconto entre 0 e 90%.');
    await pool.query(`INSERT INTO avaliacao_plataforma_config(id,dados,atualizado_em) VALUES(1,jsonb_build_object('annualDiscountPercent',$1::numeric),NOW()) ON CONFLICT(id) DO UPDATE SET dados=jsonb_set(avaliacao_plataforma_config.dados,'{annualDiscountPercent}',to_jsonb($1::numeric)),atualizado_em=NOW()`,[Math.round(d*100)/100]);
    res.json({success:true});
  });
}
export function startBillingWorker(pool:any) {
  let running=false;
  const tick=async()=>{
    if(running||!config().ready)return;running=true;
    try {
      const events=(await pool.query(`UPDATE avaliacao_billing_events SET next_at=NOW()+INTERVAL '5 minutes',attempts=attempts+1 WHERE event_key IN (SELECT event_key FROM avaliacao_billing_events WHERE done=FALSE AND next_at<=NOW() ORDER BY next_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *`)).rows;
      for(const e of events) {
        try {await handleBillingEvent(pool,e.topic,e.resource_id);await pool.query('UPDATE avaliacao_billing_events SET done=TRUE,last_error=NULL WHERE event_key=$1',[e.event_key]);}
        catch {await pool.query("UPDATE avaliacao_billing_events SET last_error='Falha na conciliação; nova tentativa agendada.' WHERE event_key=$1",[e.event_key]);}
      }
      const orders=(await pool.query(`UPDATE avaliacao_billing_orders SET checked_at=NOW() WHERE id IN (SELECT id FROM avaliacao_billing_orders WHERE (status IN ('creating','uncertain','pending','in_process','authorized','paused') OR (method='card' AND updated_at>NOW()-INTERVAL '7 days')) AND checked_at<NOW()-INTERVAL '10 minutes' ORDER BY checked_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING *`)).rows;
      for(const o of orders)try{await reconcileOrder(pool,o);}catch{console.warn('[Billing] Cobrança aguardando conciliação:',o.id);}
      const payments=(await pool.query(`UPDATE avaliacao_billing_payments SET checked_at=NOW() WHERE id IN (SELECT id FROM avaliacao_billing_payments WHERE checked_at<NOW()-INTERVAL '1 day' AND granted_until>NOW() ORDER BY checked_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING id`)).rows;
      for(const p of payments)try{await handleBillingEvent(pool,'payment',p.id);}catch{console.warn('[Billing] Pagamento aguardando conciliação:',p.id);}
      await pool.query("DELETE FROM avaliacao_billing_events WHERE done=TRUE AND created_at<NOW()-INTERVAL '30 days'");
    } catch {console.warn('[Billing] Conciliação indisponível; nova tentativa agendada.');}finally{running=false;}
  };
  const timer=setInterval(()=>void tick(),30000);timer.unref();void tick();return timer;
}
