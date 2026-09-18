import crypto from 'node:crypto';

export class CommerceError extends Error {
  constructor(public status: number, message: string, public code = 'INVALID_REQUEST') { super(message); }
}
export const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
export function normalizeReviewPhone(value: unknown): string {
  let phone = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (phone.startsWith('55') && phone.length >= 12) phone = phone.slice(2);
  if (phone.length === 10 && /^[6-9]/.test(phone.slice(2))) phone = `${phone.slice(0, 2)}9${phone.slice(2)}`;
  if (!/^[1-9]{2}\d{8,9}$/.test(phone)) throw new CommerceError(400, 'Informe um telefone brasileiro válido com DDD.');
  return phone;
}
export function businessDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function text(value: unknown, max: number): string {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new CommerceError(400, 'Campo de texto inválido ou muito longo.');
  return value.trim();
}
function tags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 30) throw new CommerceError(400, 'Lista de destaques inválida.');
  return [...new Set(value.map(v => text(v, 200)))].filter(Boolean);
}
function rating(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) throw new CommerceError(400, 'As notas devem ser números inteiros de 1 a 5.');
  return Number(value);
}
export function parseReviewInput(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommerceError(400, 'Avaliação inválida.');
  if (typeof body.requestToken !== 'string' || !/^[a-zA-Z0-9_-]{32,128}$/.test(body.requestToken)) {
    throw new CommerceError(400, 'Atualize a página para enviar sua avaliação com segurança.');
  }
  const table = body.tableNumber;
  if (table != null && (!Number.isInteger(table) || table < 1 || table > 10000)) throw new CommerceError(400, 'Mesa inválida.');
  const input = {
    customerName: text(body.customerName, 120),
    customerPhone: normalizeReviewPhone(body.customerPhone),
    tableNumber: table ?? null,
    ratings: Object.fromEntries(['service', 'ambiance', 'products', 'waitTime'].map(key => [key, rating(body.ratings?.[key])])),
    consumedItemIds: tags(body.consumedItemIds),
    quickTags: tags(body.quickTags), criticism: text(body.criticism, 2000), suggestion: text(body.suggestion, 2000),
    waiterId: text(body.waiterId, 128),
    waiterRating: body.waiterId ? rating(body.waiterRating) : null,
    waiterCompliments: tags(body.waiterCompliments),
    privacyAcknowledged: body.privacyAcknowledged === true,
    marketingConsent: body.marketingConsent === true,
  };
  // Client fields such as id, rewardCode, rewardClaimed and dates are never copied.
  return { input, requestHash: digest(body.requestToken), payloadHash: digest(JSON.stringify(input)) };
}
export function issueReview(db: any, input: ReturnType<typeof parseReviewInput>['input'], now = new Date()): { review: any; reward: any } {
  const settings = db.settings || {};
  if (settings.privacyNoticeRequired !== false && !input.privacyAcknowledged) throw new CommerceError(400, 'Confirme a leitura do Aviso de Privacidade.');
  if (settings.requireName && !input.customerName) throw new CommerceError(400, 'Informe seu nome.');
  if (input.tableNumber && input.tableNumber > Number(settings.totalTables || 24)) throw new CommerceError(400, 'Mesa não cadastrada.');
  const waiter = input.waiterId ? db.waiters.find((w: any) => w.id === input.waiterId && w.active) : null;
  if (input.waiterId && !waiter) throw new CommerceError(400, 'Atendente não disponível.');
  const consumedItems = input.consumedItemIds.map(id => {
    const item = (settings.consumptionItems || []).find((item: any) => item.id === id);
    if (!item) throw new CommerceError(400, 'Um item selecionado não está mais disponível. Atualize a página e selecione novamente.', 'ITEM_UNAVAILABLE');
    return { id: item.id, name: item.name };
  });
  const enabled = db.rewards.filter((r: any) => r.enabled === true);
  let reward: any;
  if (settings.activeRewardMode === 'fixed') {
    reward = enabled.find((r: any) => r.id === settings.fixedRewardId);
  } else {
    const weighted = enabled.map((r: any) => ({ reward: r, weight: Number(r.probabilityWeight ?? 10) }))
      .filter((r: any) => Number.isFinite(r.weight) && r.weight > 0 && r.weight <= 1000000);
    const total = weighted.reduce((sum: number, r: any) => sum + r.weight, 0);
    let target = crypto.randomInt(0, 2 ** 48 - 1) / (2 ** 48 - 1) * total;
    for (const candidate of weighted) { target -= candidate.weight; if (target < 0) { reward = candidate.reward; break; } }
  }
  if (!reward) throw new CommerceError(409, 'Nenhum brinde disponível. Avise o estabelecimento.', 'NO_REWARD');
  const delay = Number(settings.rewardDelayHours ?? 24);
  const validity = Number(settings.rewardValidityDays ?? 15);
  if (!Number.isFinite(delay) || delay < 0 || !Number.isFinite(validity) || validity <= 0 || validity > 3650 || delay >= validity * 24) {
    throw new CommerceError(409, 'O estabelecimento precisa corrigir os prazos do brinde.', 'INVALID_REWARD_DATES');
  }
  const stamp = now.toISOString();
  const consent = settings.marketingOptInEnabled !== false && input.marketingConsent;
  let rewardCode: string;
  do { rewardCode = `BRINDE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`; }
  while (db.reviews.some((r: any) => r.rewardCode === rewardCode));
  const review = {
    id: `rev-${crypto.randomUUID()}`, customerName: input.customerName,
    customerPhone: input.customerPhone, customerPhoneNormalized: input.customerPhone,
    ...(input.tableNumber ? { tableNumber: input.tableNumber } : {}),
    consumedItems,
    ratings: input.ratings, quickTags: input.quickTags, criticism: input.criticism, suggestion: input.suggestion,
    ...(waiter ? { waiterId: waiter.id, waiterName: waiter.nickname ? `${waiter.name} (${waiter.nickname})` : waiter.name,
      waiterRating: input.waiterRating, waiterCompliments: input.waiterCompliments, waiterCompliment: input.waiterCompliments.join(' • ') } : {}),
    rewardId: reward.id, rewardTitle: reward.title, rewardCode, rewardClaimed: false,
    availableFrom: new Date(now.getTime() + delay * 3600000).toISOString(),
    expiresAt: new Date(now.getTime() + validity * 86400000).toISOString(), createdAt: stamp,
    ...(input.privacyAcknowledged ? { privacyAcceptedAt: stamp, privacyNoticeVersion: '2026-09-v1' } : {}),
    marketingConsent: consent, ...(consent ? { marketingConsentAt: stamp } : {}), whatsappStatus: 'pending',
  };
  return { review, reward: clone(reward) };
}
export function claimReview(db: any, code: unknown, table: unknown, now = new Date(), validator?: { id: string; name: string }) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean || clean.length > 100) throw new CommerceError(400, 'Código do voucher inválido.');
  const review = db.reviews.find((r: any) => String(r.rewardCode || '').toUpperCase() === clean);
  if (!review) throw new CommerceError(404, 'Voucher não encontrado.', 'VOUCHER_NOT_FOUND');
  if (review.rewardClaimed) throw new CommerceError(409, 'Este voucher já foi resgatado.', 'VOUCHER_ALREADY_CLAIMED');
  const created = new Date(review.createdAt).getTime();
  const available = review.availableFrom ? new Date(review.availableFrom).getTime() : created + Number(db.settings.rewardDelayHours ?? 24) * 3600000;
  const expires = review.expiresAt ? new Date(review.expiresAt).getTime() : created + Number(db.settings.rewardValidityDays ?? 15) * 86400000;
  if (!Number.isFinite(available) || !Number.isFinite(expires) || expires <= available) throw new CommerceError(409, 'Voucher com prazo inválido.');
  if (now.getTime() < available) throw new CommerceError(409, 'Este voucher ainda não está liberado para uso.', 'VOUCHER_NOT_AVAILABLE');
  if (now.getTime() >= expires) throw new CommerceError(409, 'Este voucher está vencido.', 'VOUCHER_EXPIRED');
  if (table != null && (!Number.isInteger(table) || Number(table) < 1 || Number(table) > 10000)) throw new CommerceError(400, 'Mesa inválida.');
  review.rewardClaimed = true; review.claimedAt = now.toISOString();
  if (table != null) review.claimedTable = table;
  if (validator?.id) review.claimedByUserId = validator.id;
  if (validator?.name) review.claimedByName = validator.name;
  return review;
}

// Three-way patch: apply only fields changed by this request; never overwrite
// unrelated writes committed by another request/instance. Conflicting edits fail.
export function mergeDbChanges(base: any, changed: any, current: any): any {
  const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
  if (same(base, changed)) return clone(current);
  if (same(base, current) || same(changed, current)) return clone(changed);
  if (Array.isArray(base) && Array.isArray(changed) && Array.isArray(current) &&
      [...base, ...changed, ...current].every(v => v && typeof v.id === 'string')) {
    const before = new Map(base.map(v => [v.id, v]));
    const after = new Map(changed.map(v => [v.id, v]));
    const latest = new Map(current.map(v => [v.id, clone(v)]));
    for (const [id, old] of before) {
      if (!after.has(id)) {
        if (latest.has(id) && !same(old, latest.get(id))) throw new CommerceError(409, 'Dados alterados em outra sessão. Atualize e tente novamente.', 'WRITE_CONFLICT');
        latest.delete(id);
      } else if (!same(old, after.get(id))) {
        if (!latest.has(id)) throw new CommerceError(409, 'Registro removido em outra sessão.', 'WRITE_CONFLICT');
        latest.set(id, mergeDbChanges(old, after.get(id), latest.get(id)));
      }
    }
    for (const [id, row] of after) if (!before.has(id)) {
      if (latest.has(id) && !same(latest.get(id), row)) throw new CommerceError(409, 'Registro já existente.', 'WRITE_CONFLICT');
      latest.set(id, clone(row));
    }
    return [...latest.values()];
  }
  if (base && changed && current && !Array.isArray(base) && !Array.isArray(changed) && !Array.isArray(current) &&
      [base, changed, current].every(v => typeof v === 'object')) {
    const result = clone(current);
    for (const key of new Set([...Object.keys(base), ...Object.keys(changed)])) {
      if (same(base[key], changed[key])) continue;
      if (!(key in changed)) {
        if (!same(base[key], current[key]) && key in current) throw new CommerceError(409, 'Dados alterados em outra sessão.', 'WRITE_CONFLICT');
        delete result[key];
      } else if (!(key in base)) {
        if (key in current && !same(current[key], changed[key])) throw new CommerceError(409, 'Dados alterados em outra sessão.', 'WRITE_CONFLICT');
        result[key] = clone(changed[key]);
      } else result[key] = mergeDbChanges(base[key], changed[key], current[key]);
    }
    return result;
  }
  throw new CommerceError(409, 'Dados alterados em outra sessão. Atualize e tente novamente.', 'WRITE_CONFLICT');
}

export function tenantDispatches<T extends { companyId: string }>(rows: T[], companyId: string): T[] {
  return rows.filter(row => row.companyId === companyId).slice(0, 50);
}

export function updateConsumptionCatalog(db: any, operation: 'create' | 'update' | 'delete', id: string, name?: unknown) {
  const items: Array<{id: string; name: string}> = db.settings.consumptionItems || [];
  if (operation !== 'create' && !items.some(item => item.id === id)) throw new CommerceError(404, 'Item não encontrado.');
  if (operation === 'delete') {
    db.settings.consumptionItems = items.filter(item => item.id !== id);
  } else {
    const clean = text(name, 100);
    if (!clean) throw new CommerceError(400, 'Informe o nome do item.');
    if (items.some(item => item.id !== id && item.name.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR'))) throw new CommerceError(409, 'Já existe um item com esse nome.');
    if (operation === 'create' && items.length >= 500) throw new CommerceError(400, 'Limite de 500 itens atingido.');
    db.settings.consumptionItems = operation === 'create'
      ? [...items, { id: crypto.randomUUID(), name: clean }]
      : items.map(item => item.id === id ? { ...item, name: clean } : item);
  }
  return db.settings.consumptionItems;
}
