import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReviewInput, issueReview, claimReview, normalizeReviewPhone, businessDay, mergeDbChanges, clone, tenantDispatches } from '../commerce-security';

const body = () => ({ requestToken: 'a'.repeat(40), customerName: 'Ana', customerPhone: '(82) 98776-9844',
  ratings: { service: 5, ambiance: 4, products: 5, waitTime: 3 }, quickTags: [], privacyAcknowledged: true });
const db = () => ({ settings: { rewardDelayHours: 24, rewardValidityDays: 15, activeRewardMode: 'wheel' },
  rewards: [{ id: 'valid', title: 'Brinde real', enabled: true, probabilityWeight: 1 }, { id: 'zero', title: 'Nunca', enabled: true, probabilityWeight: 0 }, { id: 'disabled', title: 'Desativado', enabled: false, probabilityWeight: 100000 }], reviews: [] as any[], waiters: [] });
const now = new Date('2026-09-16T12:00:00Z');

test('prêmio, código, IDs, datas e estado enviados pelo cliente não são aceitos', () => {
  const parsed = parseReviewInput({ ...body(), id: 'forged', rewardTitle: 'Prêmio caro', rewardCode: 'FORGED', rewardClaimed: true, createdAt: '2000-01-01', availableFrom: '2000-01-01', expiresAt: '2099-01-01', marketingConsentAt: '2000-01-01' });
  const { review, reward } = issueReview(db(), parsed.input, now);
  assert.equal(reward.id, 'valid'); assert.equal(review.rewardTitle, 'Brinde real');
  assert.notEqual(review.id, 'forged'); assert.match(review.rewardCode, /^BRINDE-[A-F0-9]{16}$/);
  assert.equal(review.rewardClaimed, false); assert.equal(review.createdAt, now.toISOString());
  assert.equal(review.availableFrom, '2026-09-17T12:00:00.000Z'); assert.equal(review.expiresAt, '2026-10-01T12:00:00.000Z');
  assert.equal(review.marketingConsent, false); assert.equal(review.marketingConsentAt, undefined);
});
test('notas, telefone e token inválidos são recusados', () => {
  for (const patch of [{ requestToken: 'short' }, { customerPhone: '123' }, { ratings: { service: 6, ambiance: 1, products: 1, waitTime: 1 } }, { ratings: { service: '5', ambiance: 1, products: 1, waitTime: 1 } }]) {
    assert.throws(() => parseReviewInput({ ...body(), ...patch }));
  }
  assert.equal(normalizeReviewPhone('+55 82 98776-9844'), normalizeReviewPhone('82987769844'));
});
test('horário brasileiro define corretamente o dia do limite', () => {
  assert.equal(businessDay(new Date('2026-09-16T02:59:00Z')), '2026-09-15');
  assert.equal(businessDay(new Date('2026-09-16T03:00:00Z')), '2026-09-16');
});
test('não emite prêmio desativado, de peso zero ou configuração fixa inválida', () => {
  const data = db();
  for (let i = 0; i < 50; i++) assert.equal(issueReview(data, parseReviewInput(body()).input, now).reward.id, 'valid');
  data.rewards[0].enabled = false;
  assert.throws(() => issueReview(data, parseReviewInput(body()).input, now));
  data.settings.activeRewardMode = 'fixed';
  assert.throws(() => issueReview(data, parseReviewInput(body()).input, now));
});
test('prêmio fixo é escolhido pelo cadastro do servidor', () => {
  const data: any = db(); data.settings.activeRewardMode = 'fixed'; data.settings.fixedRewardId = 'valid';
  assert.equal(issueReview(data, parseReviewInput(body()).input, now).reward.id, 'valid');
});
test('exige aviso, nome e atendente válido conforme cadastro', () => {
  const data: any = db(); const input = parseReviewInput(body()).input;
  assert.throws(() => issueReview(data, { ...input, privacyAcknowledged: false }, now));
  data.settings.requireName = true;
  assert.throws(() => issueReview(data, { ...input, customerName: '' }, now));
  assert.throws(() => issueReview(data, { ...input, waiterId: 'inventado' }, now));
});
test('recusa resgate antecipado, vencido, repetido e prazo inválido', () => {
  const data: any = db(); const { review } = issueReview(data, parseReviewInput(body()).input, now); data.reviews.push(review);
  assert.throws(() => claimReview(data, review.rewardCode, undefined, now), { code: 'VOUCHER_NOT_AVAILABLE' });
  assert.throws(() => claimReview(data, review.rewardCode, undefined, new Date(review.expiresAt)), { code: 'VOUCHER_EXPIRED' });
  claimReview(data, review.rewardCode, 1, new Date(review.availableFrom));
  assert.equal(review.rewardClaimed, true);
  assert.throws(() => claimReview(data, review.rewardCode, 1, new Date(review.availableFrom)), { code: 'VOUCHER_ALREADY_CLAIMED' });
  review.rewardClaimed = false; review.availableFrom = 'invalid';
  assert.throws(() => claimReview(data, review.rewardCode, 1, now));
});
test('voucher legado usa datas derivadas do cadastro sem liberar antecipadamente', () => {
  const data: any = db(); data.reviews = [{ id: 'old', rewardCode: 'OLD', createdAt: now.toISOString(), rewardClaimed: false }];
  assert.throws(() => claimReview(data, 'OLD', undefined, now), { code: 'VOUCHER_NOT_AVAILABLE' });
  claimReview(data, 'OLD', undefined, new Date(now.getTime() + 86400000));
});
test('alteração de configurações não sobrescreve avaliação/resgate concorrente', () => {
  const before: any = db(); before.reviews = [{ id: 'one', rewardClaimed: false, customerName: 'Ana' }];
  const changed = clone(before); changed.settings.name = 'Novo nome';
  const current = clone(before); current.reviews[0].rewardClaimed = true; current.reviews.push({ id: 'two', rewardClaimed: false });
  const merged = mergeDbChanges(before, changed, current);
  assert.equal(merged.reviews.length, 2); assert.equal(merged.reviews[0].rewardClaimed, true); assert.equal(merged.settings.name, 'Novo nome');
});
test('atualizações de campos distintos são mescladas; conflito no mesmo campo é recusado', () => {
  const base = { reviews: [{ id: '1', rewardClaimed: false, whatsappStatus: 'pending' }] };
  const changed = clone(base); changed.reviews[0].whatsappStatus = 'sent';
  const current = clone(base); current.reviews[0].rewardClaimed = true;
  const merged = mergeDbChanges(base, changed, current);
  assert.equal(merged.reviews[0].rewardClaimed, true); assert.equal(merged.reviews[0].whatsappStatus, 'sent');
  current.reviews[0].whatsappStatus = 'failed'; assert.throws(() => mergeDbChanges(base, changed, current), { code: 'WRITE_CONFLICT' });
});
test('consulta de histórico só devolve envios da empresa autorizada', () => {
  const rows = [{ companyId: 'a', phone: '111' }, { companyId: 'b', phone: '222' }, { companyId: 'a', phone: '333' }];
  assert.deepEqual(tenantDispatches(rows, 'a').map(r => r.phone), ['111', '333']);
  assert.deepEqual(tenantDispatches(rows, 'c'), []);
});

test('itens consumidos usam nomes do cadastro e preservam o histórico após edição/exclusão', async () => {
  const { updateConsumptionCatalog } = await import('../commerce-security');
  const data: any = db();
  const items = updateConsumptionCatalog(data, 'create', '', 'Coxinha de frango');
  const id = items[0].id;
  const parsed = parseReviewInput({ ...body(), consumedItemIds: [id, id], consumedItems: [{ id, name: 'Nome inventado' }] });
  const issued = issueReview(data, parsed.input, now);
  assert.deepEqual(issued.review.consumedItems, [{ id, name: 'Coxinha de frango' }]);
  data.reviews.push(issued.review);
  updateConsumptionCatalog(data, 'update', id, 'Coxinha cremosa');
  assert.equal(data.settings.consumptionItems[0].name, 'Coxinha cremosa');
  updateConsumptionCatalog(data, 'delete', id);
  assert.equal(data.settings.consumptionItems.length, 0);
  assert.equal(data.reviews[0].consumedItems[0].name, 'Coxinha de frango');
  assert.throws(() => issueReview(data, parsed.input, now), { code: 'ITEM_UNAVAILABLE' });
});
test('catálogo recusa nomes vazios, duplicados e edição de item inexistente', async () => {
  const { updateConsumptionCatalog } = await import('../commerce-security');
  const data: any = db();
  updateConsumptionCatalog(data, 'create', '', 'Pizza');
  assert.throws(() => updateConsumptionCatalog(data, 'create', '', ' pizza '));
  assert.throws(() => updateConsumptionCatalog(data, 'create', '', '   '));
  assert.throws(() => updateConsumptionCatalog(data, 'update', 'inexistente', 'Suco'));
});
test('avaliações sem itens continuam funcionando e IDs desconhecidos são recusados', () => {
  assert.deepEqual(issueReview(db(), parseReviewInput(body()).input, now).review.consumedItems, []);
  const forged = parseReviewInput({ ...body(), consumedItemIds: ['outra-empresa'] });
  assert.throws(() => issueReview(db(), forged.input, now), { code: 'ITEM_UNAVAILABLE' });
});
