import crypto from 'node:crypto';

// Nomes e frases usados apenas para popular uma empresa de demonstração
// com dados fictícios, plausíveis, para uso comercial (mostrar o painel
// funcionando antes de o cliente ter avaliações reais).

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Hugo',
  'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nathan', 'Otávio',
  'Patrícia', 'Rafael', 'Sabrina', 'Thiago', 'Vanessa', 'Wellington', 'Yasmin',
  'Camila', 'Rodrigo', 'Fernanda', 'Marcelo', 'Larissa', 'Eduardo', 'Juliana', 'André',
];
const LAST_NAMES = [
  'Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Almeida',
  'Ferreira', 'Rodrigues', 'Gomes', 'Martins', 'Araújo', 'Melo', 'Barros', 'Lima',
];

const POSITIVE_CRITICISMS = [
  '', '', '', '', // maioria sem crítica
  'Demorou um pouco para o pedido chegar, mas valeu a pena.',
  'Achei o ambiente um pouco barulhento no horário de pico.',
  'Faltou opção vegetariana no cardápio.',
  'O estacionamento é pequeno para o movimento.',
];
const POSITIVE_SUGGESTIONS = [
  '', '', '',
  'Poderiam ter música ao vivo aos finais de semana.',
  'Seria bom ter mais opções de sobremesa.',
  'Adorei, só sugiro ampliar o espaço interno.',
  'Talvez um cardápio digital na mesa ajudasse.',
];
const QUICK_TAGS_DEFAULT = [
  'Atendimento rápido', 'Comida saborosa', 'Ambiente agradável', 'Preço justo',
  'Local limpo', 'Voltarei em breve', 'Indico para amigos', 'Ótimo custo-benefício',
];

function pick<T>(arr: T[]): T {
  return arr[crypto.randomInt(0, arr.length)];
}
function pickSome<T>(arr: T[], max: number): T[] {
  if (!arr.length) return [];
  const n = crypto.randomInt(0, Math.min(max, arr.length) + 1);
  const shuffled = [...arr].sort(() => crypto.randomInt(0, 2) - 0.5);
  return shuffled.slice(0, n);
}
function weightedRating(): number {
  // Distribuição realista: maioria 4-5, alguns 3, raros 1-2.
  const r = crypto.randomInt(0, 100);
  if (r < 55) return 5;
  if (r < 82) return 4;
  if (r < 94) return 3;
  if (r < 98) return 2;
  return 1;
}
function fakePhone(): string {
  const ddd = pick(['11', '21', '31', '41', '51', '61', '71', '81', '82', '85']);
  const rest = String(crypto.randomInt(100000000, 999999999)).padStart(9, '0');
  return `55${ddd}9${rest.slice(1)}`;
}

export interface DemoSeedOptions {
  days?: number;   // janela de dias para espalhar as avaliações (padrão 45)
  count?: number;  // quantidade de avaliações (padrão 120)
}

/**
 * Gera um array de Review fictícios, prontos para entrar em db.reviews.
 * Usa garçons/itens/brindes já cadastrados na empresa quando existirem,
 * para o resultado ficar coerente com o que o cliente configurou.
 */
export function buildDemoReviews(db: any, options: DemoSeedOptions = {}) {
  const days = Math.min(Math.max(Number(options.days) || 45, 7), 180);
  const count = Math.min(Math.max(Number(options.count) || 120, 10), 500);
  const settings = db.settings || {};
  const waiters = (db.waiters || []).filter((w: any) => w.active);
  const items = settings.consumptionItems || [];
  const enabledRewards = (db.rewards || []).filter((r: any) => r.enabled);
  const quickTags: string[] = (settings.quickTagsOptions && settings.quickTagsOptions.length ? settings.quickTagsOptions : QUICK_TAGS_DEFAULT);
  const totalTables = Number(settings.totalTables) || 24;
  const delayHours = Number(settings.rewardDelayHours ?? 24);
  const validityDays = Number(settings.rewardValidityDays ?? 15);

  if (!enabledRewards.length) {
    throw new Error('Cadastre pelo menos um brinde habilitado antes de gerar os dados de demonstração.');
  }

  const now = Date.now();
  const reviews: any[] = [];

  for (let i = 0; i < count; i += 1) {
    // Espalha no período, com mais peso nos dias mais recentes (parece uso real e contínuo).
    const dayOffset = Math.floor(Math.pow(crypto.randomInt(0, 10000) / 10000, 1.6) * days);
    const hour = pick([11, 12, 12, 13, 19, 19, 20, 20, 21]);
    const minute = crypto.randomInt(0, 60);
    const createdAt = new Date(now - dayOffset * 86400000);
    createdAt.setHours(hour, minute, crypto.randomInt(0, 60), 0);
    if (createdAt.getTime() > now) createdAt.setTime(now - crypto.randomInt(0, 3600000));

    const ratings = {
      service: weightedRating(),
      ambiance: weightedRating(),
      products: weightedRating(),
      waitTime: weightedRating(),
    };
    const overall = (ratings.service + ratings.ambiance + ratings.products + ratings.waitTime) / 4;
    const waiter = waiters.length ? pick(waiters) : null;
    const consumedItems = items.length ? pickSome(items, 3).map((it: any) => ({ id: it.id, name: it.name })) : [];
    const reward = pick(enabledRewards);
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const hasCriticism = overall < 4.3 && crypto.randomInt(0, 100) < 35;
    const hasSuggestion = crypto.randomInt(0, 100) < 20;

    let rewardCode: string;
    do { rewardCode = `BRINDE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`; }
    while (reviews.some((r) => r.rewardCode === rewardCode) || (db.reviews || []).some((r: any) => r.rewardCode === rewardCode));

    const availableFrom = new Date(createdAt.getTime() + delayHours * 3600000);
    const expiresAt = new Date(createdAt.getTime() + validityDays * 86400000);
    const claimed = expiresAt.getTime() < now && crypto.randomInt(0, 100) < 55;

    const review: any = {
      id: `rev-${crypto.randomUUID()}`,
      tableNumber: crypto.randomInt(1, totalTables + 1),
      customerName: name,
      customerPhone: fakePhone(),
      ratings,
      quickTags: pickSome(quickTags, 3),
      criticism: hasCriticism ? pick(POSITIVE_CRITICISMS.filter(Boolean)) : '',
      suggestion: hasSuggestion ? pick(POSITIVE_SUGGESTIONS.filter(Boolean)) : '',
      consumedItems,
      rewardId: reward.id,
      rewardTitle: reward.title,
      rewardCode,
      rewardClaimed: claimed,
      ...(claimed ? {
        claimedAt: new Date(availableFrom.getTime() + crypto.randomInt(3600000, Math.max(3600001, expiresAt.getTime() - availableFrom.getTime()))).toISOString(),
        claimedTable: crypto.randomInt(1, totalTables + 1),
        claimedByName: 'Demonstração',
      } : {}),
      availableFrom: availableFrom.toISOString(),
      expiresAt: expiresAt.toISOString(),
      privacyAcceptedAt: createdAt.toISOString(),
      privacyNoticeVersion: 'demo',
      marketingConsent: crypto.randomInt(0, 100) < 60,
      createdAt: createdAt.toISOString(),
      isDemoData: true,
    };
    if (waiter) {
      review.waiterId = waiter.id;
      review.waiterName = waiter.nickname ? `${waiter.name} (${waiter.nickname})` : waiter.name;
      review.waiterRating = weightedRating();
    }
    reviews.push(review);
  }

  reviews.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return reviews;
}

/** Remove somente as avaliações marcadas como fictícias (isDemoData), preservando avaliações reais. */
export function stripDemoReviews(db: any) {
  db.reviews = (db.reviews || []).filter((r: any) => !r.isDemoData);
  return db;
}
