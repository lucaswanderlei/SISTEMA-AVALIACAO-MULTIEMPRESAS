import { CommerceError, clone, digest, businessDay, normalizeReviewPhone, parseReviewInput, issueReview, claimReview } from './commerce-security';

const MONTHLY_REVIEW_LIMIT: Record<string, number> = { basic: 100, pro: 300, premium: Number.POSITIVE_INFINITY };

function reviewMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(date).slice(0, 7);
}

export async function initCommerceSchema(pool: any) {
  await pool.query(`CREATE TABLE IF NOT EXISTS avaliacao_review_requests (
    empresa_id TEXT NOT NULL REFERENCES avaliacao_empresas(empresa_id) ON DELETE CASCADE,
    request_hash TEXT NOT NULL, payload_hash TEXT NOT NULL, review_id TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (empresa_id, request_hash)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS avaliacao_review_daily_limits (
    empresa_id TEXT NOT NULL REFERENCES avaliacao_empresas(empresa_id) ON DELETE CASCADE,
    phone_hash TEXT NOT NULL, business_day TEXT NOT NULL,
    PRIMARY KEY (empresa_id, phone_hash, business_day)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS avaliacao_public_rate_limits (
    bucket_key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL
  )`);
}
export async function withCompanyTransaction<T>(pool: any, companyId: string,
  mutate: (db: any, client: any, company: any) => Promise<T> | T): Promise<{ value: T; db: any }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT dados, ativo, plano, status_assinatura, vencimento_em FROM avaliacao_empresas WHERE empresa_id=$1 FOR UPDATE', [companyId]);
    const company = result.rows[0];
    if (!company) throw new CommerceError(404, 'Empresa não encontrada.');
    if (!company.ativo || company.status_assinatura === 'suspended' || (company.vencimento_em && new Date(company.vencimento_em).getTime() <= Date.now())) {
      throw new CommerceError(403, 'Empresa indisponível para esta operação.');
    }
    const db = clone(company.dados);
    db.reviews ??= []; db.rewards ??= []; db.waiters ??= []; db.settings ??= {}; db.privacyRequests ??= [];
    const value = await mutate(db, client, company);
    await client.query('UPDATE avaliacao_empresas SET dados=$2::jsonb, nome=COALESCE(NULLIF($3,\'\'),nome), atualizado_em=NOW() WHERE empresa_id=$1',
      [companyId, JSON.stringify(db), String(db.settings?.name || '')]);
    await client.query('COMMIT');
    return { value, db };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
export async function consumePublicReviewRate(pool: any, companyId: string, ip: string, now = Date.now()) {
  // Atomic counters survive restarts and are shared across instances. No raw IP stored.
  for (const [windowMs, maximum] of [[600000, 60], [86400000, 500]]) {
    const slot = Math.floor(now / windowMs);
    const key = digest(`${companyId}:${ip}:${windowMs}:${slot}`);
    const result = await pool.query(`INSERT INTO avaliacao_public_rate_limits(bucket_key,count,expires_at)
      VALUES ($1,1,$2) ON CONFLICT(bucket_key) DO UPDATE SET count=avaliacao_public_rate_limits.count+1 RETURNING count`,
      [key, new Date((slot + 1) * windowMs).toISOString()]);
    if (result.rows[0].count > maximum) throw new CommerceError(429, 'Muitas tentativas. Aguarde alguns minutos para tentar novamente.', 'RATE_LIMITED');
  }
  await pool.query('DELETE FROM avaliacao_public_rate_limits WHERE expires_at < NOW()');
}
export async function createPublicReview(pool: any, companyId: string, body: any) {
  const { input, requestHash, payloadHash } = parseReviewInput(body);
  return withCompanyTransaction(pool, companyId, async (db, client, company) => {
    const prior = await client.query('SELECT payload_hash, review_id FROM avaliacao_review_requests WHERE empresa_id=$1 AND request_hash=$2', [companyId, requestHash]);
    if (prior.rows[0]) {
      if (prior.rows[0].payload_hash !== payloadHash) throw new CommerceError(409, 'Este envio já foi processado com outros dados.', 'IDEMPOTENCY_CONFLICT');
      const review = db.reviews.find((r: any) => r.id === prior.rows[0].review_id);
      if (!review || review.privacyAnonymizedAt) throw new CommerceError(409, 'Este envio já foi encerrado.', 'REVIEW_CLOSED');
      const reward = db.rewards.find((r: any) => r.id === review.rewardId) || { id: review.rewardId, title: review.rewardTitle, enabled: true, category: 'appetizer', iconName: 'Gift', description: '' };
      return { review, reward: { ...reward, title: review.rewardTitle }, replay: true };
    }
    if (body.id && db.reviews.some((r: any) => r.id === body.id)) throw new CommerceError(409, 'Avaliações existentes não podem ser alteradas pela página pública.');
    const now = new Date();
    const plan = String(company.plano || 'pro').toLowerCase();
    const monthlyLimit = MONTHLY_REVIEW_LIMIT[plan] ?? MONTHLY_REVIEW_LIMIT.pro;
    const usedThisMonth = db.reviews.filter((review: any) => {
      const createdAt = new Date(String(review?.createdAt || ''));
      return !Number.isNaN(createdAt.getTime()) && reviewMonth(createdAt) === reviewMonth(now);
    }).length;
    if (usedThisMonth >= monthlyLimit) {
      throw new CommerceError(403, `O limite de ${monthlyLimit} avaliações deste mês foi atingido. Faça upgrade do plano para continuar recebendo avaliações.`, 'MONTHLY_REVIEW_LIMIT');
    }
    const day = businessDay(now);
    // Also enforce the rule against evaluations created before this upgrade.
    if (db.reviews.some((r: any) => {
      try { return normalizeReviewPhone(r.customerPhoneNormalized || r.customerPhone) === input.customerPhone && businessDay(new Date(r.createdAt)) === day; }
      catch { return false; }
    })) throw new CommerceError(409, 'Este telefone já avaliou esta empresa hoje.', 'DAILY_LIMIT');
    const phoneHash = digest(`${companyId}:${input.customerPhone}`);
    const limit = await client.query(`INSERT INTO avaliacao_review_daily_limits(empresa_id,phone_hash,business_day)
      VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING phone_hash`, [companyId, phoneHash, day]);
    if (!limit.rows.length) throw new CommerceError(409, 'Este telefone já avaliou esta empresa hoje.', 'DAILY_LIMIT');
    const issued = issueReview(db, input, now);
    db.reviews.unshift(issued.review);
    await client.query('INSERT INTO avaliacao_review_requests(empresa_id,request_hash,payload_hash,review_id) VALUES ($1,$2,$3,$4)', [companyId, requestHash, payloadHash, issued.review.id]);
    await client.query('DELETE FROM avaliacao_review_daily_limits WHERE empresa_id=$1 AND business_day < $2', [companyId, day]);
    return { ...issued, replay: false };
  });
}
export async function redeemVoucher(pool: any, companyId: string, code: unknown, table: unknown, validator?: { id: string; name: string }) {
  return withCompanyTransaction(pool, companyId, db => claimReview(db, code, table, new Date(), validator));
}
