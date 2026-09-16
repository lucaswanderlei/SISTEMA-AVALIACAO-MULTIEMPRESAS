import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { initCommerceSchema, createPublicReview, redeemVoucher, consumePublicReviewRate, withCompanyTransaction } from '../commerce-store';

// Embedded PostgreSQL executes the real SQL. Its single connection is queued;
// production uses pg connections and PostgreSQL FOR UPDATE row locks.
const pg = new PGlite();
let queue = Promise.resolve();
let failWrite = false, loseCommitResponse = false;
const pool = {
  async connect() {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    return {
      async query(sql: string, args?: any[]) {
        if (failWrite && sql.startsWith('UPDATE avaliacao_empresas SET dados')) { failWrite = false; throw new Error('simulated write failure'); }
        const result = await pg.query(sql, args);
        if (loseCommitResponse && sql === 'COMMIT') { loseCommitResponse = false; throw new Error('simulated lost commit response'); }
        return result;
      }, release,
    };
  },
  async query(sql: string, args?: any[]) { const c = await this.connect(); try { return await c.query(sql, args); } finally { c.release(); } },
};
const input = (phone = '82987769844') => ({ requestToken: crypto.randomUUID(), customerName: 'Cliente', customerPhone: phone,
  ratings: { service: 5, ambiance: 5, products: 4, waitTime: 4 }, quickTags: [], privacyAcknowledged: true });
const fixture = () => ({ settings: { name: 'Empresa', activeRewardMode: 'fixed', fixedRewardId: 'gift', rewardDelayHours: 0, rewardValidityDays: 15 },
  rewards: [{ id: 'gift', title: 'Brinde cadastrado', enabled: true, probabilityWeight: 1 }], waiters: [], reviews: [], privacyRequests: [] });
const read = async (company = 'a') => (await pool.query('SELECT dados FROM avaliacao_empresas WHERE empresa_id=$1', [company])).rows[0] as any;
before(async () => {
  await pool.query(`CREATE TABLE avaliacao_empresas (empresa_id TEXT PRIMARY KEY, nome TEXT, dados JSONB NOT NULL,
    ativo BOOLEAN DEFAULT TRUE, status_assinatura TEXT DEFAULT 'active', vencimento_em TIMESTAMPTZ, atualizado_em TIMESTAMPTZ DEFAULT NOW())`);
  await initCommerceSchema(pool);
});
beforeEach(async () => {
  failWrite = false; loseCommitResponse = false;
  await pool.query('TRUNCATE avaliacao_empresas, avaliacao_public_rate_limits CASCADE');
  for (const id of ['a', 'b']) await pool.query('INSERT INTO avaliacao_empresas(empresa_id,nome,dados) VALUES($1,$2,$3::jsonb)', [id, id, JSON.stringify(fixture())]);
});
after(async () => pg.close());

test('emissão persiste e reenvio do mesmo token recupera o mesmo voucher', async () => {
  const body = input(); const first = await createPublicReview(pool, 'a', body); const retry = await createPublicReview(pool, 'a', body);
  assert.equal(retry.value.review.rewardCode, first.value.review.rewardCode); assert.equal(retry.value.replay, true);
  assert.equal((await read()).dados.reviews.length, 1);
  await assert.rejects(createPublicReview(pool, 'a', { ...body, customerName: 'Outra pessoa' }), { code: 'IDEMPOTENCY_CONFLICT' });
});
test('requisições simultâneas com o mesmo token não geram vários brindes', async () => {
  const body = input(); const results = await Promise.all(Array.from({ length: 8 }, () => createPublicReview(pool, 'a', body)));
  assert.equal(new Set(results.map(r => r.value.review.rewardCode)).size, 1);
  assert.equal(results.filter(r => !r.value.replay).length, 1);
});
test('mesmo telefone com tokens diferentes é limitado por dia e empresa', async () => {
  const results = await Promise.allSettled([createPublicReview(pool, 'a', input()), createPublicReview(pool, 'a', input())]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const denied: any = results.find(r => r.status === 'rejected'); assert.equal(denied.reason.code, 'DAILY_LIMIT');
  await createPublicReview(pool, 'b', input()); assert.equal((await read('b')).dados.reviews.length, 1);
});
test('número com DDI não contorna limite e exclusão da avaliação não libera outro prêmio no dia', async () => {
  await createPublicReview(pool, 'a', input());
  await withCompanyTransaction(pool, 'a', db => { db.reviews = []; });
  await assert.rejects(createPublicReview(pool, 'a', input('+55 82 98776-9844')), { code: 'DAILY_LIMIT' });
});
test('rota pública não altera avaliação por ID conhecido nem revela outra empresa', async () => {
  const first = await createPublicReview(pool, 'a', input());
  await assert.rejects(createPublicReview(pool, 'a', { ...input('82999998888'), id: first.value.review.id, rewardClaimed: true }));
  assert.equal((await read()).dados.reviews[0].rewardClaimed, false);
  await assert.rejects(redeemVoucher(pool, 'b', first.value.review.rewardCode, 1), { code: 'VOUCHER_NOT_FOUND' });
});
test('resgates simultâneos confirmam apenas uma utilização', async () => {
  const first = await createPublicReview(pool, 'a', input());
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => redeemVoucher(pool, 'a', first.value.review.rewardCode, 1)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await read()).dados.reviews[0].rewardClaimed, true);
});
test('falha de gravação desfaz avaliação, token e limite; nova tentativa funciona', async () => {
  const body = input(); failWrite = true;
  await assert.rejects(createPublicReview(pool, 'a', body), /simulated write failure/);
  assert.equal((await read()).dados.reviews.length, 0);
  assert.equal((await pool.query('SELECT * FROM avaliacao_review_requests')).rows.length, 0);
  const retry = await createPublicReview(pool, 'a', body); assert.equal(retry.value.replay, false);
});
test('resposta perdida após COMMIT permite recuperar sem repetir emissão', async () => {
  const body = input(); loseCommitResponse = true;
  await assert.rejects(createPublicReview(pool, 'a', body), /lost commit response/);
  const retry = await createPublicReview(pool, 'a', body); assert.equal(retry.value.replay, true);
  assert.equal((await read()).dados.reviews.length, 1);
});
test('falha no resgate não confirma nem marca voucher como usado', async () => {
  const first = await createPublicReview(pool, 'a', input()); failWrite = true;
  await assert.rejects(redeemVoucher(pool, 'a', first.value.review.rewardCode, 1));
  assert.equal((await read()).dados.reviews[0].rewardClaimed, false);
  await redeemVoucher(pool, 'a', first.value.review.rewardCode, 1);
});
test('limite por IP é persistente, por empresa e não aceita excesso de tentativas', async () => {
  const now = Date.now();
  for (let i = 0; i < 60; i++) await consumePublicReviewRate(pool, 'a', '192.0.2.1', now);
  await assert.rejects(consumePublicReviewRate(pool, 'a', '192.0.2.1', now), { code: 'RATE_LIMITED' });
  await consumePublicReviewRate(pool, 'b', '192.0.2.1', now);
  await consumePublicReviewRate(pool, 'a', '192.0.2.2', now);
});
test('empresa suspensa não recebe avaliações mesmo após a checagem inicial', async () => {
  await pool.query("UPDATE avaliacao_empresas SET status_assinatura='suspended' WHERE empresa_id='a'");
  await assert.rejects(createPublicReview(pool, 'a', input()));
  assert.equal((await read()).dados.reviews.length, 0);
});

test('catálogo persiste por empresa e consumo mantém nome histórico no PostgreSQL', async () => {
  const { updateConsumptionCatalog } = await import('../commerce-security');
  const catalog = await withCompanyTransaction(pool, 'a', db => updateConsumptionCatalog(db, 'create', '', 'Hambúrguer'));
  const id = catalog.value[0].id;
  assert.equal((await read()).dados.settings.consumptionItems[0].name, 'Hambúrguer');
  assert.equal((await read('b')).dados.settings.consumptionItems, undefined);
  await assert.rejects(createPublicReview(pool, 'b', { ...input(), consumedItemIds: [id] }), { code: 'ITEM_UNAVAILABLE' });
  await createPublicReview(pool, 'a', { ...input(), consumedItemIds: [id] });
  await withCompanyTransaction(pool, 'a', db => updateConsumptionCatalog(db, 'update', id, 'Smash burger'));
  await withCompanyTransaction(pool, 'a', db => updateConsumptionCatalog(db, 'delete', id));
  const saved = (await read()).dados;
  assert.equal(saved.settings.consumptionItems.length, 0);
  assert.equal(saved.reviews[0].consumedItems[0].name, 'Hambúrguer');
});
