import express from 'express';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
async function initPostgres() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS avaliacao_dados (
        id INTEGER PRIMARY KEY,
        dados JSONB NOT NULL,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS avaliacao_empresas (
        empresa_id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        dados JSONB NOT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[PostgreSQL] Banco conectado; tabelas mono e multiempresa prontas.');
  } catch (error) {
    console.error('[PostgreSQL] Erro ao inicializar banco:', error);
  }
}

initPostgres();
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const firestoreDb = initializeFirestore(
  fbApp,
  { ignoreUndefinedProperties: true },
  firebaseConfig.firestoreDatabaseId
);

function sanitizeObj<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = sanitizeObj(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned as T;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'restaurant_db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'restaurant_db.backup.json');

const DEFAULT_SETTINGS = {
  name: 'Sr. Coxita',
  tagline: 'As melhores coxinhas e delícias artesanais',
  primaryColor: '#e11d48',
  secondaryColor: '#7f1d1d',
  ratingIcon: 'coxinha',
  logoUrl: '',
  evaluationTitle: 'Como foi sua experiência hoje?',
  evaluationDescription: 'Adoramos ter você aqui! Conte para nós o que achou da sua visita e receba um mimo especial em agradecimento.',
  quickTagsOptions: [
    'Coxinhas sequinhas e quentes',
    'Massa crocante e leve',
    'Recheio generoso e cremoso',
    'Molhos especiais da casa',
    'Garçom super atencioso',
    'Atendimento rápido e simpático',
    'Ambiente limpo e agradável',
    'Bebidas bem geladas',
    'Demora na entrega dos pedidos',
    'Demora para fechar a conta',
    'Salão um pouco movimentado',
  ],
  totalTables: 24,
  activeRewardMode: 'wheel',
  fixedRewardId: 'reward-1',
  requireName: false,
  rewardDelayHours: 24,
  rewardValidityDays: 15,
  autoSendWhatsApp: true,
  autoSendMode: 'silent_api',
  managerPin: '1234',
  whatsappApiUrl: '',
  whatsappApiToken: '',
  whatsappCustomMessage: '',
  voucherMessageTemplate: `*VOUCHER DE CORTESIA - {{empresa}}* 🥟✨

Olá {{cliente}}! Aqui estão os detalhes do seu brinde conquistado na avaliação:

🎁 *Brinde:* {{brinde}}
🎟️ *Código de Resgate:* {{codigo}}
📅 *Prazo de Início:* Liberado para resgate a partir de {{inicio}} (24h após o sorteio)
⏳ *Prazo para Expirar:* Válido até {{expira}} ({{validade_dias}} dias de validade)
⚠️ *Regra Importante:* Só é válido utilizar 1 cortesia/brinde por mesa!

Apresente este voucher durante sua próxima visita ao {{empresa}}. Esperamos você! 💛`,
  whatsappTemplateName: 'avaliacao_brinde',
  whatsappTemplateLanguage: 'pt_BR',
  whatsappWebhookVerifyToken: 'srcoxita_webhook_2026',
};

const DEFAULT_REWARDS = [
  {
    id: 'reward-1',
    title: 'PORÇÃO DE BATATA FRITA',
    description: 'Batata frita crocante por fora e macia por dentro, servida quentinha.',
    iconName: 'UtensilsCrossed',
    category: 'appetizer',
    enabled: true,
    probabilityWeight: 45,
  },
  {
    id: 'reward-2',
    title: 'CHURROS MIX TRADICIONAL',
    description: 'Mini churros crocantes recheados, polvilhados no açúcar com canela.',
    iconName: 'Cake',
    category: 'dessert',
    enabled: true,
    probabilityWeight: 45,
  },
  {
    id: 'reward-3',
    title: '10 % DE DESCONTO',
    description: '10% de desconto no valor total da sua comanda no Sr. Coxita.',
    iconName: 'Percent',
    category: 'discount',
    enabled: true,
    probabilityWeight: 5,
  },
  {
    id: 'reward-4',
    title: '5% DE DESCONTO',
    description: '5% de desconto no valor total da sua comanda no Sr. Coxita.',
    iconName: 'Percent',
    category: 'discount',
    enabled: true,
    probabilityWeight: 5,
  },
];

const DEFAULT_WAITERS = [
  {
    id: 'waiter-1',
    name: 'Carlos Oliveira',
    nickname: 'Carlinhos',
    badgeNumber: '01',
    role: 'Garçom',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'waiter-2',
    name: 'Mariana Santos',
    nickname: 'Mari',
    badgeNumber: '04',
    role: 'Garçonete',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'waiter-3',
    name: 'Lucas Pereira',
    nickname: 'Luquinhas',
    badgeNumber: '07',
    role: 'Garçom',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'waiter-4',
    name: 'Juliana Costa',
    nickname: 'Ju',
    badgeNumber: '11',
    role: 'Atendente',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'waiter-5',
    name: 'Marcos Souza',
    nickname: 'Marquinhos',
    badgeNumber: '15',
    role: 'Cumim',
    active: false,
    createdAt: new Date().toISOString(),
  },
];

interface RestaurantDb {
  settings: typeof DEFAULT_SETTINGS;
  rewards: any[];
  waiters: any[];
  reviews: any[];
}

function loadDb(): RestaurantDb {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        return {
          settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : DEFAULT_SETTINGS,
          rewards: Array.isArray(parsed.rewards) && parsed.rewards.length > 0 ? parsed.rewards : DEFAULT_REWARDS,
          waiters: Array.isArray(parsed.waiters) && parsed.waiters.length > 0 ? parsed.waiters : DEFAULT_WAITERS,
          reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
        };
      }
    }
  } catch (err) {
    console.error('Error reading DB_FILE, attempting backup file:', err);
  }

  try {
    if (fs.existsSync(DB_BACKUP_FILE)) {
      const raw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        return {
          settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : DEFAULT_SETTINGS,
          rewards: Array.isArray(parsed.rewards) && parsed.rewards.length > 0 ? parsed.rewards : DEFAULT_REWARDS,
          waiters: Array.isArray(parsed.waiters) && parsed.waiters.length > 0 ? parsed.waiters : DEFAULT_WAITERS,
          reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
        };
      }
    }
  } catch (err) {
    console.error('Error reading DB_BACKUP_FILE:', err);
  }

  return {
    settings: DEFAULT_SETTINGS,
    rewards: DEFAULT_REWARDS,
    waiters: DEFAULT_WAITERS,
    reviews: [],
  };
}
const postgresSaveQueues = new Map<string, Promise<void>>();
async function saveDbToPostgres(db: RestaurantDb): Promise<void> {
  const empresaId = currentCompanyId();
  // Snapshot now: later UI/API mutations cannot change what this save represents.
  const snapshot = JSON.stringify(db);
  const nome = db.settings?.name || empresaId;
  const previous = postgresSaveQueues.get(empresaId) || Promise.resolve();
  const queued = previous.catch(() => {}).then(async () => {
    await pool.query(
      `INSERT INTO avaliacao_empresas (empresa_id, nome, slug, dados, atualizado_em)
       VALUES ($1, $2, $1, $3::jsonb, NOW())
       ON CONFLICT (empresa_id) DO UPDATE SET dados=EXCLUDED.dados, nome=EXCLUDED.nome, atualizado_em=NOW()`,
      [empresaId, nome, snapshot]
    );
    console.log(`[PostgreSQL] Dados da empresa ${empresaId} salvos.`);
  }).catch((error) => {
    console.error('[PostgreSQL] Erro ao salvar dados multiempresa:', error);
  });
  postgresSaveQueues.set(empresaId, queued);
  await queued;
}
function saveDb(db: RestaurantDb): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const content = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_FILE, content, 'utf-8');
    try {
      fs.writeFileSync(DB_BACKUP_FILE, content, 'utf-8');
    } catch {}
    console.log(`[Database] Salvo com sucesso (${db.rewards.length} brindes, ${db.waiters.length} garçons, ${db.reviews.length} avaliações)`);
    void saveDbToPostgres(db);
  } catch (err) {
    console.error('Error writing DB_FILE:', err);
  }
}

// Multiempresa: cada requisição trabalha em um banco isolado pelo X-Company-Id.
const tenantContext = new AsyncLocalStorage<{ companyId: string }>();
const tenantDbs = new Map<string, RestaurantDb>();
const legacySeed = loadDb();
tenantDbs.set('demo', legacySeed);

function normalizeCompanyId(value: unknown): string {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean || 'demo';
}
function currentCompanyId(): string { return tenantContext.getStore()?.companyId || 'demo'; }
function freshDb(): RestaurantDb {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      name: 'Nova Empresa',
      tagline: 'Sua opinião é muito importante para nós',
      primaryColor: '#e11d48',
      ratingIcon: 'star',
      logoUrl: '',
      totalTables: 20,
      managerPin: '1234',
      autoSendWhatsApp: false,
      whatsappApiUrl: '',
      whatsappApiToken: '',
      whatsappCustomMessage: '',
      whatsappWebhookVerifyToken: '',
    },
    rewards: [
      { id:'reward-1', title:'BRINDE ESPECIAL', description:'Cortesia especial oferecida pelo estabelecimento.', iconName:'Gift', category:'appetizer', enabled:true, probabilityWeight:100 }
    ],
    waiters: [],
    reviews: []
  };
}
async function loadCompanyDb(companyId: string): Promise<RestaurantDb> {
  if (tenantDbs.has(companyId)) return tenantDbs.get(companyId)!;
  try {
    const result = await pool.query('SELECT dados FROM avaliacao_empresas WHERE empresa_id=$1 AND ativo=TRUE LIMIT 1', [companyId]);
    if (result.rows[0]?.dados) {
      const parsed = result.rows[0].dados;
      const db: RestaurantDb = { settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }, rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [], waiters: Array.isArray(parsed.waiters) ? parsed.waiters : [], reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [] };
      tenantDbs.set(companyId, db); return db;
    }
  } catch (e) { console.warn('[Multiempresa] Falha ao carregar empresa:', e); }
  const db = freshDb(); tenantDbs.set(companyId, db); return db;
}
const activeDb = new Proxy({} as RestaurantDb, {
  get(_target, prop) { return (tenantDbs.get(currentCompanyId()) || legacySeed as any)[prop as keyof RestaurantDb]; },
  set(_target, prop, value) { const id=currentCompanyId(); const db=tenantDbs.get(id) || freshDb(); (db as any)[prop]=value; tenantDbs.set(id, db); return true; }
});

async function loadDbFromPostgres(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT dados FROM avaliacao_empresas WHERE empresa_id=$1 LIMIT 1', ['demo']);
    if (!result.rows[0]?.dados) return false;
    const parsed=result.rows[0].dados;
    tenantDbs.set('demo', { settings:{...DEFAULT_SETTINGS,...(parsed.settings||{})}, rewards:Array.isArray(parsed.rewards)?parsed.rewards:DEFAULT_REWARDS, waiters:Array.isArray(parsed.waiters)?parsed.waiters:DEFAULT_WAITERS, reviews:Array.isArray(parsed.reviews)?parsed.reviews:[] });
    return true;
  } catch (e) { console.error('[PostgreSQL] Erro ao carregar demo:', e); return false; }
}
interface WhatsAppDispatch {
  id: string;
  phone: string;
  customerName: string;
  rewardTitle: string;
  rewardCode: string;
  restaurantName: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'failed';
  gateway: string;
  error?: string;
}

const recentDispatches: WhatsAppDispatch[] = [];

const processedWebhookIds = new Set<string>();
const MAX_WEBHOOK_CACHE = 500;

async function syncFirestoreToActiveDb(): Promise<void> {
  try {
    const snap = await getDocs(collection(firestoreDb, 'companies', currentCompanyId(), 'reviews'));
    if (snap && snap.size > 0) {
      const fsReviews: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data && data.id) {
          fsReviews.push(data);
        }
      });
      const reviewMap = new Map<string, any>();
      activeDb.reviews.forEach((r: any) => reviewMap.set(r.id, r));
      fsReviews.forEach((r: any) => reviewMap.set(r.id, r));
      activeDb.reviews = Array.from(reviewMap.values()).sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      saveDb(activeDb);
      console.log(`[Firestore Sync] ${fsReviews.length} avaliações sincronizadas do Firestore com sucesso!`);
    }
  } catch (err) {
    console.warn('[Firestore Sync] Aviso ao carregar avaliações do Firestore:', err);
  }
}

async function startServer() {
 // Inicializa e carrega o banco PostgreSQL antes de iniciar o sistema
await initPostgres();

const carregouPostgres = await loadDbFromPostgres();

if (!carregouPostgres) {
  console.log('[PostgreSQL] Primeiro uso: migrando os dados atuais para o PostgreSQL...');
  await saveDbToPostgres(activeDb);
}



  const app = express();
  app.use(async (req, _res, next) => {
    const companyId = normalizeCompanyId(req.header('X-Company-Id') || req.query.empresa || 'demo');
    await loadCompanyDb(companyId);
    tenantContext.run({ companyId }, next);
  });
  const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;

  app.use(express.json());

  // Administração geral multiempresa. Proteja com SUPER_ADMIN_KEY no Render.
  function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const configured = String(process.env.SUPER_ADMIN_KEY || '').trim();
    const supplied = String(req.header('X-Super-Admin-Key') || '').trim();
    if (!configured || supplied !== configured) return res.status(401).json({ error: 'Acesso de administrador geral negado.' });
    next();
  }
  app.get('/api/admin/companies', requireSuperAdmin, async (_req, res) => {
    const result = await pool.query('SELECT empresa_id, nome, slug, ativo, criado_em, atualizado_em FROM avaliacao_empresas ORDER BY criado_em DESC');
    res.json({ companies: result.rows });
  });
  app.post('/api/admin/companies', requireSuperAdmin, async (req, res) => {
    const empresaId = normalizeCompanyId(req.body?.slug || req.body?.empresaId || req.body?.name);
    const nome = String(req.body?.name || '').trim();
    if (!nome || empresaId === 'demo') return res.status(400).json({ error: 'Informe nome e slug válidos.' });
    const db = freshDb(); db.settings.name = nome;
    await pool.query(`INSERT INTO avaliacao_empresas (empresa_id,nome,slug,ativo,dados) VALUES ($1,$2,$1,TRUE,$3::jsonb)
      ON CONFLICT (empresa_id) DO NOTHING`, [empresaId, nome, JSON.stringify(db)]);
    tenantDbs.set(empresaId, db);
    res.status(201).json({ success:true, company:{ empresaId, nome, slug:empresaId }, evaluationUrl:`/?empresa=${empresaId}&cliente=1` });
  });
  app.patch('/api/admin/companies/:id/status', requireSuperAdmin, async (req, res) => {
    const id=normalizeCompanyId(req.params.id); const ativo=Boolean(req.body?.ativo);
    await pool.query('UPDATE avaliacao_empresas SET ativo=$2, atualizado_em=NOW() WHERE empresa_id=$1',[id,ativo]);
    res.json({success:true, empresaId:id, ativo});
  });

  // API Routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Full Central System Synchronization
  app.get('/api/sync', async (_req, res) => {
    
    res.json({
      settings: activeDb.settings,
      rewards: activeDb.rewards,
      waiters: activeDb.waiters,
      reviews: activeDb.reviews,
      serverTime: new Date().toISOString(),
    });
  });

  // Get Reviews
  app.get('/api/reviews', async (_req, res) => {
   
    res.json({
      reviews: activeDb.reviews,
      total: activeDb.reviews.length,
      serverTime: new Date().toISOString(),
    });
  });

  // Submit New Customer Review (From Table QR Code or Client View)
  app.post('/api/reviews', async (req, res) => {
    try {
      const review = req.body;
      if (!review || !review.id) {
        return res.status(400).json({ error: 'Dados da avaliação inválidos.' });
      }

      // Check if review already exists
      const existingIdx = activeDb.reviews.findIndex((r: any) => r.id === review.id);
      if (existingIdx >= 0) {
        activeDb.reviews[existingIdx] = { ...activeDb.reviews[existingIdx], ...review };
      } else {
        activeDb.reviews.unshift(review);
      }

      saveDb(activeDb);
      console.log(`[Central Sync] Nova avaliação sincronizada! Mesa #${review.tableNumber || 'Salão'} • Cliente: ${review.customerName || 'Anônimo'} • Código: ${review.rewardCode}`);

      // Persist to Firestore
      try {
        const cleaned = sanitizeObj(review);
        await setDoc(doc(firestoreDb, 'companies', currentCompanyId(), 'reviews', review.id), cleaned, { merge: true });
      } catch (fErr) {
        console.warn('[Firestore Sync] Aviso ao salvar review no Firestore:', fErr);
      }

      return res.json({
        success: true,
        review,
        reviews: activeDb.reviews,
      });
    } catch (err: any) {
      console.error('Error saving review in /api/reviews:', err);
      return res.status(500).json({ error: err?.message || 'Erro ao processar avaliação.' });
    }
  });

  // Validate / Claim Reward Voucher
  app.post('/api/reviews/validate', async (req, res) => {
    try {
      const { code, tableNumber } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Código do voucher é obrigatório.' });
      }

      const cleanCode = String(code).trim().toUpperCase();
      const review = activeDb.reviews.find(
        (r: any) => String(r.rewardCode || '').trim().toUpperCase() === cleanCode
      );

      if (!review) {
        return res.status(404).json({
          error: `Voucher "${cleanCode}" não foi localizado no sistema. Verifique o código digitado.`,
        });
      }

      if (review.rewardClaimed) {
        const dateStr = review.claimedAt ? new Date(review.claimedAt).toLocaleString('pt-BR') : '';
        return res.status(400).json({
          error: `Este brinde já foi resgatado anteriormente${dateStr ? ` em ${dateStr}` : ''}.`,
          review,
        });
      }

      review.rewardClaimed = true;
      review.claimedAt = new Date().toISOString();
      if (tableNumber) review.claimedTable = tableNumber;

      saveDb(activeDb);
      console.log(`[Central Sync] Voucher ${cleanCode} VALIDADO com sucesso para ${review.customerName || 'Cliente'}!`);

      // Persist to Firestore
      try {
        await setDoc(
          doc(firestoreDb, 'companies', currentCompanyId(), 'reviews', review.id),
          {
            rewardClaimed: true,
            claimedAt: review.claimedAt,
            claimedTable: review.claimedTable || null,
          },
          { merge: true }
        );
      } catch (fErr) {
        console.warn('[Firestore Sync] Aviso ao validar no Firestore:', fErr);
      }

      return res.json({
        success: true,
        review,
        reviews: activeDb.reviews,
      });
    } catch (err: any) {
      console.error('Error validating voucher:', err);
      return res.status(500).json({ error: err?.message || 'Erro ao validar voucher.' });
    }
  });

  // Delete Single Review
  app.delete('/api/reviews/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'ID da avaliação é obrigatório.' });
      }
      const beforeCount = activeDb.reviews.length;
      activeDb.reviews = activeDb.reviews.filter((r: any) => r.id !== id);
      saveDb(activeDb);
      console.log(`[Central Sync] Avaliação ${id} removida do servidor. Antes: ${beforeCount}, Agora: ${activeDb.reviews.length}`);

      // Delete from Firestore directly
      try {
        await deleteDoc(doc(firestoreDb, 'companies', currentCompanyId(), 'reviews', id));
        console.log(`[Firestore Sync] Avaliação ${id} excluída do Firestore.`);
      } catch (fErr) {
        console.warn(`[Firestore Sync] Aviso ao excluir review ${id} do Firestore:`, fErr);
      }

      return res.json({
        success: true,
        deletedId: id,
        remaining: activeDb.reviews.length,
        reviews: activeDb.reviews,
      });
    } catch (err: any) {
      console.error('Error deleting review:', err);
      return res.status(500).json({ error: err?.message || 'Erro ao excluir avaliação.' });
    }
  });

  // Clear All Reviews
  app.delete('/api/reviews', async (_req, res) => {
    try {
      activeDb.reviews = [];
      saveDb(activeDb);
      console.log('[Central Sync] Todas as avaliações foram limpas do servidor.');

      // Also delete from Firestore
      try {
        const snap = await getDocs(collection(firestoreDb, 'companies', currentCompanyId(), 'reviews'));
        const deletePromises: Promise<any>[] = [];
        snap.forEach((d) => {
          deletePromises.push(deleteDoc(d.ref));
        });
        await Promise.all(deletePromises);
        console.log(`[Firestore Sync] Todas as ${deletePromises.length} avaliações foram limpas do Firestore.`);
      } catch (fErr) {
        console.warn('[Firestore Sync] Aviso ao limpar avaliações do Firestore:', fErr);
      }

      return res.json({ success: true, reviews: [] });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao limpar avaliações.' });
    }
  });

  // Update Settings
  app.post('/api/settings', (req, res) => {
    try {
      activeDb.settings = { ...activeDb.settings, ...req.body };
      saveDb(activeDb);
      return res.json({ success: true, settings: activeDb.settings });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar configurações.' });
    }
  });

  // Dedicated PIN Update Endpoint
  app.post('/api/settings/pin', (req, res) => {
    try {
      const { pin } = req.body || {};
      if (!pin || typeof pin !== 'string' || pin.trim().length < 3) {
        return res.status(400).json({ error: 'PIN inválido. Mínimo de 3 caracteres.' });
      }
      const trimmedPin = pin.trim();
      activeDb.settings.managerPin = trimmedPin;
      saveDb(activeDb);
      console.log(`[Database] Senha de acesso do restaurante atualizada e salva permanentemente: ${trimmedPin}`);
      return res.json({ success: true, managerPin: trimmedPin });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao atualizar senha no servidor.' });
    }
  });

  // Dedicated WhatsApp API Settings Update Endpoint
  app.post('/api/settings/whatsapp', (req, res) => {
    try {
      const { whatsappApiUrl, whatsappApiToken, whatsappCustomMessage, autoSendWhatsApp, autoSendMode } = req.body || {};
      if (whatsappApiUrl !== undefined) {
        const cleanUrl = String(whatsappApiUrl || '').trim();
        if (cleanUrl && !cleanUrl.includes('SEU_PHONE_NUMBER_ID')) {
          activeDb.settings.whatsappApiUrl = cleanUrl;
        } else if (!activeDb.settings.whatsappApiUrl) {
          activeDb.settings.whatsappApiUrl = '';
        }
      }
      if (whatsappApiToken !== undefined) {
        const cleanToken = String(whatsappApiToken || '').trim();
        if (cleanToken) {
          activeDb.settings.whatsappApiToken = cleanToken;
        } else if (!activeDb.settings.whatsappApiToken) {
          activeDb.settings.whatsappApiToken = '';
        }
      }
      if (whatsappCustomMessage !== undefined) {
        activeDb.settings.whatsappCustomMessage = String(whatsappCustomMessage || '').trim();
      }
      if (req.body.whatsappTemplateName !== undefined) {
        activeDb.settings.whatsappTemplateName = String(req.body.whatsappTemplateName || '').trim();
      }
      if (req.body.whatsappTemplateLanguage !== undefined) {
        activeDb.settings.whatsappTemplateLanguage = String(req.body.whatsappTemplateLanguage || '').trim();
      }
      if (autoSendWhatsApp !== undefined) {
        activeDb.settings.autoSendWhatsApp = Boolean(autoSendWhatsApp);
      }
      if (autoSendMode !== undefined) {
        activeDb.settings.autoSendMode = autoSendMode;
      }
      saveDb(activeDb);
      console.log(`[Database] Configurações de WhatsApp salvas no banco com sucesso (URL: ${activeDb.settings.whatsappApiUrl || 'nenhuma'})`);
      return res.json({ success: true, settings: activeDb.settings });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar credenciais de WhatsApp no servidor.' });
    }
  });

  // Update Rewards
  app.post('/api/rewards', (req, res) => {
    try {
      if (Array.isArray(req.body)) {
        activeDb.rewards = req.body;
        saveDb(activeDb);
      }
      return res.json({ success: true, rewards: activeDb.rewards });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar brindes.' });
    }
  });

  // Update Waiters
  app.post('/api/waiters', (req, res) => {
    try {
      if (Array.isArray(req.body)) {
        activeDb.waiters = req.body;
        saveDb(activeDb);
      }
      return res.json({ success: true, waiters: activeDb.waiters });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar garçons.' });
    }
  });

  // Full Database Sync Push (Saves rewards, waiters, settings, reviews atomically)
  app.post('/api/sync/push', (req, res) => {
    try {
      const { settings, rewards, waiters, reviews } = req.body || {};
      let changed = false;

      if (settings && typeof settings === 'object') {
        const safeSettings = { ...settings };
        if (
          !safeSettings.whatsappApiUrl ||
          safeSettings.whatsappApiUrl.includes('SEU_PHONE_NUMBER_ID')
        ) {
          safeSettings.whatsappApiUrl =
            activeDb.settings.whatsappApiUrl ||
            'https://graph.facebook.com/v20.0/1295064457026684/messages';
        }
        if (!safeSettings.whatsappApiToken && activeDb.settings.whatsappApiToken) {
          safeSettings.whatsappApiToken = activeDb.settings.whatsappApiToken;
        }
        activeDb.settings = { ...activeDb.settings, ...safeSettings };
        changed = true;
      }
      if (Array.isArray(rewards)) {
        activeDb.rewards = rewards;
        changed = true;
      }
      if (Array.isArray(waiters)) {
        activeDb.waiters = waiters;
        changed = true;
      }
      if (Array.isArray(reviews)) {
        activeDb.reviews = [...reviews].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        changed = true;
      }

      if (changed) {
        saveDb(activeDb);
      }

      return res.json({
        success: true,
        message: 'Banco de dados sincronizado e salvo no servidor com sucesso.',
        counts: {
          rewards: activeDb.rewards.length,
          waiters: activeDb.waiters.length,
          reviews: activeDb.reviews.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao persistir banco de dados.' });
    }
  });

  // Export full database JSON file
  app.get('/api/database/export', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="banco_restaurante_backup.json"');
    return res.send(JSON.stringify(activeDb, null, 2));
  });

  // Import full database JSON file
  app.post('/api/database/import', (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Arquivo de dados inválido.' });
      }
      if (data.settings && typeof data.settings === 'object') {
        activeDb.settings = { ...activeDb.settings, ...data.settings };
      }
      if (Array.isArray(data.rewards)) activeDb.rewards = data.rewards;
      if (Array.isArray(data.waiters)) activeDb.waiters = data.waiters;
      if (Array.isArray(data.reviews)) activeDb.reviews = data.reviews;
      saveDb(activeDb);
      return res.json({ success: true, db: activeDb });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao importar dados.' });
    }
  });

  // Helper to completely purge any test phrases or disclaimer watermarks
  function cleanWhatsAppMessage(text: string): string {
    if (!text) return '';
    return text
      .replace(/mensagem\s+de\s+teste/gi, '')
      .replace(/favor\s+desconsiderar/gi, '')
      .replace(/desconsiderar/gi, '')
      .replace(/\[\s*teste\s*\]/gi, '')
      .replace(/\(\s*teste\s*\)/gi, '')
      .replace(/esta\s+mensagem\s+foi\s+enviada\s+por\s+uma\s+conta\s+em\s+trial/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Helper to build official customer voucher message using the company's editable template.
  function buildOfficialVoucherMessage({
    customerName,
    rewardTitle,
    rewardCode,
    restaurantName = 'Sr. Coxita',
    availableFrom,
    expiresAt,
  }: {
    customerName?: string;
    rewardTitle?: string;
    rewardCode?: string;
    restaurantName?: string;
    availableFrom?: string;
    expiresAt?: string;
  }) {
    const firstName = customerName ? customerName.trim().split(' ')[0] : 'Cliente';
    const availDate = availableFrom ? new Date(availableFrom).toLocaleDateString('pt-BR') : 'amanhã';
    const expDate = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : 'em 15 dias';
    const validityDays = activeDb.settings.rewardValidityDays || 15;
    const fallbackTemplate = `*VOUCHER DE CORTESIA - {{empresa}}* 🥟✨

Olá {{cliente}}! Aqui estão os detalhes do seu brinde conquistado na avaliação:

🎁 *Brinde:* {{brinde}}
🎟️ *Código de Resgate:* {{codigo}}
📅 *Prazo de Início:* Liberado para resgate a partir de {{inicio}} (24h após o sorteio)
⏳ *Prazo para Expirar:* Válido até {{expira}} ({{validade_dias}} dias de validade)
⚠️ *Regra Importante:* Só é válido utilizar 1 cortesia/brinde por mesa!

Apresente este voucher durante sua próxima visita ao {{empresa}}. Esperamos você! 💛`;
    const template = String(activeDb.settings.voucherMessageTemplate || fallbackTemplate);

    return template
      .replace(/{{\s*cliente\s*}}/gi, firstName)
      .replace(/{{\s*empresa\s*}}/gi, restaurantName.toUpperCase())
      .replace(/{{\s*brinde\s*}}/gi, rewardTitle || 'Cortesia especial')
      .replace(/{{\s*codigo\s*}}/gi, rewardCode || '')
      .replace(/{{\s*inicio\s*}}/gi, availDate)
      .replace(/{{\s*expira\s*}}/gi, expDate)
      .replace(/{{\s*validade_dias\s*}}/gi, String(validityDays));
  }

  // Build official expiring 5 days reminder
  function buildExpiring5DaysMessage({
    customerName,
    rewardTitle,
    rewardCode,
    restaurantName = 'Sr. Coxita',
    expiresAt,
    daysLeft = 5,
  }: {
    customerName?: string;
    rewardTitle?: string;
    rewardCode?: string;
    restaurantName?: string;
    expiresAt?: string;
    daysLeft?: number;
  }) {
    const firstName = customerName ? customerName.trim().split(' ')[0] : 'Cliente';
    const formattedExpDate = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : 'em 5 dias';
    const daysStr = daysLeft === 5 ? '5 DIAS' : `${daysLeft} dias`;

    return (
      `*LEMBRETE DE CORTESIA - ${restaurantName.toUpperCase()}* 🥟⏳\n\n` +
      `Olá ${firstName}! Tudo bem? Passando para te avisar com carinho que o seu brinde exclusivo da roleta (*${rewardTitle || 'Cortesia especial'}*, código: *${rewardCode || ''}*) VAI EXPIRAR EM ${daysStr}!\n\n` +
      `📅 *Prazo Limite:* Válido até ${formattedExpDate} (restam ${daysLeft} dias).\n` +
      `🎟️ *Código de Resgate:* ${rewardCode || ''}\n` +
      `⚠️ *Regra:* Válido 1 cortesia por mesa.\n\n` +
      `Não deixe sua cortesia vencer! Venha nos visitar esta semana e saboreie seu presente no ${restaurantName}. Esperamos você com muito carinho! 💛`
    );
  }

  // Build official expiring 1 day (urgency) reminder
  function buildExpiring1DayMessage({
    customerName,
    rewardTitle,
    rewardCode,
    restaurantName = 'Sr. Coxita',
    expiresAt,
  }: {
    customerName?: string;
    rewardTitle?: string;
    rewardCode?: string;
    restaurantName?: string;
    expiresAt?: string;
  }) {
    const firstName = customerName ? customerName.trim().split(' ')[0] : 'Cliente';
    const formattedExpDate = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : 'amanhã';

    return (
      `🚨 *ÚLTIMA CHANCE: SEU BRINDE EXPIRA AMANHÃ!* 🥟🔥\n\n` +
      `Olá ${firstName}! Aqui é do ${restaurantName}.\n\n` +
      `⚠️ O prazo de 15 dias para resgate do seu brinde exclusivo (*${rewardTitle || 'Cortesia especial'}*, código: *${rewardCode || ''}*) VENCE AMANHÃ (${formattedExpDate})!\n\n` +
      `⏰ Amanhã é o ÚLTIMO DIA para resgatar seu presente antes que o código seja cancelado automaticamente pelo sistema.\n` +
      `🎟️ *Código de Resgate:* ${rewardCode || ''}\n` +
      `⚠️ *Regra:* Válido 1 cortesia por mesa.\n\n` +
      `Apresente este código ao garçom amanhã no restaurante e garanta sua cortesia especial. Te esperamos! 💛`
    );
  }

  // Helper to normalize Brazilian phone numbers to E.164 without leading zeros
  function normalizePhoneForWhatsApp(phone: string): string {
    let digits = String(phone || '').replace(/\D/g, '');
    // Strip leading zeros (e.g. 082 99999-9999 -> 82 99999-9999)
    digits = digits.replace(/^0+/, '');

    // Strip international 55 if provided, to normalize the base number
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2).replace(/^0+/, '');
    }

    // If 10 digits (DDD + 8 digits), e.g. 82 87769844 or 82 93259566
    // Mobile numbers in Brazil start with 6, 7, 8, 9 after DDD
    if (digits.length === 10) {
      const ddd = digits.slice(0, 2);
      const num = digits.slice(2);
      if (/^[6-9]/.test(num)) {
        digits = `${ddd}9${num}`;
      }
    }

    return `55${digits}`;
  }

  function buildBrindeTemplateComponents(customerName: string): any[] {
    const firstName = customerName ? customerName.trim().split(' ')[0] : 'Cliente';
    return [{ type: 'body', parameters: [{ type: 'text', text: firstName }] }];
  }

  async function sendTemplateMessage(
    apiUrl: string, apiToken: string, phoneWithDDI: string,
    templateName: string, templateLanguage: string,
    components?: any[]
  ): Promise<{ ok: boolean; error?: string; metaCode?: number }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
      headers['apikey'] = apiToken;
      headers['Client-Token'] = apiToken;
    }
    const templateData: Record<string, any> = { name: templateName, language: { code: templateLanguage } };
    if (components && components.length > 0) templateData.components = components;
    const payload = {
      messaging_product: 'whatsapp', recipient_type: 'individual',
      to: phoneWithDDI, type: 'template', template: templateData,
    };
    const externalRes = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (externalRes.ok) return { ok: true };
    const errBody = await externalRes.text().catch(() => '');
    let parsedError = '';
    let metaCode: number | undefined;
    try {
      const errObj = JSON.parse(errBody);
      metaCode = errObj?.error?.code;
      const metaMsg = errObj?.error?.message;
      const metaDetails = errObj?.error?.error_data?.details;
      if (metaCode === 131030) parsedError = `Template: número +${phoneWithDDI} não está na lista de destinatários de teste.`;
      else if (metaCode === 190) parsedError = `Template: Token de acesso expirou.`;
      else parsedError = metaDetails || metaMsg || errBody;
    } catch { parsedError = errBody; }
    return { ok: false, error: parsedError || `Gateway retornou HTTP ${externalRes.status}`, metaCode };
  }

  async function sendFreeTextMessage(
    apiUrl: string, apiToken: string, phoneWithDDI: string, message: string
  ): Promise<{ ok: boolean; error?: string; metaCode?: number }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
      headers['apikey'] = apiToken;
      headers['Client-Token'] = apiToken;
    }
    const payload = {
      messaging_product: 'whatsapp', recipient_type: 'individual',
      to: phoneWithDDI, type: 'text', text: { preview_url: false, body: message },
    };
    const externalRes = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (externalRes.ok) return { ok: true };
    const errBody = await externalRes.text().catch(() => '');
    let parsedError = '';
    let metaCode: number | undefined;
    try {
      const errObj = JSON.parse(errBody);
      metaCode = errObj?.error?.code;
      const metaMsg = errObj?.error?.message;
      const metaDetails = errObj?.error?.error_data?.details;
      if (metaCode === 131030) parsedError = `Número +${phoneWithDDI} não está na lista de destinatários de teste.`;
      else if (metaCode === 131047) parsedError = `Janela de 24 horas fechada.`;
      else if (metaCode === 190) parsedError = `Token de acesso expirou.`;
      else parsedError = metaDetails || metaMsg || errBody;
    } catch { parsedError = errBody; }
    return { ok: false, error: parsedError || `Gateway retornou HTTP ${externalRes.status}`, metaCode };
  }

  // Core WhatsApp transmission engine
  async function executeWhatsAppSend({
    phone,
    message: rawMessage,
    customerName,
    rewardTitle,
    rewardCode,
    restaurantName = activeDb.settings.name || 'Sr. Coxita',
    apiUrl,
    apiToken,
    templateMode,
  }: {
    phone: string;
    message: string;
    customerName?: string;
    rewardTitle?: string;
    rewardCode?: string;
    restaurantName?: string;
    apiUrl?: string;
    apiToken?: string;
    templateMode?: string;
  }): Promise<{
    success: boolean;
    hasRealGateway: boolean;
    status: 'sent' | 'delivered' | 'failed';
    dispatch: WhatsAppDispatch;
    error?: string;
    message: string;
  }> {
    const phoneWithDDI = normalizePhoneForWhatsApp(phone);
    const message = cleanWhatsAppMessage(rawMessage);
    const templateName = activeDb.settings.whatsappTemplateName || 'avaliacao_brinde';
    const templateLanguage = activeDb.settings.whatsappTemplateLanguage || 'pt_BR';

    const effectiveApiUrl = apiUrl || activeDb.settings.whatsappApiUrl || process.env.WHATSAPP_API_URL;
    const effectiveApiToken = apiToken || activeDb.settings.whatsappApiToken || process.env.WHATSAPP_API_TOKEN;
    const hasRealGateway = Boolean(effectiveApiUrl && effectiveApiUrl.trim().length > 5);

    let deliveryStatus: 'sent' | 'delivered' | 'failed' = hasRealGateway ? 'sent' : 'failed';
    let gatewayUsed = effectiveApiUrl || 'Nenhum Gateway Conectado (Requer URL de API)';
    let errorMessage: string | undefined;
    let usedTemplateFallback = false;

    if (hasRealGateway) {
      try {
        gatewayUsed = effectiveApiUrl;
        if (!effectiveApiUrl.includes('graph.facebook.com')) {
          throw new Error('Apenas a Meta Cloud API (graph.facebook.com) é suportada. Verifique a URL configurada.');
        }
        const pathSegments = effectiveApiUrl.split('/');
        const messagesIdx = pathSegments.indexOf('messages');
        const idSegment = messagesIdx > 0 ? pathSegments[messagesIdx - 1] : '';
        if (idSegment && (idSegment.startsWith('55') || idSegment.length < 14) && /^\d+$/.test(idSegment)) {
          throw new Error(
            `Você colocou o número de telefone (+${idSegment}) na URL da Meta. A Meta exige a 'Identificação do número de telefone' (código numérico de 15 a 16 dígitos).`
          );
        }

        if (templateMode === 'brinde_template') {
          const components = buildBrindeTemplateComponents(customerName || '');
          const tplResult = await sendTemplateMessage(effectiveApiUrl, effectiveApiToken, phoneWithDDI, templateName, templateLanguage, components);
          if (tplResult.ok) {
            deliveryStatus = 'delivered';
            usedTemplateFallback = true;
          } else {
            deliveryStatus = 'failed';
            errorMessage = `Template "${templateName}" falhou: ${tplResult.error}`;
            if (tplResult.metaCode) errorMessage += ` (Meta code: ${tplResult.metaCode})`;
          }
        } else {
          const textResult = await sendFreeTextMessage(effectiveApiUrl, effectiveApiToken, phoneWithDDI, message);
          if (textResult.ok) {
            deliveryStatus = 'delivered';
          } else {
            if (textResult.metaCode === 131047 && templateName) {
              const components = buildBrindeTemplateComponents(customerName || '');
              const tplResult = await sendTemplateMessage(effectiveApiUrl, effectiveApiToken, phoneWithDDI, templateName, templateLanguage, components);
              if (tplResult.ok) {
                deliveryStatus = 'delivered';
                usedTemplateFallback = true;
                errorMessage = `Texto livre bloqueado (janela 24h). Template "${templateName}" enviado como alternativa.`;
              } else {
                deliveryStatus = 'failed';
                errorMessage = `Texto livre bloqueado (janela 24h). Template também falhou: ${tplResult.error}`;
              }
            } else {
              deliveryStatus = 'failed';
              errorMessage = textResult.error;
              if (textResult.metaCode) errorMessage += ` (Meta code: ${textResult.metaCode})`;
            }
          }
        }
      } catch (err: any) {
        console.error('[WhatsApp API] Gateway forward error:', err);
        errorMessage = err?.message || 'Erro de conexão com o Gateway de WhatsApp';
        deliveryStatus = 'failed';
      }
    } else {
      errorMessage = 'Nenhum Gateway de WhatsApp configurado no sistema. A mensagem precisa de uma API para ser disparada para a rede celular da Meta.';
    }

    const record: WhatsAppDispatch = {
      id: `disp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      phone: phoneWithDDI,
      customerName: customerName || 'Cliente',
      rewardTitle: rewardTitle || 'Cortesia',
      rewardCode: rewardCode || '',
      restaurantName: restaurantName || 'Sr. Coxita',
      timestamp: new Date().toISOString(),
      status: deliveryStatus,
      gateway: gatewayUsed,
      error: errorMessage,
    };

    recentDispatches.unshift(record);
    if (recentDispatches.length > 50) recentDispatches.pop();

    return {
      success: deliveryStatus === 'delivered',
      hasRealGateway,
      status: deliveryStatus,
      dispatch: record,
      error: errorMessage,
      message: hasRealGateway && deliveryStatus === 'delivered'
        ? usedTemplateFallback
          ? `Template "${templateName}" enviado para +${phoneWithDDI}. Aguardando resposta SIM do cliente.`
          : `Voucher oficial enviado com sucesso para o WhatsApp +${phoneWithDDI}!`
        : hasRealGateway
        ? `Falha ao transmitir pelo Gateway: ${errorMessage}`
        : `Lembrete registrado no sistema. Para envio automático sem ação humana, conecte a URL da sua API de WhatsApp no Painel.`,
    };
  }

  // Automatic Checker for 5 Days and 1 Day Expiring Notifications
  async function checkAndSendExpiringNotifications(
    autoSend = true,
    targetReviewId?: string,
    forceType?: '5_days' | '1_day'
  ) {
    const validityDays = activeDb.settings.rewardValidityDays || 15;
    const validityMs = validityDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let sent5DaysCount = 0;
    let sent1DayCount = 0;
    let hasChanges = false;

    for (const rev of activeDb.reviews) {
      if (targetReviewId && rev.id !== targetReviewId) continue;
      if (rev.rewardClaimed) continue;
      if (!rev.customerPhone || rev.customerPhone.trim().length < 8) continue;

      const expiryTime = rev.expiresAt
        ? new Date(rev.expiresAt).getTime()
        : new Date(rev.createdAt).getTime() + validityMs;

      const diffMs = expiryTime - now;
      if (diffMs <= 0) continue; // Already expired

      const daysLeft = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

      // Case 1: 1 Day left (Expira amanhã)
      if ((daysLeft <= 1 || forceType === '1_day') && (forceType === '1_day' || !rev.notified1DayAt)) {
        if (!forceType && daysLeft > 1) continue;
        const msg = buildExpiring1DayMessage({
          customerName: rev.customerName,
          rewardTitle: rev.rewardTitle,
          rewardCode: rev.rewardCode,
          restaurantName: activeDb.settings.name,
          expiresAt: rev.expiresAt,
        });

        if (autoSend) {
          await executeWhatsAppSend({
            phone: rev.customerPhone,
            message: msg,
            customerName: rev.customerName,
            rewardTitle: rev.rewardTitle,
            rewardCode: rev.rewardCode,
            restaurantName: activeDb.settings.name,
          });
        }

        rev.notified1DayAt = new Date().toISOString();
        hasChanges = true;
        sent1DayCount++;

        try {
          await setDoc(doc(firestoreDb, 'companies', currentCompanyId(), 'reviews', rev.id), { notified1DayAt: rev.notified1DayAt }, { merge: true });
        } catch {}
      }
      // Case 2: 5 Days left (Faltando 5 dias ou entre 2 e 5 dias)
      else if ((daysLeft <= 5 || forceType === '5_days') && (forceType === '5_days' || !rev.notified5DaysAt)) {
        if (!forceType && daysLeft <= 1) continue; // Handle 1-day urgency instead
        const msg = buildExpiring5DaysMessage({
          customerName: rev.customerName,
          rewardTitle: rev.rewardTitle,
          rewardCode: rev.rewardCode,
          restaurantName: activeDb.settings.name,
          expiresAt: rev.expiresAt,
          daysLeft,
        });

        if (autoSend) {
          await executeWhatsAppSend({
            phone: rev.customerPhone,
            message: msg,
            customerName: rev.customerName,
            rewardTitle: rev.rewardTitle,
            rewardCode: rev.rewardCode,
            restaurantName: activeDb.settings.name,
          });
        }

        rev.notified5DaysAt = new Date().toISOString();
        hasChanges = true;
        sent5DaysCount++;

        try {
          await setDoc(doc(firestoreDb, 'companies', currentCompanyId(), 'reviews', rev.id), { notified5DaysAt: rev.notified5DaysAt }, { merge: true });
        } catch {}
      }
    }

    if (hasChanges) {
      saveDb(activeDb);
    }

    return { sent5DaysCount, sent1DayCount };
  }

  // Background WhatsApp Send API (Sends without opening WhatsApp on customer's device)
  app.post('/api/send-whatsapp', async (req, res) => {
    try {
      const {
        phone,
        customerName,
        rewardTitle,
        rewardCode,
        message: incomingMessage,
        restaurantName = 'Sr. Coxita',
        availableFrom,
        expiresAt,
        apiUrl,
        apiToken,
        templateMode,
      } = req.body;

      if (!phone) {
        return res.status(400).json({ error: 'Número de telefone é obrigatório.' });
      }

      // Build official voucher message if not provided
      const rawMessage = incomingMessage || buildOfficialVoucherMessage({
        customerName,
        rewardTitle,
        rewardCode,
        restaurantName,
        availableFrom,
        expiresAt,
      });

      const sendResult = await executeWhatsAppSend({
        phone,
        message: rawMessage,
        customerName,
        rewardTitle,
        rewardCode,
        restaurantName,
        apiUrl,
        apiToken,
        templateMode: templateMode || 'brinde_template',
      });

      if (!sendResult.success) {
        return res.status(400).json(sendResult);
      }

      return res.json(sendResult);
    } catch (err: any) {
      console.error('Server error in /api/send-whatsapp:', err);
      return res.status(500).json({
        error: err?.message || 'Falha interna ao processar envio para WhatsApp.',
      });
    }
  });

  // Trigger expiring notifications endpoint
  app.post('/api/notifications/expiring', async (req, res) => {
    try {
      const { reviewId, type } = req.body;
      const { sent5DaysCount, sent1DayCount } = await checkAndSendExpiringNotifications(
        true,
        reviewId,
        type
      );
      return res.json({
        success: true,
        sent5DaysCount,
        sent1DayCount,
        message: `Disparados com sucesso: ${sent5DaysCount} lembrete(s) de 5 dias e ${sent1DayCount} alerta(s) urgente(s) de 1 dia!`,
        reviews: activeDb.reviews,
      });
    } catch (err: any) {
      console.error('[Expiring Notifications] Error:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Falha ao processar notificações de vencimento.',
      });
    }
  });

  // Test WhatsApp Gateway endpoint - Sends official voucher preview
  app.post('/api/test-whatsapp', async (req, res) => {
    try {
      const { phone, apiUrl, apiToken, message } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Informe um número de WhatsApp (com DDD).' });
      }
      const effectiveApiUrl = (apiUrl || activeDb.settings.whatsappApiUrl || process.env.WHATSAPP_API_URL || '').trim();
      const effectiveApiToken = (apiToken || activeDb.settings.whatsappApiToken || process.env.WHATSAPP_API_TOKEN || '').trim();

      if (!effectiveApiUrl || effectiveApiUrl.length < 5) {
        return res.status(400).json({
          error: 'URL da Meta Cloud API não foi informada. Preencha a URL da sua API (graph.facebook.com/.../messages) no Painel.',
        });
      }

      const phoneWithDDI = normalizePhoneForWhatsApp(phone);

      // Official message without test wording
      const rawMsg = message || buildOfficialVoucherMessage({
        customerName: 'Cliente VIP',
        rewardTitle: 'PORÇÃO DE BATATA FRITA',
        rewardCode: 'BRINDE-OFICIAL',
        restaurantName: 'Sr. Coxita',
        availableFrom: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const testMsg = cleanWhatsAppMessage(rawMsg);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (effectiveApiToken) {
        headers['Authorization'] = `Bearer ${effectiveApiToken}`;
        headers['apikey'] = effectiveApiToken;
        headers['Client-Token'] = effectiveApiToken;
      }

      let payload: Record<string, any>;
      const { template, templateLanguage } = req.body;

      if (effectiveApiUrl.includes('graph.facebook.com')) {
        // Check if user accidentally used raw phone number instead of Phone Number ID
        const pathSegments = effectiveApiUrl.split('/');
        const messagesIdx = pathSegments.indexOf('messages');
        const idSegment = messagesIdx > 0 ? pathSegments[messagesIdx - 1] : '';
        if (idSegment && (idSegment.startsWith('55') || idSegment.length < 14) && /^\d+$/.test(idSegment)) {
          return res.status(400).json({
            success: false,
            error: `Você colocou o número de telefone (+${idSegment}) diretamente na URL da Meta. A Meta exige a 'Identificação do número de telefone' (um código numérico interno de 15 a 16 dígitos). No portal developers.facebook.com > WhatsApp > Configuração da API, selecione seu número (+55 82 98776-9844) no menu "De" e copie o código numérico que aparece abaixo dele.`,
          });
        }

        if (template) {
          payload = {
            messaging_product: 'whatsapp',
            to: phoneWithDDI,
            type: 'template',
            template: {
              name: template,
              language: { code: templateLanguage || 'en_US' },
            },
          };
        } else {
          payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phoneWithDDI,
            type: 'text',
            text: { preview_url: false, body: testMsg },
          };
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'Apenas a Meta Cloud API (graph.facebook.com) é suportada. Verifique a URL configurada.',
        });
      }

      const externalRes = await fetch(effectiveApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const resText = await externalRes.text().catch(() => '');
      let resJson;
      try {
        resJson = JSON.parse(resText);
      } catch {
        resJson = resText;
      }

      if (externalRes.ok) {
        return res.json({
          success: true,
          status: externalRes.status,
          data: resJson,
          message: template
            ? `Template '${template}' da Meta enviado com sucesso para +${phoneWithDDI}!`
            : `Mensagem enviada com sucesso para +${phoneWithDDI}!`,
        });
      } else {
        let cleanError = '';
        if (typeof resJson === 'object' && resJson?.error) {
          const metaCode = resJson.error.code;
          const metaMsg = resJson.error.message;
          const metaDetails = resJson.error.error_data?.details;
          if (metaCode === 131030) {
            cleanError = `Meta Cloud API (Erro 131030): O telefone +${phoneWithDDI} não está na lista de números de teste permitidos no Meta Developers. Acesse developers.facebook.com > WhatsApp > Configuração da API > "Para" e adicione este telefone.`;
          } else if (metaCode === 131047) {
            cleanError = `Meta Cloud API (Erro 131047): A janela de 24 horas da Meta está fechada para este número. A Meta só entrega mensagens de texto livre se o cliente conversou com o WhatsApp da empresa (+55 82 8776-9844) nas últimas 24h, ou se for enviado um Modelo de Mensagem (Template) aprovado pela Meta.`;
          } else if (metaCode === 190) {
            cleanError = `Meta Cloud API (Erro 190): O token de acesso expirou. Gere um novo token no portal Meta for Developers.`;
          } else {
            cleanError = metaDetails || metaMsg || JSON.stringify(resJson);
          }
        } else {
          cleanError = typeof resJson === 'string' ? resJson.slice(0, 300) : JSON.stringify(resJson).slice(0, 300);
        }

        return res.status(400).json({
          success: false,
          status: externalRes.status,
          data: resJson,
          error: `O Gateway de WhatsApp retornou erro HTTP ${externalRes.status}. Detalhes: ${cleanError}`,
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: `Não foi possível conectar ao endereço da API: ${err?.message}`,
      });
    }
  });

  // Recent Dispatches log for manager dashboard
  app.get('/api/whatsapp-dispatches', (_req, res) => {
    res.json({
      configuredGateway: Boolean(process.env.WHATSAPP_API_URL),
      dispatches: recentDispatches,
    });
  });

  // WhatsApp Cloud API webhook verification (GET)
  app.get('/api/whatsapp-webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = activeDb.settings.whatsappWebhookVerifyToken || 'srcoxita_webhook_2026';
    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  // WhatsApp Cloud API message receiver (POST)
  app.post('/api/whatsapp-webhook', async (req, res) => {
    res.sendStatus(200);

    try {
      const body = req.body;
      if (!body || !body.entry) return;

      for (const entry of body.entry) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value || !value.messages) continue;

          for (const msg of value.messages) {
            const msgId = msg?.id;
            if (!msgId) continue;

            if (processedWebhookIds.has(msgId)) continue;
            processedWebhookIds.add(msgId);
            if (processedWebhookIds.size > MAX_WEBHOOK_CACHE) {
              const firstId = processedWebhookIds.values().next().value;
              if (firstId) processedWebhookIds.delete(firstId);
            }

            if (msg.type !== 'text') continue;
            const textBody = (msg.text?.body || '').trim();
            const fromPhone = msg.from;
            if (!textBody || !fromPhone) continue;

            const isSim = /^\s*sim\s*$/i.test(textBody);
            if (!isSim) continue;

            const normalizedPhone = normalizePhoneForWhatsApp(fromPhone);

            const review = activeDb.reviews.find(
              (r: any) => normalizePhoneForWhatsApp(r.customerPhone || '') === normalizedPhone
                && !r.rewardSentViaWhatsapp
            );
            if (!review) continue;

            const rewardMsg = buildOfficialVoucherMessage({
              customerName: review.customerName,
              rewardTitle: review.rewardTitle,
              rewardCode: review.rewardCode,
              restaurantName: activeDb.settings.name,
              availableFrom: review.availableFrom,
              expiresAt: review.expiresAt,
            });

            const effectiveApiUrl = activeDb.settings.whatsappApiUrl || process.env.WHATSAPP_API_URL;
            const effectiveApiToken = activeDb.settings.whatsappApiToken || process.env.WHATSAPP_API_TOKEN;
            if (!effectiveApiUrl || !effectiveApiUrl.includes('graph.facebook.com')) continue;

            const sendResult = await sendFreeTextMessage(effectiveApiUrl, effectiveApiToken, normalizedPhone, rewardMsg);
            if (sendResult.ok) {
              review.rewardSentViaWhatsapp = true;
              review.whatsappStatus = 'delivered';
              review.whatsappSentAt = new Date().toISOString();
              saveDb(activeDb);
              try {
                await setDoc(doc(firestoreDb, 'companies', currentCompanyId(), 'reviews', review.id), {
                  rewardSentViaWhatsapp: true,
                  whatsappStatus: 'delivered',
                  whatsappSentAt: review.whatsappSentAt,
                }, { merge: true });
              } catch {}

              const record: WhatsAppDispatch = {
                id: `disp_webhook_${Date.now()}`,
                phone: normalizedPhone,
                customerName: review.customerName || 'Cliente',
                rewardTitle: review.rewardTitle || 'Cortesia',
                rewardCode: review.rewardCode || '',
                restaurantName: activeDb.settings.name,
                timestamp: new Date().toISOString(),
                status: 'delivered',
                gateway: effectiveApiUrl,
              };
              recentDispatches.unshift(record);
              if (recentDispatches.length > 50) recentDispatches.pop();
              console.log(`[Webhook] Brinde enviado para +${normalizedPhone} após SIM de ${review.customerName || 'cliente'}`);
            } else {
              console.warn(`[Webhook] Falha ao enviar brinde após SIM: ${sendResult.error}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Webhook] Erro ao processar mensagem:', err);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    // In dev mode, Vite runs separately (started by `vite` in package.json dev script).
    // This Express server acts as the API backend on port 3001, and Vite proxies /api to it.
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Automated background interval to check and notify expiring vouchers (5 days and 1 day)
  setTimeout(() => {
    checkAndSendExpiringNotifications(true).catch((e) => console.warn('[Auto Expiration Check] Notice:', e));
  }, 10000);

  setInterval(() => {
    checkAndSendExpiringNotifications(true).catch((e) => console.warn('[Auto Expiration Check] Notice:', e));
  }, 30 * 60 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
