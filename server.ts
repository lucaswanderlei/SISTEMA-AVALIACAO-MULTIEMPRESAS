import { initAiSchema, registerAiRoutes } from './ai-reports';
import { CommerceError, clone, mergeDbChanges, tenantDispatches, updateConsumptionCatalog } from './commerce-security';
import { initCommerceSchema, withCompanyTransaction, createPublicReview, redeemVoucher, consumePublicReviewRate } from './commerce-store';
import express from 'express';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, stored] = String(storedHash || '').split(':');
    if (!salt || !stored) return false;
    const derived = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(stored, 'hex');
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function safeEqualText(a: string, b: string): boolean {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function superAdminCredentialsMatch(login: unknown, password: unknown): boolean {
  const configuredLogin = String(process.env.SUPER_ADMIN_LOGIN || 'superadmin').trim();
  const configuredPassword = String(process.env.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_KEY || '').trim();
  if (!configuredPassword) return false;
  return safeEqualText(String(login || '').trim(), configuredLogin) && safeEqualText(String(password || ''), configuredPassword);
}

type CompanyAccessLevel = 'owner' | 'manager' | 'viewer';
type AuthSession = { role: 'superadmin' | 'manager'; companyId?: string; userId?: string; userName?: string; accessLevel?: CompanyAccessLevel; expiresAt: number };
const authSessions = new Map<string, AuthSession>();
const AUTH_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
type RateBucket = { count: number; resetAt: number };
const authRateBuckets = new Map<string, RateBucket>();

function rateLimitKey(req: express.Request, scope: string, login?: unknown): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${scope}:${ip}:${String(login || '').trim().toLowerCase()}`;
}

function consumeRateLimit(key: string, maxAttempts: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = authRateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    authRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= maxAttempts) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  authRateBuckets.set(key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

function clearRateLimit(key: string) {
  authRateBuckets.delete(key);
}

function createAuthSession(session: Omit<AuthSession, 'expiresAt'>): string {
  const token = crypto.randomBytes(32).toString('hex');
  authSessions.set(token, { ...session, expiresAt: Date.now() + AUTH_SESSION_TTL_MS });
  return token;
}

function getAuthSession(req: express.Request): AuthSession | null {
  const header = String(req.header('Authorization') || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const session = authSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    authSessions.delete(token);
    return null;
  }
  return session;
}

function invalidateUserSessions(userId: string) {
  for (const [token, session] of authSessions.entries()) {
    if (session.userId === userId) authSessions.delete(token);
  }
}

function invalidateCompanySessions(companyId: string) {
  for (const [token, session] of authSessions.entries()) {
    if (session.companyId === companyId && session.role !== 'superadmin') authSessions.delete(token);
  }
}

function normalizeAccessLevel(value: unknown): CompanyAccessLevel {
  const level = String(value || '').trim().toLowerCase();
  if (level === 'viewer') return 'viewer';
  if (level === 'manager') return 'manager';
  return 'owner';
}

function isValidEmail(value: unknown): boolean {
  const email = String(value || '').trim();
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function passwordResetTokenHash(token: string): string {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function sendPasswordResetEmail(to: string, resetUrl: string, companyName: string, userName: string): Promise<void> {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.PASSWORD_RESET_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '').trim();
  if (!apiKey || !from) {
    const err: any = new Error('Recuperação por e-mail ainda não está configurada no servidor.');
    err.code = 'PASSWORD_EMAIL_NOT_CONFIGURED';
    throw err;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Redefinição de senha - ${companyName}`,
      text: `Olá ${userName || 'usuário'},

Recebemos uma solicitação para redefinir sua senha de acesso ao painel de ${companyName}.

Abra o link abaixo. Ele expira em 30 minutos e pode ser usado apenas uma vez:
${resetUrl}

Se você não solicitou a alteração, ignore esta mensagem.`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Não foi possível enviar o e-mail de recuperação.${detail ? ` ${detail.slice(0, 180)}` : ''}`);
  }
}
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
        login TEXT,
        senha_hash TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`ALTER TABLE avaliacao_empresas ADD COLUMN IF NOT EXISTS login TEXT;`);
    await pool.query(`ALTER TABLE avaliacao_empresas ADD COLUMN IF NOT EXISTS senha_hash TEXT;`);
    await pool.query(`ALTER TABLE avaliacao_empresas ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'pro';`);
    await pool.query(`ALTER TABLE avaliacao_empresas ADD COLUMN IF NOT EXISTS status_assinatura TEXT NOT NULL DEFAULT 'active';`);
    await pool.query(`ALTER TABLE avaliacao_empresas ADD COLUMN IF NOT EXISTS vencimento_em TIMESTAMPTZ;`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS avaliacao_empresas_login_lower_idx ON avaliacao_empresas (LOWER(login)) WHERE login IS NOT NULL;`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS avaliacao_usuarios (
        id TEXT PRIMARY KEY,
        empresa_id TEXT NOT NULL REFERENCES avaliacao_empresas(empresa_id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        login TEXT NOT NULL,
        email TEXT,
        senha_hash TEXT NOT NULL,
        perfil TEXT NOT NULL DEFAULT 'manager',
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        ultimo_acesso_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS avaliacao_usuarios_empresa_login_idx ON avaliacao_usuarios (empresa_id, LOWER(login));`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS avaliacao_password_resets (
        id TEXT PRIMARY KEY,
        empresa_id TEXT NOT NULL REFERENCES avaliacao_empresas(empresa_id) ON DELETE CASCADE,
        usuario_id TEXT NOT NULL REFERENCES avaliacao_usuarios(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expira_em TIMESTAMPTZ NOT NULL,
        usado_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS avaliacao_password_resets_usuario_idx ON avaliacao_password_resets (usuario_id, expira_em DESC);`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS avaliacao_auditoria (
        id BIGSERIAL PRIMARY KEY,
        empresa_id TEXT,
        empresa_nome TEXT,
        ator_tipo TEXT NOT NULL,
        ator_usuario_id TEXT,
        ator_nome TEXT NOT NULL,
        acao TEXT NOT NULL,
        entidade TEXT NOT NULL,
        entidade_id TEXT,
        resumo TEXT NOT NULL,
        detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS avaliacao_auditoria_empresa_data_idx ON avaliacao_auditoria (empresa_id, criado_em DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS avaliacao_auditoria_data_idx ON avaliacao_auditoria (criado_em DESC);`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS avaliacao_plataforma_config (
        id INTEGER PRIMARY KEY,
        dados JSONB NOT NULL DEFAULT '{}'::jsonb,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      INSERT INTO avaliacao_plataforma_config (id, dados)
      VALUES (1, '{"planPrices":{"basic":0,"pro":0,"premium":0}}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Compatibilidade com o campo legado "ativo": empresas anteriormente
    // desativadas passam a ser tratadas como assinatura suspensa.
    await pool.query(`
      UPDATE avaliacao_empresas
      SET status_assinatura = 'suspended'
      WHERE ativo = FALSE AND COALESCE(status_assinatura, 'active') <> 'suspended';
    `);

    // Migração automática: empresas antigas passam a ter login = slug/ID e
    // senha = antigo managerPin (ou 1234 quando nunca foi personalizado).
    const legacyCompanies = await pool.query('SELECT empresa_id, dados, login, senha_hash FROM avaliacao_empresas');
    for (const row of legacyCompanies.rows) {
      const legacyPin = String(row.dados?.settings?.managerPin || '1234');
      const nextLogin = String(row.login || row.empresa_id).trim().toLowerCase();
      const nextHash = row.senha_hash || hashPassword(legacyPin);
      const nextData = row.dados || {};
      nextData.settings = { ...(nextData.settings || {}), managerLogin: nextLogin };
      await pool.query(
        "UPDATE avaliacao_empresas SET login=$2, senha_hash=$3, dados=jsonb_set(dados, '{settings}', COALESCE(dados->'settings','{}'::jsonb) || $4::jsonb) WHERE empresa_id=$1",
        [row.empresa_id, nextLogin, nextHash, JSON.stringify({ managerLogin: nextLogin })]
      );
      await pool.query(
        `INSERT INTO avaliacao_usuarios (id, empresa_id, nome, login, senha_hash, perfil, ativo)
         VALUES ($1,$2,$3,$4,$5,'owner',TRUE)
         ON CONFLICT (id) DO UPDATE
           SET nome=EXCLUDED.nome,
               login=EXCLUDED.login,
               senha_hash=CASE WHEN avaliacao_usuarios.senha_hash IS NULL OR avaliacao_usuarios.senha_hash='' THEN EXCLUDED.senha_hash ELSE avaliacao_usuarios.senha_hash END,
               perfil='owner',
               ativo=TRUE,
               atualizado_em=NOW()`,
        [`owner:${row.empresa_id}`, row.empresa_id, String(nextData?.settings?.name || row.empresa_id), nextLogin, nextHash]
      );
    }
    console.log('[PostgreSQL] Banco conectado; empresas com login/senha e tabelas prontas.');
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
  consumptionItems: [] as Array<{ id: string; name: string }>,
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
  managerLogin: 'demo',
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
  legalName: '',
  privacyContactEmail: '',
  privacyContactPhone: '',
  privacyNoticeRequired: true,
  marketingOptInEnabled: true,
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

interface PrivacyRequestRecord {
  id: string;
  type: 'access' | 'correction' | 'deletion' | 'marketing_revocation';
  name?: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  message?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  internalNote?: string;
  result?: string;
}

interface RestaurantDb {
  settings: typeof DEFAULT_SETTINGS;
  rewards: any[];
  waiters: any[];
  reviews: any[];
  privacyRequests: PrivacyRequestRecord[];
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
          privacyRequests: Array.isArray(parsed.privacyRequests) ? parsed.privacyRequests : [],
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
          privacyRequests: Array.isArray(parsed.privacyRequests) ? parsed.privacyRequests : [],
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
    privacyRequests: [],
  };
}
const postgresSaveQueues = new Map<string, Promise<void>>();
async function saveDbToPostgres(db: RestaurantDb, explicitCompanyId?: string): Promise<void> {
  const empresaId = normalizeCompanyId(explicitCompanyId || currentCompanyId());
  // IMPORTANT: always serialize a concrete tenant DB object, never the activeDb Proxy.
  // JSON.stringify(activeDb) can become '{}', which would wipe persisted company data.
  const snapshot = JSON.stringify(db);
  const nome = db.settings?.name || empresaId;
  const initialLogin = String((db.settings as any)?.managerLogin || empresaId).trim().toLowerCase();
  const initialPasswordHash = hashPassword(String((db.settings as any)?.managerPin || '1234'));

  const previous = postgresSaveQueues.get(empresaId) || Promise.resolve();
  const queued = previous.catch(() => {}).then(async () => {
    await pool.query(
      `INSERT INTO avaliacao_empresas (empresa_id, nome, slug, dados, login, senha_hash, atualizado_em)
       VALUES ($1, $2, $1, $3::jsonb, $4, $5, NOW())
       ON CONFLICT (empresa_id)
       DO UPDATE SET dados=EXCLUDED.dados, nome=EXCLUDED.nome, atualizado_em=NOW()`,
      [empresaId, nome, snapshot, initialLogin, initialPasswordHash]
    );
    console.log(`[PostgreSQL] Persistência confirmada para empresa ${empresaId}.`);
  });

  postgresSaveQueues.set(empresaId, queued);
  try {
    await queued;
  } finally {
    if (postgresSaveQueues.get(empresaId) === queued) {
      postgresSaveQueues.delete(empresaId);
    }
  }
}
async function saveDb(_db: RestaurantDb): Promise<void> {
  const context = tenantContext.getStore();
  if (!context?.db || !context.baseDb) throw new Error('Contexto de persistência indisponível.');
  const changed = clone(context.db);
  const base = clone(context.baseDb);
  const result = await withCompanyTransaction(pool, context.companyId, current => {
    const merged = mergeDbChanges(base, changed, current);
    Object.assign(current, merged);
  });
  context.db = result.db;
  context.baseDb = clone(result.db);
  tenantDbs.set(context.companyId, clone(result.db));
}
function adoptCommittedDb(db: RestaurantDb) {
  const context = tenantContext.getStore();
  if (!context) return;
  context.db = clone(db); context.baseDb = clone(db);
  tenantDbs.set(context.companyId, clone(db));
}

// Multiempresa: cada requisição trabalha em um banco isolado pelo X-Company-Id.
const tenantContext = new AsyncLocalStorage<{ companyId: string; db?: RestaurantDb; baseDb?: RestaurantDb }>();
const tenantDbs = new Map<string, RestaurantDb>();
// O arquivo JSON empacotado NÃO deve virar estado ativo após um deploy.
// Ele serve apenas para uma eventual migração inicial se o PostgreSQL estiver vazio.
const legacySeed = loadDb();

function normalizeCompanyId(value: unknown): string {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean || 'demo';
}
function currentCompanyId(): string { return tenantContext.getStore()?.companyId || 'demo'; }

type AuditMutationDescriptor = {
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  companyId?: string | null;
  companyName?: string | null;
  details?: Record<string, any>;
};

function auditSafeFields(body: any): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.keys(body).filter((key) => !/(pass|senha|pin|token|secret|key|apiurl|apikey)/i.test(key)).slice(0, 30);
}

function sanitizeAuditDetails(value: any, depth = 0): any {
  if (depth > 3) return '[limite]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, 300);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeAuditDetails(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/(pass|senha|pin|token|secret|key|authorization|cookie|apiurl|apikey)/i.test(key)) continue;
      out[key] = sanitizeAuditDetails(item, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 300);
}

async function writeAuditEntry(session: AuthSession, descriptor: AuditMutationDescriptor): Promise<void> {
  try {
    const companyId = descriptor.companyId ? normalizeCompanyId(descriptor.companyId) : null;
    let companyName = descriptor.companyName ? String(descriptor.companyName).slice(0, 180) : null;
    if (companyId && !companyName) {
      const found = await pool.query('SELECT nome FROM avaliacao_empresas WHERE empresa_id=$1 LIMIT 1', [companyId]);
      companyName = found.rows[0]?.nome ? String(found.rows[0].nome).slice(0, 180) : null;
    }
    const actorName = session.role === 'superadmin' ? 'SuperAdmin' : String(session.userName || 'Usuário da empresa').slice(0, 180);
    await pool.query(
      `INSERT INTO avaliacao_auditoria
        (empresa_id,empresa_nome,ator_tipo,ator_usuario_id,ator_nome,acao,entidade,entidade_id,resumo,detalhes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        companyId,
        companyName,
        session.role,
        session.userId || null,
        actorName,
        descriptor.action,
        descriptor.entity,
        descriptor.entityId ? String(descriptor.entityId).slice(0, 220) : null,
        String(descriptor.summary || descriptor.action).slice(0, 500),
        JSON.stringify(sanitizeAuditDetails(descriptor.details || {})),
      ]
    );
  } catch (err) {
    console.warn('[Auditoria] Não foi possível registrar a ação:', err);
  }
}

function describeAuditableMutation(req: express.Request, tenantId: string): AuditMutationDescriptor | null {
  const method = req.method.toUpperCase();
  const pathName = req.path;
  const currentName = tenantDbs.get(tenantId)?.settings?.name || null;
  const fields = auditSafeFields(req.body);

  if (method === 'POST' && pathName === '/api/ai/reports') return { action: 'ai.report.generate', entity: 'ai_report', companyId: tenantId, companyName: currentName, summary: 'Análise Premium de IA consultada ou gerada.', details: { days: req.body?.days, refresh: req.body?.refresh === true } };
  if (method === 'PUT' && pathName === '/api/admin/dashboard/plan-prices') {
    return { action: 'platform.plan_prices.update', entity: 'platform', summary: 'Valores dos planos comerciais foram alterados.', details: { fields } };
  }
  if (method === 'POST' && pathName === '/api/admin/companies') {
    const id = normalizeCompanyId(req.body?.slug || req.body?.empresaId || req.body?.name || req.body?.nome);
    return { action: 'company.create', entity: 'company', entityId: id, companyId: id, companyName: req.body?.name || req.body?.nome || null, summary: `Empresa ${req.body?.name || req.body?.nome || id} cadastrada.`, details: { plan: req.body?.plan, subscriptionStatus: req.body?.subscriptionStatus, fields } };
  }
  const companyMatch = pathName.match(/^\/api\/admin\/companies\/([^/]+)(?:\/(status|renew))?$/);
  if (companyMatch) {
    const id = normalizeCompanyId(decodeURIComponent(companyMatch[1]));
    const suffix = companyMatch[2] || '';
    if (method === 'PATCH' && suffix === 'status') return { action: 'company.status.update', entity: 'company', entityId: id, companyId: id, summary: `Status da empresa ${id} alterado.`, details: { subscriptionStatus: req.body?.subscriptionStatus } };
    if (method === 'POST' && suffix === 'renew') return { action: 'company.subscription.renew', entity: 'company', entityId: id, companyId: id, summary: `Assinatura da empresa ${id} renovada.`, details: { days: req.body?.days || 30 } };
    if (method === 'PATCH' && !suffix) return { action: 'company.update', entity: 'company', entityId: id, companyId: id, companyName: req.body?.nome || req.body?.name || null, summary: `Cadastro da empresa ${id} atualizado.`, details: { fields, plan: req.body?.plan, subscriptionStatus: req.body?.subscriptionStatus } };
    if (method === 'DELETE' && !suffix) return { action: 'company.delete', entity: 'company', entityId: id, companyId: id, summary: `Empresa ${id} excluída da plataforma.` };
  }

  if (method === 'POST' && pathName === '/api/users') {
    return { action: 'user.create', entity: 'user', companyId: tenantId, companyName: currentName, summary: `Novo usuário de acesso criado${req.body?.name ? `: ${String(req.body.name).slice(0,80)}` : ''}.`, details: { accessLevel: req.body?.accessLevel, fields } };
  }
  const userMatch = pathName.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && (method === 'PATCH' || method === 'DELETE')) {
    const userId = decodeURIComponent(userMatch[1]);
    return { action: method === 'DELETE' ? 'user.delete' : 'user.update', entity: 'user', entityId: userId, companyId: tenantId, companyName: currentName, summary: method === 'DELETE' ? 'Usuário de acesso excluído.' : 'Usuário de acesso atualizado.', details: method === 'PATCH' ? { fields, accessLevel: req.body?.accessLevel, active: req.body?.active } : {} };
  }

  const companyBase = { companyId: tenantId, companyName: currentName };
  if (method === 'POST' && pathName === '/api/settings/access') return { ...companyBase, action: 'access.credentials.update', entity: 'security', summary: 'Login/senha principal da empresa foram alterados.', details: { fields } };
  if (method === 'POST' && pathName === '/api/settings/pin') return { ...companyBase, action: 'access.legacy_pin.update', entity: 'security', summary: 'Senha/PIN legado do painel foi alterado.' };
  if (method === 'POST' && pathName === '/api/settings/whatsapp') return { ...companyBase, action: 'settings.whatsapp.update', entity: 'settings', summary: 'Configurações de WhatsApp foram alteradas.', details: { fields } };
  if (method === 'POST' && pathName === '/api/sync/push') return { ...companyBase, action: 'settings.save_all', entity: 'settings', summary: 'Configurações e dados operacionais foram salvos manualmente no banco.', details: { fields } };
  if (method === 'POST' && pathName === '/api/rewards') return { ...companyBase, action: 'rewards.update', entity: 'rewards', summary: 'Lista de brindes foi atualizada.', details: { itemCount: Array.isArray(req.body) ? req.body.length : undefined } };
  if (method === 'POST' && pathName === '/api/waiters') return { ...companyBase, action: 'waiters.update', entity: 'waiters', summary: 'Lista de atendentes foi atualizada.', details: { itemCount: Array.isArray(req.body) ? req.body.length : undefined } };
  if (method === 'POST' && pathName === '/api/database/import') return { ...companyBase, action: 'backup.restore', entity: 'database', summary: 'Um backup foi restaurado na empresa.', details: { format: req.body?.format, version: req.body?.version } };
  if (method === 'GET' && pathName === '/api/database/export') return { ...companyBase, action: 'backup.download', entity: 'database', summary: 'Backup completo da empresa foi baixado.' };
  if (method === 'GET' && pathName === '/api/exports/customers.csv') return { ...companyBase, action: 'export.customers', entity: 'export', summary: 'CRM de clientes foi exportado em CSV.' };
  if (method === 'GET' && pathName === '/api/exports/reviews.csv') return { ...companyBase, action: 'export.reviews', entity: 'export', summary: 'Avaliações foram exportadas em CSV.' };

  if (method === 'GET' && pathName === '/api/admin/backup') return { action: 'platform.backup.download', entity: 'database', summary: 'Backup geral da plataforma foi baixado.' };
  const adminBackupMatch = pathName.match(/^\/api\/admin\/companies\/([^/]+)\/backup$/);
  if (method === 'GET' && adminBackupMatch) {
    const id = normalizeCompanyId(decodeURIComponent(adminBackupMatch[1]));
    return { action: 'company.backup.download', entity: 'database', entityId: id, companyId: id, summary: `Backup da empresa ${id} foi baixado pelo SuperAdmin.` };
  }

  const privacyExportMatch = pathName.match(/^\/api\/privacy\/requests\/([^/]+)\/export$/);
  if (privacyExportMatch && method === 'GET') {
    return { ...companyBase, action: 'privacy.export', entity: 'privacy_request', entityId: decodeURIComponent(privacyExportMatch[1]), summary: 'Dados de uma solicitação de acesso LGPD foram exportados.' };
  }
  const privacyMatch = pathName.match(/^\/api\/privacy\/requests\/([^/]+)(?:\/(revoke-marketing|anonymize))?$/);
  if (privacyMatch && (method === 'PATCH' || method === 'POST')) {
    const requestId = decodeURIComponent(privacyMatch[1]);
    const suffix = privacyMatch[2] || '';
    if (suffix === 'anonymize') return { ...companyBase, action: 'privacy.anonymize', entity: 'privacy_request', entityId: requestId, summary: 'Dados pessoais de uma solicitação LGPD foram anonimizados.' };
    if (suffix === 'revoke-marketing') return { ...companyBase, action: 'privacy.marketing_revoke', entity: 'privacy_request', entityId: requestId, summary: 'Consentimento promocional de um cliente foi revogado.' };
    if (method === 'PATCH') return { ...companyBase, action: 'privacy.request.update', entity: 'privacy_request', entityId: requestId, summary: 'Solicitação LGPD teve o status atualizado.', details: { status: req.body?.status } };
  }

  if (method === 'POST' && pathName === '/api/reviews/validate') return { ...companyBase, action: 'voucher.validate', entity: 'review', summary: 'Voucher de brinde foi validado.' };
  if (method === 'DELETE' && pathName === '/api/reviews') return { ...companyBase, action: 'reviews.clear', entity: 'reviews', summary: 'Todas as avaliações da empresa foram excluídas.' };
  const reviewDelete = pathName.match(/^\/api\/reviews\/([^/]+)$/);
  if (method === 'DELETE' && reviewDelete) return { ...companyBase, action: 'review.delete', entity: 'review', entityId: decodeURIComponent(reviewDelete[1]), summary: 'Uma avaliação foi excluída.' };

  return null;
}

type SubscriptionStatus = 'trial' | 'active' | 'suspended';
type SubscriptionPlan = 'basic' | 'pro' | 'premium';

type CompanyAccessMeta = {
  empresaId: string;
  nome: string;
  ativo: boolean;
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  expiresAt: string | null;
};

function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  const plan = String(value || '').trim().toLowerCase();
  return plan === 'basic' || plan === 'premium' ? plan : 'pro';
}

function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus {
  const status = String(value || '').trim().toLowerCase();
  return status === 'trial' || status === 'suspended' ? status : 'active';
}

function normalizeExpiration(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

type PlatformPlanPrices = { basic: number; pro: number; premium: number };
const DEFAULT_PLAN_PRICES: PlatformPlanPrices = { basic: 0, pro: 0, premium: 0 };

function normalizeMoney(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1_000_000, Math.round(parsed * 100) / 100));
}

function normalizePlanPrices(value: any): PlatformPlanPrices {
  return {
    basic: normalizeMoney(value?.basic),
    pro: normalizeMoney(value?.pro),
    premium: normalizeMoney(value?.premium),
  };
}

async function getPlatformPlanPrices(): Promise<PlatformPlanPrices> {
  const result = await pool.query('SELECT dados FROM avaliacao_plataforma_config WHERE id=1 LIMIT 1');
  return normalizePlanPrices(result.rows[0]?.dados?.planPrices || DEFAULT_PLAN_PRICES);
}

function normalizeDashboardPhone(value: unknown): string {
  let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2).replace(/^0+/, '');
  if (digits.length === 10 && /^[6-9]/.test(digits.slice(2))) digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  return digits;
}

function isCompanyExpired(meta: CompanyAccessMeta): boolean {
  if (!meta.expiresAt) return false;
  const expires = new Date(meta.expiresAt).getTime();
  return Number.isFinite(expires) && expires <= Date.now();
}

function companyBlock(meta: CompanyAccessMeta): { blocked: boolean; code?: string; message?: string; httpStatus?: number } {
  if (!meta.ativo || meta.subscriptionStatus === 'suspended') {
    return {
      blocked: true,
      code: 'COMPANY_SUSPENDED',
      message: 'Esta empresa está temporariamente suspensa. Entre em contato com o suporte da plataforma.',
      httpStatus: 403,
    };
  }
  if (isCompanyExpired(meta)) {
    return {
      blocked: true,
      code: 'SUBSCRIPTION_EXPIRED',
      message: 'A assinatura desta empresa venceu. Entre em contato com o suporte para renovação.',
      httpStatus: 402,
    };
  }
  return { blocked: false };
}

async function getCompanyAccessMeta(companyId: string): Promise<CompanyAccessMeta | null> {
  const result = await pool.query(
    `SELECT empresa_id, nome, ativo, plano, status_assinatura, vencimento_em
     FROM avaliacao_empresas
     WHERE empresa_id=$1
     LIMIT 1`,
    [companyId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    empresaId: String(row.empresa_id),
    nome: String(row.nome || row.empresa_id),
    ativo: Boolean(row.ativo),
    plan: normalizeSubscriptionPlan(row.plano),
    subscriptionStatus: normalizeSubscriptionStatus(row.status_assinatura),
    expiresAt: row.vencimento_em ? new Date(row.vencimento_em).toISOString() : null,
  };
}

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
      managerLogin: 'admin',
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
    reviews: [],
    privacyRequests: []
  };
}
async function loadCompanyDb(companyId: string): Promise<RestaurantDb> {
  // Read fresh persisted state; each request receives its own isolated snapshot.

  const result = await pool.query(
    'SELECT dados FROM avaliacao_empresas WHERE empresa_id=$1 LIMIT 1',
    [companyId]
  );

  if (!result.rows[0]?.dados) {
    const err: any = new Error(`Empresa "${companyId}" não encontrada.`);
    err.code = 'COMPANY_NOT_FOUND';
    throw err;
  }

  const parsed = result.rows[0].dados;
  const db: RestaurantDb = {
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
    waiters: Array.isArray(parsed.waiters) ? parsed.waiters : [],
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    privacyRequests: Array.isArray(parsed.privacyRequests) ? parsed.privacyRequests : [],
  };

  tenantDbs.set(companyId, db);
  return db;
}

const activeDb = new Proxy({} as RestaurantDb, {
  get(_target, prop) {
    const db = tenantContext.getStore()?.db;
    if (!db) throw new Error('Empresa não carregada nesta operação.');
    return db[prop as keyof RestaurantDb];
  },
  set(_target, prop, value) {
    const db = tenantContext.getStore()?.db;
    if (!db) throw new Error('Empresa não carregada nesta operação.');
    (db as any)[prop] = value; return true;
  }
});

async function loadAllCompaniesFromPostgres(): Promise<number> {
  try {
    const result = await pool.query(
      'SELECT empresa_id, dados FROM avaliacao_empresas WHERE ativo=TRUE'
    );

    for (const row of result.rows) {
      const parsed = row.dados || {};
      tenantDbs.set(row.empresa_id, {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
        waiters: Array.isArray(parsed.waiters) ? parsed.waiters : [],
        reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
        privacyRequests: Array.isArray(parsed.privacyRequests) ? parsed.privacyRequests : [],
      });
    }

    console.log(`[PostgreSQL] ${result.rows.length} empresa(s) carregada(s) do banco no boot.`);
    return result.rows.length;
  } catch (e) {
    console.error('[PostgreSQL] Erro ao carregar empresas no boot:', e);
    throw e;
  }
}

interface WhatsAppDispatch {
  companyId: string;
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
function recordDispatch(record: WhatsAppDispatch) {
  recentDispatches.unshift(record);
  let count = 0;
  for (let i = 0; i < recentDispatches.length; i++) {
    if (recentDispatches[i].companyId === record.companyId && ++count > 50) { recentDispatches.splice(i--, 1); }
  }
}

const processedWebhookIds = new Set<string>();
const MAX_WEBHOOK_CACHE = 500;

async function syncFirestoreToActiveDb(): Promise<void> {
  // Desativado: PostgreSQL é a única fonte de verdade.
  return;
}

async function startServer() {
 // Inicializa e carrega o banco PostgreSQL antes de iniciar o sistema
await initPostgres();

const totalEmpresas = await loadAllCompaniesFromPostgres();

// Migração inicial somente se o banco estiver realmente vazio.
// Em deploys posteriores, NUNCA regrava padrões por cima do PostgreSQL.
if (totalEmpresas === 0) {
  console.log('[PostgreSQL] Banco vazio: criando somente o registro inicial demo.');
  tenantDbs.set('demo', legacySeed);
  await tenantContext.run({ companyId: 'demo' }, async () => {
    await saveDbToPostgres(legacySeed);
  });
}



  await initCommerceSchema(pool);
  await initAiSchema(pool);
  const app = express();
  // Set only to the known number of trusted reverse proxies (Render: normally 1).
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  app.set('trust proxy', Number.isInteger(proxyHops) && proxyHops > 0 ? proxyHops : false);
  // Express 4 does not automatically catch rejected async route handlers.
  for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
    const original = (app[method] as any).bind(app);
    (app as any)[method] = (route: any, ...handlers: any[]) => original(route, ...handlers.map(handler =>
      (req: any, res: any, next: any) => Promise.resolve().then(() => handler(req, res, next)).catch(next)));
  }

  // Define automaticamente qual empresa deve abrir quando a URL principal é
  // acessada sem ?empresa=. Priorizamos o Sr. Coxita; se o nome tiver sido
  // alterado, usamos a empresa ativa mais antiga como fallback seguro.
  async function getDefaultPublicCompanyId(): Promise<string | null> {
    const result = await pool.query(`
      SELECT empresa_id
      FROM avaliacao_empresas
      WHERE ativo = TRUE
        AND COALESCE(status_assinatura, 'active') <> 'suspended'
        AND (vencimento_em IS NULL OR vencimento_em > NOW())
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(nome, '')) IN ('sr. coxita', 'sr coxita') THEN 0
          WHEN LOWER(COALESCE(dados->'settings'->>'name', '')) IN ('sr. coxita', 'sr coxita') THEN 0
          WHEN LOWER(COALESCE(nome, '')) LIKE '%coxita%' THEN 1
          WHEN LOWER(COALESCE(dados->'settings'->>'name', '')) LIKE '%coxita%' THEN 1
          ELSE 2
        END,
        criado_em ASC
      LIMIT 1
    `);
    return result.rows[0]?.empresa_id ? String(result.rows[0].empresa_id) : null;
  }

  app.use(async (req, res, next) => {
    const requestedCompany = req.header('X-Company-Id') || req.query.empresa;

    // Páginas e arquivos estáticos não precisam carregar um tenant. Isso evita
    // que /assets/* ou a própria página inicial tentem usar o antigo "demo".
    if (!req.path.startsWith('/api/')) {
      const superPath = req.path.replace(/\/$/, '');
      const isSuperAdminPage = superPath === '/superadmin' || superPath === '/super-admin';

      // A URL principal (e páginas institucionais) sem nenhum parâmetro deve
      // cair na tela de login (AccessPortal) do lado do cliente, não em uma
      // empresa específica. Só preenchemos ?empresa= automaticamente quando a
      // URL já indica claramente uma avaliação/QR antigo (mesa, cliente ou
      // origem=qrcode) ou um acesso de gerência legado (gerencia=1), mas
      // faltou o parâmetro empresa — mantendo QR Codes impressos antigos
      // funcionando sem forçar a raiz do domínio para uma empresa fixa.
      const isNoContextPage = superPath === '' || superPath === '/acesso' || superPath === '/privacidade' || superPath === '/termos';
      const hasLegacyEvaluationContext = Boolean(
        req.query.mesa || req.query.cliente || req.query.origem === 'qrcode' || req.query.gerencia === '1'
      );
      if (!requestedCompany && !isSuperAdminPage && !isNoContextPage && hasLegacyEvaluationContext) {
        try {
          const defaultCompanyId = await getDefaultPublicCompanyId();
          if (defaultCompanyId) {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(req.query)) {
              if (Array.isArray(value)) {
                value.forEach((item) => params.append(key, String(item)));
              } else if (value !== undefined) {
                params.set(key, String(value));
              }
            }
            params.set('empresa', defaultCompanyId);
            const query = params.toString();
            return res.redirect(302, `${req.path}${query ? `?${query}` : ''}`);
          }
        } catch (err) {
          console.error('[Multiempresa] Falha ao descobrir empresa padrão:', err);
        }
      }

      return next();
    }

    const companyId = normalizeCompanyId(requestedCompany || 'demo');

    // Super Admin and health do not depend on a tenant DB being loaded.
    if (req.path.startsWith('/api/admin/') || req.path === '/api/health') {
      return tenantContext.run({ companyId }, next);
    }

    // These routes need to identify the tenant but must remain reachable even
    // when the subscription is suspended/expired. This is necessary so the UI
    // can show the correct message and so the SuperAdmin can still authenticate.
    if (req.path === '/api/company/status' || req.path === '/api/auth/portal-login' || req.path === '/api/auth/manager' || req.path === '/api/auth/forgot-password' || req.path === '/api/auth/reset-password') {
      return tenantContext.run({ companyId }, next);
    }

    try {
      const meta = await getCompanyAccessMeta(companyId);
      if (!meta) {
        return res.status(404).json({ error: `Empresa "${companyId}" não encontrada.`, code: 'COMPANY_NOT_FOUND' });
      }

      const session = getAuthSession(req);
      const hasMasterAccess = session?.role === 'superadmin';
      const block = companyBlock(meta);
      if (block.blocked && !hasMasterAccess) {
        return res.status(block.httpStatus || 403).json({
          error: block.message,
          code: block.code,
          company: {
            empresaId: meta.empresaId,
            nome: meta.nome,
            plan: meta.plan,
            subscriptionStatus: meta.subscriptionStatus,
            expiresAt: meta.expiresAt,
          },
        });
      }

      const db = clone(await loadCompanyDb(companyId));
      return tenantContext.run({ companyId, db, baseDb: clone(db) }, next);
    } catch (err: any) {
      if (err?.code === 'COMPANY_NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      console.error(`[Multiempresa] Falha ao carregar ${companyId} do PostgreSQL:`, err);
      return res.status(503).json({
        error: 'Banco temporariamente indisponível. Nenhum dado padrão foi gravado.',
      });
    }
  });

  const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;

  app.use(express.json({ limit: '10mb' }));

  // Administração geral multiempresa com login + senha mestre.
  function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthSession(req);
    if (!session || session.role !== 'superadmin') {
      return res.status(401).json({ error: 'Acesso de administrador geral negado.' });
    }
    next();
  }

  function sessionCanManageCompany(req: express.Request, companyId = currentCompanyId()): boolean {
    const session = getAuthSession(req);
    return Boolean(session && (session.role === 'superadmin' || (session.role === 'manager' && session.companyId === companyId)));
  }

  function requireCompanyManager(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!getAuthSession(req)) return res.status(401).json({ error: 'Faça login novamente.' });
    if (sessionCanManageCompany(req)) return next();
    return res.status(403).json({ error: 'Sessão sem permissão para esta empresa.' });
  }

  function requireCompanyEditor(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthSession(req);
    if (!session) return res.status(401).json({ error: 'Faça login novamente.' });
    if (!sessionCanManageCompany(req)) return res.status(403).json({ error: 'Sessão sem permissão para esta empresa.' });
    if (session.role === 'superadmin' || normalizeAccessLevel(session.accessLevel) !== 'viewer') return next();
    return res.status(403).json({ error: 'Este usuário possui acesso somente para consulta.' });
  }

  function requireCompanyOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthSession(req);
    if (!session) return res.status(401).json({ error: 'Faça login novamente.' });
    if (!sessionCanManageCompany(req)) return res.status(403).json({ error: 'Sessão sem permissão para esta empresa.' });
    if (session.role === 'superadmin' || normalizeAccessLevel(session.accessLevel) === 'owner') return next();
    return res.status(403).json({ error: 'Apenas o proprietário/administrador principal pode realizar esta ação.' });
  }

  function publicSettingsOnly(settings: Record<string, any>) {
    const safe = { ...settings };
    // Nunca exponha credenciais, tokens ou dados de gerência na página pública.
    delete safe.managerPin;
    delete safe.managerLogin;
    delete safe.whatsappApiUrl;
    delete safe.whatsappApiToken;
    delete safe.whatsappWebhookVerifyToken;
    delete safe.whatsappCustomMessage;
    return safe;
  }

  // Auditoria automática apenas para mutações autenticadas e relevantes.
  // Senhas, tokens e credenciais nunca são gravados no histórico.
  app.use((req, res, next) => {
    const session = getAuthSession(req);
    if (!session) return next();
    const tenantId = currentCompanyId();
    const descriptor = describeAuditableMutation(req, tenantId);
    if (!descriptor) return next();
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        void writeAuditEntry(session, descriptor);
      }
    });
    next();
  });

  app.get('/api/admin/audit', requireSuperAdmin, async (req, res) => {
    try {
      const rawLimit = Number(req.query.limit || 80);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(250, Math.floor(rawLimit))) : 80;
      const requestedCompany = String(req.query.companyId || '').trim();
      const params: any[] = [];
      let where = '';
      if (requestedCompany) {
        params.push(normalizeCompanyId(requestedCompany));
        where = `WHERE empresa_id=$${params.length}`;
      }
      params.push(limit);
      const result = await pool.query(
        `SELECT id,empresa_id,empresa_nome,ator_tipo,ator_usuario_id,ator_nome,acao,entidade,entidade_id,resumo,detalhes,criado_em
         FROM avaliacao_auditoria
         ${where}
         ORDER BY criado_em DESC
         LIMIT $${params.length}`,
        params
      );
      return res.json({ logs: result.rows.map((row: any) => ({
        id: row.id,
        companyId: row.empresa_id,
        companyName: row.empresa_nome,
        actorRole: row.ator_tipo,
        actorUserId: row.ator_usuario_id,
        actorName: row.ator_nome,
        action: row.acao,
        entity: row.entidade,
        entityId: row.entidade_id,
        summary: row.resumo,
        details: row.detalhes || {},
        createdAt: row.criado_em,
      })) });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao carregar histórico de auditoria.' });
    }
  });

  app.get('/api/audit', requireCompanyOwner, async (req, res) => {
    try {
      const companyId = currentCompanyId();
      const rawLimit = Number(req.query.limit || 50);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(150, Math.floor(rawLimit))) : 50;
      const result = await pool.query(
        `SELECT id,empresa_id,empresa_nome,ator_tipo,ator_usuario_id,ator_nome,acao,entidade,entidade_id,resumo,detalhes,criado_em
         FROM avaliacao_auditoria
         WHERE empresa_id=$1
         ORDER BY criado_em DESC
         LIMIT $2`,
        [companyId, limit]
      );
      return res.json({ logs: result.rows.map((row: any) => ({
        id: row.id,
        actorRole: row.ator_tipo,
        actorName: row.ator_nome,
        action: row.acao,
        entity: row.entidade,
        entityId: row.entidade_id,
        summary: row.resumo,
        details: row.detalhes || {},
        createdAt: row.criado_em,
      })) });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao carregar histórico de atividades.' });
    }
  });

  app.post('/api/admin/login', (req, res) => {
    const { login, password } = req.body || {};
    const key = rateLimitKey(req, 'superadmin-login', login);
    const limit = consumeRateLimit(key, 8, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' });
    }
    if (!superAdminCredentialsMatch(login, password)) {
      return res.status(401).json({ error: 'Login ou senha mestre inválidos.' });
    }
    clearRateLimit(key);
    const token = createAuthSession({ role: 'superadmin' });
    return res.json({ success: true, token, role: 'superadmin', expiresInHours: 8 });
  });

  app.get('/api/admin/companies', requireSuperAdmin, async (_req, res) => {
    const result = await pool.query(`
      SELECT
        empresa_id,
        nome,
        slug,
        login,
        (SELECT u.email FROM avaliacao_usuarios u WHERE u.empresa_id=avaliacao_empresas.empresa_id AND u.perfil='owner' LIMIT 1) AS recovery_email,
        ativo,
        plano,
        status_assinatura,
        vencimento_em,
        criado_em,
        atualizado_em,
        CASE
          WHEN jsonb_typeof(dados->'reviews') = 'array' THEN jsonb_array_length(dados->'reviews')
          ELSE 0
        END::int AS total_avaliacoes,
        CASE
          WHEN ativo = FALSE OR COALESCE(status_assinatura, 'active') = 'suspended' THEN 'suspended'
          WHEN vencimento_em IS NOT NULL AND vencimento_em <= NOW() THEN 'expired'
          WHEN COALESCE(status_assinatura, 'active') = 'trial' THEN 'trial'
          ELSE 'active'
        END AS status_efetivo
      FROM avaliacao_empresas
      ORDER BY criado_em DESC
    `);
    res.json({ companies: result.rows });
  });

  app.get('/api/admin/dashboard', requireSuperAdmin, async (_req, res) => {
    const companiesResult = await pool.query(`
      SELECT empresa_id, nome, ativo, plano, status_assinatura, vencimento_em, dados->'reviews' AS reviews
      FROM avaliacao_empresas
      ORDER BY criado_em DESC
    `);
    const planPrices = await getPlatformPlanPrices();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * dayMs;
    const sevenDaysAhead = now + 7 * dayMs;
    const dayKeys: string[] = [];
    const dailyMap = new Map<string, number>();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date(now - offset * dayMs);
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      dailyMap.set(key, 0);
    }

    const statusCounts = { active: 0, trial: 0, suspended: 0, expired: 0 };
    const planCounts = { basic: 0, pro: 0, premium: 0 };
    const mrrByPlan = { basic: 0, pro: 0, premium: 0 };
    const customerPhones = new Set<string>();
    const topCompanies: Array<{ empresaId: string; nome: string; plan: SubscriptionPlan; status: string; totalReviews: number; reviews30d: number }> = [];
    let totalReviews = 0;
    let reviews30d = 0;
    let expiring7Days = 0;
    let mrr = 0;

    for (const row of companiesResult.rows) {
      const plan = normalizeSubscriptionPlan(row.plano);
      planCounts[plan] += 1;
      const expiresAt = row.vencimento_em ? new Date(row.vencimento_em).getTime() : NaN;
      let status: 'active' | 'trial' | 'suspended' | 'expired' = 'active';
      if (!row.ativo || normalizeSubscriptionStatus(row.status_assinatura) === 'suspended') status = 'suspended';
      else if (Number.isFinite(expiresAt) && expiresAt <= now) status = 'expired';
      else if (normalizeSubscriptionStatus(row.status_assinatura) === 'trial') status = 'trial';
      statusCounts[status] += 1;

      if ((status === 'active' || status === 'trial') && Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= sevenDaysAhead) {
        expiring7Days += 1;
      }
      if (status === 'active') {
        const value = planPrices[plan] || 0;
        mrr += value;
        mrrByPlan[plan] += value;
      }

      const reviews = Array.isArray(row.reviews) ? row.reviews : [];
      let company30 = 0;
      totalReviews += reviews.length;
      for (const review of reviews) {
        const phone = normalizeDashboardPhone(review?.customerPhoneNormalized || review?.customerPhone);
        if (phone) customerPhones.add(`${row.empresa_id}:${phone}`);
        const created = new Date(String(review?.createdAt || '')).getTime();
        if (!Number.isFinite(created)) continue;
        if (created >= thirtyDaysAgo) {
          reviews30d += 1;
          company30 += 1;
        }
        const dayKey = new Date(created).toISOString().slice(0, 10);
        if (dailyMap.has(dayKey)) dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
      }
      topCompanies.push({
        empresaId: String(row.empresa_id),
        nome: String(row.nome || row.empresa_id),
        plan,
        status,
        totalReviews: reviews.length,
        reviews30d: company30,
      });
    }

    topCompanies.sort((a, b) => b.reviews30d - a.reviews30d || b.totalReviews - a.totalReviews || a.nome.localeCompare(b.nome));
    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        companies: companiesResult.rowCount || companiesResult.rows.length,
        ...statusCounts,
        expiring7Days,
        totalReviews,
        reviews30d,
        uniqueCustomers: customerPhones.size,
        mrr: Math.round(mrr * 100) / 100,
      },
      plans: {
        counts: planCounts,
        prices: planPrices,
        mrrByPlan: {
          basic: Math.round(mrrByPlan.basic * 100) / 100,
          pro: Math.round(mrrByPlan.pro * 100) / 100,
          premium: Math.round(mrrByPlan.premium * 100) / 100,
        },
      },
      dailyReviews: dayKeys.map((date) => ({ date, count: dailyMap.get(date) || 0 })),
      topCompanies: topCompanies.slice(0, 5),
    });
  });

  app.put('/api/admin/dashboard/plan-prices', requireSuperAdmin, async (req, res) => {
    const planPrices = normalizePlanPrices(req.body || {});
    await pool.query(
      `INSERT INTO avaliacao_plataforma_config (id, dados, atualizado_em)
       VALUES (1, jsonb_build_object('planPrices', $1::jsonb), NOW())
       ON CONFLICT (id)
       DO UPDATE SET dados = jsonb_set(COALESCE(avaliacao_plataforma_config.dados, '{}'::jsonb), '{planPrices}', $1::jsonb, TRUE), atualizado_em=NOW()`,
      [JSON.stringify(planPrices)]
    );
    res.json({ success: true, planPrices });
  });

  // Backup externo pelo SuperAdmin, sem expor hashes de senha.
  app.get('/api/admin/companies/:id/backup', requireSuperAdmin, async (req, res) => {
    const companyId = normalizeCompanyId(req.params.id);
    const result = await pool.query('SELECT empresa_id,nome,slug,ativo,plano,status_assinatura,vencimento_em,criado_em,atualizado_em,dados FROM avaliacao_empresas WHERE empresa_id=$1 LIMIT 1', [companyId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada.' });
    const row = result.rows[0];
    const payload = { format: 'avaliaeganha-company-backup', version: 2, exportedAt: new Date().toISOString(), company: { empresa_id: row.empresa_id, nome: row.nome, slug: row.slug, ativo: row.ativo, plano: row.plano, status_assinatura: row.status_assinatura, vencimento_em: row.vencimento_em, criado_em: row.criado_em, atualizado_em: row.atualizado_em }, data: row.dados };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="backup_${safeExportFilePart(row.nome || companyId)}_${new Date().toISOString().slice(0,10)}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  });

  app.get('/api/admin/backup', requireSuperAdmin, async (_req, res) => {
    const companies = await pool.query('SELECT empresa_id,nome,slug,ativo,plano,status_assinatura,vencimento_em,criado_em,atualizado_em,dados FROM avaliacao_empresas ORDER BY criado_em');
    const users = await pool.query('SELECT id,empresa_id,nome,login,email,perfil,ativo,ultimo_acesso_em,criado_em,atualizado_em FROM avaliacao_usuarios ORDER BY empresa_id,criado_em');
    const payload = { format: 'avaliaeganha-platform-backup', version: 1, exportedAt: new Date().toISOString(), note: 'Backup de dados sem hashes de senha. Credenciais devem ser redefinidas em uma restauração total.', companies: companies.rows, users: users.rows };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="backup_plataforma_${new Date().toISOString().slice(0,10)}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  });

  app.post('/api/admin/companies', requireSuperAdmin, async (req, res) => {
    const empresaId = normalizeCompanyId(req.body?.slug || req.body?.empresaId || req.body?.name);
    const nome = String(req.body?.name || '').trim();
    const login = String(req.body?.login || empresaId).trim().toLowerCase();
    const password = String(req.body?.password || '').trim();
    const recoveryEmail = String(req.body?.recoveryEmail || '').trim().toLowerCase();
    const plan = normalizeSubscriptionPlan(req.body?.plan);
    const subscriptionStatus = normalizeSubscriptionStatus(req.body?.subscriptionStatus || 'trial');
    const rawExpiresAt = req.body?.expiresAt;
    let expiresAt = normalizeExpiration(rawExpiresAt);

    if (!nome || empresaId === 'demo') return res.status(400).json({ error: 'Informe nome e slug válidos.' });
    if (login.length < 3) return res.status(400).json({ error: 'O login da empresa deve ter pelo menos 3 caracteres.' });
    if (password.length < 6) return res.status(400).json({ error: 'A senha da empresa deve ter pelo menos 6 caracteres.' });
    if (!isValidEmail(recoveryEmail)) return res.status(400).json({ error: 'Informe um e-mail de recuperação válido.' });
    if (rawExpiresAt !== undefined && rawExpiresAt !== null && String(rawExpiresAt).trim() !== '' && !expiresAt) {
      return res.status(400).json({ error: 'Informe uma data de vencimento válida.' });
    }

    if (!expiresAt && subscriptionStatus !== 'suspended') {
      const defaultDays = subscriptionStatus === 'trial' ? 7 : 30;
      expiresAt = new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const duplicateId = await pool.query('SELECT empresa_id FROM avaliacao_empresas WHERE empresa_id=$1 LIMIT 1', [empresaId]);
    if (duplicateId.rows[0]) return res.status(409).json({ error: 'Já existe uma empresa com este identificador.' });
    const duplicateLogin = await pool.query('SELECT empresa_id FROM avaliacao_empresas WHERE LOWER(login)=LOWER($1) LIMIT 1', [login]);
    if (duplicateLogin.rows[0]) return res.status(409).json({ error: 'Este login já está sendo usado por outra empresa.' });
    const db = freshDb();
    db.settings.name = nome;
    (db.settings as any).managerLogin = login;
    const ativo = subscriptionStatus !== 'suspended';
    await pool.query(
      `INSERT INTO avaliacao_empresas
        (empresa_id,nome,slug,ativo,dados,login,senha_hash,plano,status_assinatura,vencimento_em)
       VALUES ($1,$2,$1,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
      [empresaId, nome, ativo, JSON.stringify(db), login, hashPassword(password), plan, subscriptionStatus, expiresAt]
    );
    await pool.query(
      `INSERT INTO avaliacao_usuarios (id, empresa_id, nome, login, email, senha_hash, perfil, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,'owner',TRUE)
       ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, login=EXCLUDED.login, email=EXCLUDED.email, senha_hash=EXCLUDED.senha_hash, perfil='owner', ativo=TRUE, atualizado_em=NOW()`,
      [`owner:${empresaId}`, empresaId, nome, login, recoveryEmail || null, hashPassword(password)]
    );
    tenantDbs.set(empresaId, db);
    res.status(201).json({
      success: true,
      company: {
        empresaId,
        nome,
        slug: empresaId,
        login,
        recoveryEmail: recoveryEmail || null,
        plan,
        subscriptionStatus,
        expiresAt,
      },
      evaluationUrl: `/?empresa=${empresaId}&cliente=1`,
    });
  });

  app.patch('/api/admin/companies/:id/status', requireSuperAdmin, async (req, res) => {
    const id = normalizeCompanyId(req.params.id);
    const requestedStatus = req.body?.subscriptionStatus !== undefined
      ? normalizeSubscriptionStatus(req.body.subscriptionStatus)
      : (Boolean(req.body?.ativo) ? 'active' : 'suspended');
    const ativo = requestedStatus !== 'suspended';
    const result = await pool.query(
      `UPDATE avaliacao_empresas
       SET ativo=$2, status_assinatura=$3, atualizado_em=NOW()
       WHERE empresa_id=$1
       RETURNING empresa_id, ativo, plano, status_assinatura, vencimento_em`,
      [id, ativo, requestedStatus]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada.' });
    if (!ativo) tenantDbs.delete(id);
    res.json({ success: true, ...result.rows[0] });
  });

  app.post('/api/admin/companies/:id/renew', requireSuperAdmin, async (req, res) => {
    const id = normalizeCompanyId(req.params.id);
    const rawDays = Number(req.body?.days ?? 30);
    const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(3650, Math.round(rawDays))) : 30;
    const result = await pool.query(
      `UPDATE avaliacao_empresas
       SET vencimento_em = CASE
             WHEN vencimento_em IS NULL OR vencimento_em < NOW()
               THEN NOW() + ($2::int * INTERVAL '1 day')
             ELSE vencimento_em + ($2::int * INTERVAL '1 day')
           END,
           status_assinatura='active',
           ativo=TRUE,
           atualizado_em=NOW()
       WHERE empresa_id=$1
       RETURNING empresa_id, plano, status_assinatura, ativo, vencimento_em`,
      [id, days]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada.' });
    res.json({ success: true, daysAdded: days, ...result.rows[0] });
  });


  app.patch('/api/admin/companies/:id', requireSuperAdmin, async (req, res) => {
    const id = normalizeCompanyId(req.params.id);
    const nome = String(req.body?.nome || req.body?.name || '').trim();
    const login = String(req.body?.login || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();
    const recoveryEmail = Object.prototype.hasOwnProperty.call(req.body || {}, 'recoveryEmail') ? String(req.body?.recoveryEmail || '').trim().toLowerCase() : undefined;
    if (!nome) return res.status(400).json({ error: 'Informe um nome válido.' });
    if (login && login.length < 3) return res.status(400).json({ error: 'O login deve ter pelo menos 3 caracteres.' });
    if (password && password.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    if (recoveryEmail !== undefined && !isValidEmail(recoveryEmail)) return res.status(400).json({ error: 'Informe um e-mail de recuperação válido.' });

    const result = await pool.query(
      'SELECT dados, login, plano, status_assinatura, vencimento_em FROM avaliacao_empresas WHERE empresa_id=$1 LIMIT 1',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const nextLogin = login || String(result.rows[0].login || id).toLowerCase();
    const nextPlan = req.body?.plan !== undefined
      ? normalizeSubscriptionPlan(req.body.plan)
      : normalizeSubscriptionPlan(result.rows[0].plano);
    const nextStatus = req.body?.subscriptionStatus !== undefined
      ? normalizeSubscriptionStatus(req.body.subscriptionStatus)
      : normalizeSubscriptionStatus(result.rows[0].status_assinatura);
    let nextExpiresAt = result.rows[0].vencimento_em ? new Date(result.rows[0].vencimento_em).toISOString() : null;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'expiresAt')) {
      const rawExpiresAt = req.body?.expiresAt;
      if (rawExpiresAt === null || String(rawExpiresAt || '').trim() === '') {
        nextExpiresAt = null;
      } else {
        const normalized = normalizeExpiration(rawExpiresAt);
        if (!normalized) return res.status(400).json({ error: 'Informe uma data de vencimento válida.' });
        nextExpiresAt = normalized;
      }
    }

    const duplicateLogin = await pool.query('SELECT empresa_id FROM avaliacao_empresas WHERE LOWER(login)=LOWER($1) AND empresa_id<>$2 LIMIT 1', [nextLogin, id]);
    if (duplicateLogin.rows[0]) return res.status(409).json({ error: 'Este login já está sendo usado por outra empresa.' });
    const duplicateCompanyUser = await pool.query(
      `SELECT id FROM avaliacao_usuarios WHERE empresa_id=$1 AND LOWER(login)=LOWER($2) AND id<>$3 LIMIT 1`,
      [id, nextLogin, `owner:${id}`]
    );
    if (duplicateCompanyUser.rows[0]) return res.status(409).json({ error: 'Este login já está sendo usado por outro usuário desta empresa.' });

    const dados = result.rows[0].dados || freshDb();
    dados.settings = { ...DEFAULT_SETTINGS, ...(dados.settings || {}), name: nome, managerLogin: nextLogin };
    const ativo = nextStatus !== 'suspended';

    if (password) {
      await pool.query(
        `UPDATE avaliacao_empresas
         SET nome=$2, login=$3, senha_hash=$4, dados=jsonb_set(dados, '{settings}', COALESCE(dados->'settings','{}'::jsonb) || $5::jsonb),
             plano=$6, status_assinatura=$7, vencimento_em=$8, ativo=$9, atualizado_em=NOW()
         WHERE empresa_id=$1`,
        [id, nome, nextLogin, hashPassword(password), JSON.stringify({ name: nome, managerLogin: nextLogin }), nextPlan, nextStatus, nextExpiresAt, ativo]
      );
    } else {
      await pool.query(
        `UPDATE avaliacao_empresas
         SET nome=$2, login=$3, dados=jsonb_set(dados, '{settings}', COALESCE(dados->'settings','{}'::jsonb) || $4::jsonb),
             plano=$5, status_assinatura=$6, vencimento_em=$7, ativo=$8, atualizado_em=NOW()
         WHERE empresa_id=$1`,
        [id, nome, nextLogin, JSON.stringify({ name: nome, managerLogin: nextLogin }), nextPlan, nextStatus, nextExpiresAt, ativo]
      );
    }

    const cached = tenantDbs.get(id);
    if (cached) {
      cached.settings = { ...cached.settings, name: nome, managerLogin: nextLogin } as any;
      tenantDbs.set(id, cached);
    }

    const ownerId = `owner:${id}`;
    const ownerFields = await pool.query('SELECT email, senha_hash FROM avaliacao_usuarios WHERE id=$1 LIMIT 1', [ownerId]);
    const ownerEmail = recoveryEmail !== undefined ? (recoveryEmail || null) : (ownerFields.rows[0]?.email || null);
    const ownerHash = password ? hashPassword(password) : (ownerFields.rows[0]?.senha_hash || null);
    if (ownerHash) {
      await pool.query(
        `INSERT INTO avaliacao_usuarios (id, empresa_id, nome, login, email, senha_hash, perfil, ativo)
         VALUES ($1,$2,$3,$4,$5,$6,'owner',TRUE)
         ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, login=EXCLUDED.login, email=EXCLUDED.email, senha_hash=EXCLUDED.senha_hash, perfil='owner', ativo=TRUE, atualizado_em=NOW()`,
        [ownerId, id, nome, nextLogin, ownerEmail, ownerHash]
      );
      if (password) invalidateUserSessions(ownerId);
    }

    if (!ativo) tenantDbs.delete(id);

    res.json({
      success: true,
      empresaId: id,
      nome,
      login: nextLogin,
      recoveryEmail: ownerEmail,
      plan: nextPlan,
      subscriptionStatus: nextStatus,
      expiresAt: nextExpiresAt,
      ativo,
      passwordChanged: Boolean(password),
    });
  });

  app.delete('/api/admin/companies/:id', requireSuperAdmin, async (req, res) => {
    const id = normalizeCompanyId(req.params.id);

    if (id === 'demo') {
      return res.status(400).json({
        error: 'A empresa demo é o registro técnico padrão e não pode ser excluída. Você pode renomeá-la ou desativá-la.'
      });
    }

    const exists = await pool.query(
      'SELECT empresa_id FROM avaliacao_empresas WHERE empresa_id=$1 LIMIT 1',
      [id]
    );
    if (!exists.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada.' });

    await pool.query('DELETE FROM avaliacao_empresas WHERE empresa_id=$1', [id]);
    tenantDbs.delete(id);

    res.json({ success: true, empresaId: id });
  });

  // API Routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Public status endpoint used by the customer page to avoid showing a stale
  // cached evaluation form when a company is suspended or its subscription has
  // expired. It intentionally does not expose credentials or private data.
  app.get('/api/company/status', async (_req, res) => {
    try {
      const companyId = currentCompanyId();
      const meta = await getCompanyAccessMeta(companyId);
      if (!meta) {
        return res.status(404).json({
          accessible: false,
          code: 'COMPANY_NOT_FOUND',
          message: 'Empresa não encontrada.',
        });
      }
      const block = companyBlock(meta);
      return res.json({
        accessible: !block.blocked,
        code: block.code || 'OK',
        message: block.message || null,
        company: {
          empresaId: meta.empresaId,
          nome: meta.nome,
          plan: meta.plan,
          subscriptionStatus: meta.subscriptionStatus,
          expiresAt: meta.expiresAt,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ accessible: false, code: 'STATUS_ERROR', message: err?.message || 'Erro ao consultar empresa.' });
    }
  });

  // Portal geral de acesso. Permite que o site comercial aponte apenas para
  // app.avaliaeganha.com.br, sem precisar conhecer o slug da empresa.
  // O login é procurado globalmente, mas a sessão gerada continua vinculada a
  // uma única empresa e todas as rotas privadas mantêm o isolamento por tenant.
  app.post('/api/auth/portal-login', async (req, res) => {
    try {
      const login = String(req.body?.login || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!login || !password) return res.status(400).json({ error: 'Informe login e senha.' });

      const loginRateKey = rateLimitKey(req, 'portal-login', login);
      const loginLimit = consumeRateLimit(loginRateKey, 10, 15 * 60 * 1000);
      if (!loginLimit.allowed) {
        res.setHeader('Retry-After', String(loginLimit.retryAfterSeconds));
        return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' });
      }

      if (superAdminCredentialsMatch(login, password)) {
        clearRateLimit(loginRateKey);
        const token = createAuthSession({ role: 'superadmin' });
        return res.json({ success: true, token, role: 'superadmin', redirect: '/super-admin' });
      }

      const result = await pool.query(
        `SELECT u.id, u.empresa_id, u.nome, u.login, u.senha_hash, u.perfil, u.ativo
         FROM avaliacao_usuarios u
         WHERE LOWER(u.login)=LOWER($1) AND u.ativo=TRUE`,
        [login]
      );

      const matches = result.rows.filter((user: any) =>
        safeEqualText(login, String(user.login || '').trim().toLowerCase()) &&
        verifyPassword(password, user.senha_hash)
      );

      if (matches.length === 0) {
        return res.status(401).json({ error: 'Login ou senha inválidos.' });
      }
      if (matches.length > 1) {
        return res.status(409).json({
          error: 'Este login está vinculado a mais de uma empresa. Entre pelo link específico da empresa ou solicite ao administrador a alteração do login.',
          code: 'AMBIGUOUS_LOGIN',
        });
      }

      const user = matches[0];
      const companyId = normalizeCompanyId(user.empresa_id);
      const meta = await getCompanyAccessMeta(companyId);
      if (!meta) return res.status(404).json({ error: 'Empresa não encontrada.', code: 'COMPANY_NOT_FOUND' });

      const block = companyBlock(meta);
      if (block.blocked) {
        return res.status(block.httpStatus || 403).json({
          error: block.message,
          code: block.code,
          expiresAt: meta.expiresAt,
        });
      }

      const accessLevel = normalizeAccessLevel(user.perfil);
      clearRateLimit(loginRateKey);
      const token = createAuthSession({ role: 'manager', companyId, userId: user.id, userName: user.nome, accessLevel });
      await pool.query('UPDATE avaliacao_usuarios SET ultimo_acesso_em=NOW(), atualizado_em=NOW() WHERE id=$1', [user.id]);
      return res.json({
        success: true,
        token,
        role: 'manager',
        companyId,
        login: user.login,
        userId: user.id,
        userName: user.nome,
        accessLevel,
        redirect: `/gerencia?empresa=${encodeURIComponent(companyId)}`,
      });
    } catch (err: any) {
      console.error('[Portal login]', err);
      return res.status(500).json({ error: err?.message || 'Erro ao autenticar.' });
    }
  });

  // Login do painel de uma empresa. O login/senha mestre do SuperAdmin também
  // funciona aqui e permite entrar em qualquer tenant sem conhecer a senha local.
  app.post('/api/auth/manager', async (req, res) => {
    try {
      const { login, password } = req.body || {};
      const companyId = currentCompanyId();
      const loginRateKey = rateLimitKey(req, `company-login:${companyId}`, login);
      const loginLimit = consumeRateLimit(loginRateKey, 10, 15 * 60 * 1000);
      if (!loginLimit.allowed) {
        res.setHeader('Retry-After', String(loginLimit.retryAfterSeconds));
        return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' });
      }

      const meta = await getCompanyAccessMeta(companyId);
      if (!meta) return res.status(404).json({ error: 'Empresa não encontrada.', code: 'COMPANY_NOT_FOUND' });

      if (superAdminCredentialsMatch(login, password)) {
        clearRateLimit(loginRateKey);
        const token = createAuthSession({ role: 'superadmin' });
        return res.json({ success: true, token, role: 'superadmin', companyId, accessLevel: 'owner', userName: 'SuperAdmin' });
      }

      const block = companyBlock(meta);
      if (block.blocked) {
        return res.status(block.httpStatus || 403).json({
          error: block.message,
          code: block.code,
          expiresAt: meta.expiresAt,
        });
      }

      const normalizedLogin = String(login || '').trim().toLowerCase();
      const result = await pool.query(
        `SELECT id, nome, login, senha_hash, perfil, ativo
         FROM avaliacao_usuarios
         WHERE empresa_id=$1 AND LOWER(login)=LOWER($2)
         LIMIT 1`,
        [companyId, normalizedLogin]
      );
      const user = result.rows[0];
      if (!user || !user.ativo || !safeEqualText(normalizedLogin, String(user.login || '').trim().toLowerCase()) || !verifyPassword(String(password || ''), user.senha_hash)) {
        return res.status(401).json({ error: 'Login ou senha inválidos.' });
      }
      const accessLevel = normalizeAccessLevel(user.perfil);
      clearRateLimit(loginRateKey);
      const token = createAuthSession({ role: 'manager', companyId, userId: user.id, userName: user.nome, accessLevel });
      await pool.query('UPDATE avaliacao_usuarios SET ultimo_acesso_em=NOW(), atualizado_em=NOW() WHERE id=$1', [user.id]);
      return res.json({ success: true, token, role: 'manager', companyId, login: user.login, userId: user.id, userName: user.nome, accessLevel });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao autenticar.' });
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const companyId = currentCompanyId();
      const login = String(req.body?.login || '').trim().toLowerCase();
      if (!login) return res.status(400).json({ error: 'Informe o login de acesso.' });
      const resetRateKey = rateLimitKey(req, `password-reset:${companyId}`, login);
      const resetLimit = consumeRateLimit(resetRateKey, 3, 15 * 60 * 1000);
      if (!resetLimit.allowed) {
        res.setHeader('Retry-After', String(resetLimit.retryAfterSeconds));
        return res.status(429).json({ error: 'Muitas solicitações de recuperação. Aguarde alguns minutos e tente novamente.' });
      }

      const result = await pool.query(
        `SELECT u.id, u.nome, u.email, u.ativo, e.nome AS empresa_nome
         FROM avaliacao_usuarios u
         JOIN avaliacao_empresas e ON e.empresa_id=u.empresa_id
         WHERE u.empresa_id=$1 AND LOWER(u.login)=LOWER($2)
         LIMIT 1`,
        [companyId, login]
      );
      const user = result.rows[0];
      // Evita revelar logins inexistentes.
      if (!user || !user.ativo) {
        return res.json({ success: true, message: 'Se o login estiver cadastrado e possuir e-mail de recuperação, você receberá as instruções.' });
      }
      if (!user.email) {
        return res.status(400).json({ error: 'Este acesso ainda não possui e-mail de recuperação cadastrado. Solicite ao proprietário ou SuperAdmin a redefinição da senha.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = passwordResetTokenHash(token);
      const resetId = crypto.randomUUID();
      await pool.query('DELETE FROM avaliacao_password_resets WHERE usuario_id=$1 AND usado_em IS NULL', [user.id]);
      await pool.query(
        `INSERT INTO avaliacao_password_resets (id, empresa_id, usuario_id, token_hash, expira_em)
         VALUES ($1,$2,$3,$4,NOW() + INTERVAL '30 minutes')`,
        [resetId, companyId, user.id, tokenHash]
      );

      const proto = String(req.header('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
      const host = String(req.get('host') || '').trim();
      const baseUrl = String(process.env.PUBLIC_APP_URL || (host ? `${proto}://${host}` : '')).replace(/\/$/, '');
      const resetUrl = `${baseUrl}/gerencia?empresa=${encodeURIComponent(companyId)}&reset_token=${encodeURIComponent(token)}`;
      try {
        await sendPasswordResetEmail(String(user.email), resetUrl, String(user.empresa_nome || companyId), String(user.nome || ''));
      } catch (emailErr: any) {
        await pool.query('DELETE FROM avaliacao_password_resets WHERE id=$1', [resetId]).catch(() => {});
        if (emailErr?.code === 'PASSWORD_EMAIL_NOT_CONFIGURED') {
          return res.status(503).json({ error: 'A recuperação por e-mail ainda não foi configurada pelo administrador da plataforma.' });
        }
        throw emailErr;
      }

      return res.json({ success: true, message: `Enviamos um link de redefinição para o e-mail cadastrado. O link expira em 30 minutos.` });
    } catch (err: any) {
      console.error('[Auth] Erro ao solicitar recuperação de senha:', err);
      return res.status(500).json({ error: err?.message || 'Não foi possível iniciar a recuperação de senha.' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const companyId = currentCompanyId();
      const token = String(req.body?.token || '').trim();
      const password = String(req.body?.password || '').trim();
      if (!token) return res.status(400).json({ error: 'Link de redefinição inválido.' });
      if (password.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });

      const tokenHash = passwordResetTokenHash(token);
      const result = await pool.query(
        `SELECT r.id AS reset_id, r.usuario_id, u.perfil
         FROM avaliacao_password_resets r
         JOIN avaliacao_usuarios u ON u.id=r.usuario_id
         WHERE r.empresa_id=$1 AND r.token_hash=$2 AND r.usado_em IS NULL AND r.expira_em>NOW() AND u.ativo=TRUE
         LIMIT 1`,
        [companyId, tokenHash]
      );
      const reset = result.rows[0];
      if (!reset) return res.status(400).json({ error: 'Este link é inválido, já foi utilizado ou expirou.' });

      const nextHash = hashPassword(password);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE avaliacao_usuarios SET senha_hash=$2, atualizado_em=NOW() WHERE id=$1', [reset.usuario_id, nextHash]);
        if (normalizeAccessLevel(reset.perfil) === 'owner') {
          await client.query('UPDATE avaliacao_empresas SET senha_hash=$2, atualizado_em=NOW() WHERE empresa_id=$1', [companyId, nextHash]);
        }
        await client.query('UPDATE avaliacao_password_resets SET usado_em=NOW() WHERE id=$1', [reset.reset_id]);
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
      invalidateUserSessions(String(reset.usuario_id));
      return res.json({ success: true, message: 'Senha redefinida com sucesso. Você já pode entrar com a nova senha.' });
    } catch (err: any) {
      console.error('[Auth] Erro ao redefinir senha:', err);
      return res.status(500).json({ error: err?.message || 'Não foi possível redefinir a senha.' });
    }
  });

  app.get('/api/users', requireCompanyOwner, async (_req, res) => {
    try {
      const companyId = currentCompanyId();
      const result = await pool.query(
        `SELECT id, nome, login, email, perfil, ativo, ultimo_acesso_em, criado_em, atualizado_em
         FROM avaliacao_usuarios
         WHERE empresa_id=$1
         ORDER BY CASE WHEN perfil='owner' THEN 0 ELSE 1 END, nome ASC`,
        [companyId]
      );
      return res.json({ users: result.rows });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao carregar usuários.' });
    }
  });

  app.post('/api/users', requireCompanyOwner, async (req, res) => {
    try {
      const companyId = currentCompanyId();
      const nome = String(req.body?.name || req.body?.nome || '').trim();
      const login = String(req.body?.login || '').trim().toLowerCase();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '').trim();
      const accessLevel = normalizeAccessLevel(req.body?.accessLevel || req.body?.perfil || 'manager');
      if (!nome) return res.status(400).json({ error: 'Informe o nome do usuário.' });
      if (login.length < 3) return res.status(400).json({ error: 'O login deve ter pelo menos 3 caracteres.' });
      if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
      if (accessLevel === 'owner') return res.status(400).json({ error: 'O acesso de proprietário é o acesso principal da empresa e não pode ser duplicado.' });

      const duplicate = await pool.query('SELECT id FROM avaliacao_usuarios WHERE empresa_id=$1 AND LOWER(login)=LOWER($2) LIMIT 1', [companyId, login]);
      if (duplicate.rows[0]) return res.status(409).json({ error: 'Este login já está sendo usado nesta empresa.' });
      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO avaliacao_usuarios (id, empresa_id, nome, login, email, senha_hash, perfil, ativo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
         RETURNING id, nome, login, email, perfil, ativo, ultimo_acesso_em, criado_em, atualizado_em`,
        [id, companyId, nome, login, email || null, hashPassword(password), accessLevel]
      );
      return res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err: any) {
      if (String(err?.code) === '23505') return res.status(409).json({ error: 'Este login já está sendo usado nesta empresa.' });
      return res.status(500).json({ error: err?.message || 'Erro ao criar usuário.' });
    }
  });

  app.patch('/api/users/:id', requireCompanyOwner, async (req, res) => {
    try {
      const companyId = currentCompanyId();
      const id = String(req.params.id || '').trim();
      const currentResult = await pool.query('SELECT * FROM avaliacao_usuarios WHERE id=$1 AND empresa_id=$2 LIMIT 1', [id, companyId]);
      const current = currentResult.rows[0];
      if (!current) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const isOwner = normalizeAccessLevel(current.perfil) === 'owner';
      const nome = Object.prototype.hasOwnProperty.call(req.body || {}, 'name') || Object.prototype.hasOwnProperty.call(req.body || {}, 'nome')
        ? String(req.body?.name || req.body?.nome || '').trim()
        : String(current.nome);
      const login = Object.prototype.hasOwnProperty.call(req.body || {}, 'login')
        ? String(req.body?.login || '').trim().toLowerCase()
        : String(current.login);
      const email = Object.prototype.hasOwnProperty.call(req.body || {}, 'email')
        ? String(req.body?.email || '').trim().toLowerCase()
        : String(current.email || '');
      const password = String(req.body?.password || '').trim();
      const requestedLevel = normalizeAccessLevel(req.body?.accessLevel || req.body?.perfil || current.perfil);
      const accessLevel: CompanyAccessLevel = isOwner ? 'owner' : (requestedLevel === 'owner' ? 'manager' : requestedLevel);
      const active = isOwner ? true : (req.body?.active === undefined && req.body?.ativo === undefined ? Boolean(current.ativo) : Boolean(req.body?.active ?? req.body?.ativo));

      if (!nome) return res.status(400).json({ error: 'Informe o nome do usuário.' });
      if (login.length < 3) return res.status(400).json({ error: 'O login deve ter pelo menos 3 caracteres.' });
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
      if (password && password.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
      const duplicate = await pool.query('SELECT id FROM avaliacao_usuarios WHERE empresa_id=$1 AND LOWER(login)=LOWER($2) AND id<>$3 LIMIT 1', [companyId, login, id]);
      if (duplicate.rows[0]) return res.status(409).json({ error: 'Este login já está sendo usado nesta empresa.' });

      const nextHash = password ? hashPassword(password) : current.senha_hash;
      const result = await pool.query(
        `UPDATE avaliacao_usuarios
         SET nome=$3, login=$4, email=$5, senha_hash=$6, perfil=$7, ativo=$8, atualizado_em=NOW()
         WHERE id=$1 AND empresa_id=$2
         RETURNING id, nome, login, email, perfil, ativo, ultimo_acesso_em, criado_em, atualizado_em`,
        [id, companyId, nome, login, email || null, nextHash, accessLevel, active]
      );

      if (isOwner) {
        const currentDb = tenantDbs.get(companyId) || await loadCompanyDb(companyId);
        currentDb.settings = { ...currentDb.settings, managerLogin: login } as any;
        tenantDbs.set(companyId, currentDb);
        await pool.query(
          `UPDATE avaliacao_empresas
           SET login=$2, senha_hash=$3,
               dados=jsonb_set(COALESCE(dados,'{}'::jsonb), '{settings}', COALESCE(dados->'settings','{}'::jsonb) || $4::jsonb, true),
               atualizado_em=NOW()
           WHERE empresa_id=$1`,
          [companyId, login, nextHash, JSON.stringify({ managerLogin: login })]
        );
      }
      if (password || !active || login !== current.login || accessLevel !== normalizeAccessLevel(current.perfil)) invalidateUserSessions(id);
      return res.json({ success: true, user: result.rows[0] });
    } catch (err: any) {
      if (String(err?.code) === '23505') return res.status(409).json({ error: 'Este login já está sendo usado nesta empresa.' });
      return res.status(500).json({ error: err?.message || 'Erro ao atualizar usuário.' });
    }
  });

  app.delete('/api/users/:id', requireCompanyOwner, async (req, res) => {
    try {
      const companyId = currentCompanyId();
      const id = String(req.params.id || '').trim();
      const userResult = await pool.query('SELECT perfil FROM avaliacao_usuarios WHERE id=$1 AND empresa_id=$2 LIMIT 1', [id, companyId]);
      const user = userResult.rows[0];
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (normalizeAccessLevel(user.perfil) === 'owner') return res.status(400).json({ error: 'O proprietário principal não pode ser excluído.' });
      await pool.query('DELETE FROM avaliacao_usuarios WHERE id=$1 AND empresa_id=$2', [id, companyId]);
      invalidateUserSessions(id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao excluir usuário.' });
    }
  });

  app.post('/api/settings/access', requireCompanyOwner, async (req, res) => {
    try {
      const companyId = currentCompanyId();
      const login = String(req.body?.login || '').trim().toLowerCase();
      const password = String(req.body?.password || '').trim();
      if (login.length < 3) return res.status(400).json({ error: 'O login deve ter pelo menos 3 caracteres.' });
      if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      const duplicate = await pool.query('SELECT empresa_id FROM avaliacao_empresas WHERE LOWER(login)=LOWER($1) AND empresa_id<>$2 LIMIT 1', [login, companyId]);
      if (duplicate.rows[0]) return res.status(409).json({ error: 'Este login já está em uso.' });
      const duplicateUser = await pool.query(
        `SELECT id FROM avaliacao_usuarios WHERE empresa_id=$1 AND LOWER(login)=LOWER($2) AND id<>$3 LIMIT 1`,
        [companyId, login, `owner:${companyId}`]
      );
      if (duplicateUser.rows[0]) return res.status(409).json({ error: 'Este login já está sendo usado por outro usuário desta empresa.' });

      const current = tenantDbs.get(companyId) || await loadCompanyDb(companyId);
      current.settings = { ...current.settings, managerLogin: login } as any;
      tenantDbs.set(companyId, current);
      const nextHash = hashPassword(password);
      await pool.query(
        `UPDATE avaliacao_empresas
         SET login=$2, senha_hash=$3,
             dados=jsonb_set(COALESCE(dados,'{}'::jsonb), '{settings}', COALESCE(dados->'settings','{}'::jsonb) || $4::jsonb, true),
             atualizado_em=NOW()
         WHERE empresa_id=$1`,
        [companyId, login, nextHash, JSON.stringify({ managerLogin: login })]
      );
      const ownerId = `owner:${companyId}`;
      await pool.query(
        `UPDATE avaliacao_usuarios SET login=$2, senha_hash=$3, atualizado_em=NOW() WHERE id=$1`,
        [ownerId, login, nextHash]
      );
      invalidateUserSessions(ownerId);
      return res.json({ success: true, login });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao atualizar login e senha.' });
    }
  });

  registerAiRoutes(app, pool, requireCompanyManager, requireCompanyEditor, currentCompanyId);

  // Full Central System Synchronization
  app.get('/api/sync', async (_req, res) => {
    try {
      const companyId = currentCompanyId();
      const result = await pool.query(
        'SELECT dados FROM avaliacao_empresas WHERE empresa_id=$1 AND ativo=TRUE LIMIT 1',
        [companyId]
      );

      if (!result.rows[0]?.dados) {
        return res.status(404).json({ error: 'Empresa não encontrada ou desativada.' });
      }

      const persisted = result.rows[0].dados;
      const db: RestaurantDb = {
        settings: { ...DEFAULT_SETTINGS, ...(persisted.settings || {}) },
        rewards: Array.isArray(persisted.rewards) ? persisted.rewards : [],
        waiters: Array.isArray(persisted.waiters) ? persisted.waiters : [],
        reviews: Array.isArray(persisted.reviews) ? persisted.reviews : [],
        privacyRequests: Array.isArray(persisted.privacyRequests) ? persisted.privacyRequests : [],
      };

      adoptCommittedDb(db);

      const session = getAuthSession(_req);
      const canManage = sessionCanManageCompany(_req, companyId);
      const canViewPrivateSettings = Boolean(canManage && (session?.role === 'superadmin' || normalizeAccessLevel(session?.accessLevel) !== 'viewer'));
      const responseSettings: any = canViewPrivateSettings ? { ...db.settings } : publicSettingsOnly(db.settings as any);
      return res.json({
        settings: responseSettings,
        rewards: db.rewards,
        waiters: db.waiters,
        reviews: canManage ? db.reviews : [],
        serverTime: new Date().toISOString(),
        source: 'postgresql',
      });
    } catch (err: any) {
      console.error('[Sync] Erro ao ler PostgreSQL:', err);
      return res.status(503).json({
        error: 'Não foi possível ler o PostgreSQL. Nenhum padrão será aplicado.',
      });
    }
  });

  // Get Reviews
  app.get('/api/reviews', requireCompanyManager, async (_req, res) => {
   
    res.json({
      reviews: activeDb.reviews,
      total: activeDb.reviews.length,
      serverTime: new Date().toISOString(),
    });
  });

  // Submit New Customer Review (From Table QR Code or Client View)
  app.post('/api/reviews', async (req, res) => {
    const companyId = currentCompanyId();
    if (Buffer.byteLength(JSON.stringify(req.body || {})) > 16384 || req.body?.website) {
      throw new CommerceError(400, 'Dados da avaliação inválidos.');
    }
    await consumePublicReviewRate(pool, companyId, req.ip || req.socket.remoteAddress || 'unknown');
    const result = await createPublicReview(pool, companyId, req.body);
    adoptCommittedDb(result.db);
    const { review, reward, replay } = result.value;
    // Voucher is already committed. WhatsApp failure must not invalidate a prize
    // or cause a retry to issue another one. Replays never resend automatically.
    res.status(replay ? 200 : 201).json({ success: true, review, reward, replay });
    if (!replay && result.db.settings.autoSendWhatsApp && (result.db.settings.autoSendMode || 'silent_api') === 'silent_api') {
      void (async () => {
        const outcome = await executeWhatsAppSend({
          phone: review.customerPhone, customerName: review.customerName,
          rewardTitle: review.rewardTitle, rewardCode: review.rewardCode,
          restaurantName: result.db.settings.name,
          message: buildOfficialVoucherMessage({ ...review, restaurantName: result.db.settings.name }),
          templateMode: 'brinde_template',
        });
        const saved = await withCompanyTransaction(pool, companyId, db => {
          const stored = db.reviews.find((r: any) => r.id === review.id);
          if (!stored) return;
          stored.whatsappStatus = outcome.success ? 'sent_silently' : 'failed';
          if (outcome.success) stored.whatsappSentAt = new Date().toISOString();
        });
        tenantDbs.set(companyId, clone(saved.db));
      })().catch(err => console.error('[WhatsApp] Envio pós-confirmação falhou:', err));
    }
  });

  // Solicitações públicas de privacidade (LGPD). O pedido NÃO executa exclusão sozinho:
  // ele entra na fila da empresa para que a identidade do solicitante possa ser confirmada.
  app.post('/api/privacy/requests', async (req, res) => {
    try {
      const body = req.body || {};
      const type = String(body.type || '').trim() as PrivacyRequestRecord['type'];
      const allowed = new Set(['access', 'correction', 'deletion', 'marketing_revocation']);
      if (!allowed.has(type)) return res.status(400).json({ error: 'Tipo de solicitação inválido.' });

      const phone = String(body.phone || '').trim();
      const normalizedPhone = normalizeDashboardPhone(phone);
      if (normalizedPhone.length < 10) return res.status(400).json({ error: 'Informe o telefone com DDD usado na avaliação.' });

      const email = String(body.email || '').trim().slice(0, 180);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'E-mail inválido.' });
      }

      const limiter = consumeRateLimit(rateLimitKey(req, 'privacy-request', normalizedPhone), 5, 24 * 60 * 60 * 1000);
      if (!limiter.allowed) {
        res.setHeader('Retry-After', String(limiter.retryAfterSeconds));
        return res.status(429).json({ error: 'Muitas solicitações para este contato. Tente novamente mais tarde.' });
      }

      const request: PrivacyRequestRecord = {
        id: `privacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        name: String(body.name || '').trim().slice(0, 120) || undefined,
        phone,
        normalizedPhone,
        email: email || undefined,
        message: String(body.message || '').trim().slice(0, 1000) || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      activeDb.privacyRequests = [request, ...(activeDb.privacyRequests || [])];
      await saveDb(activeDb);
      return res.status(201).json({ success: true, protocol: request.id });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao registrar solicitação de privacidade.' });
    }
  });

  app.get('/api/privacy/requests', requireCompanyManager, (_req, res) => {
    const rows = [...(activeDb.privacyRequests || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ success: true, requests: rows });
  });

  app.patch('/api/privacy/requests/:id', requireCompanyEditor, async (req, res) => {
    const id = String(req.params.id || '');
    const request = (activeDb.privacyRequests || []).find((item) => item.id === id);
    if (!request) return res.status(404).json({ error: 'Solicitação não encontrada.' });
    const status = String(req.body?.status || request.status) as PrivacyRequestRecord['status'];
    if (!['pending', 'in_progress', 'completed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
    request.status = status;
    request.internalNote = String(req.body?.internalNote || request.internalNote || '').trim().slice(0, 1000) || undefined;
    request.updatedAt = new Date().toISOString();
    if (status === 'completed') request.completedAt = request.completedAt || new Date().toISOString();
    await saveDb(activeDb);
    return res.json({ success: true, request });
  });

  app.get('/api/privacy/requests/:id/export', requireCompanyManager, (req, res) => {
    const id = String(req.params.id || '');
    const request = (activeDb.privacyRequests || []).find((item) => item.id === id);
    if (!request) return res.status(404).json({ error: 'Solicitação não encontrada.' });
    const target = request.normalizedPhone;
    const reviews = (activeDb.reviews || []).filter((review: any) => {
      const current = normalizeDashboardPhone(review.customerPhoneNormalized || review.customerPhone);
      return Boolean(target && current === target);
    });
    const payload = {
      format: 'avaliaeganha-privacy-access',
      version: 1,
      generatedAt: new Date().toISOString(),
      protocol: request.id,
      request: {
        type: request.type,
        name: request.name || '',
        phone: request.phone,
        email: request.email || '',
        createdAt: request.createdAt,
      },
      data: { reviews },
      note: 'Arquivo gerado para atendimento de solicitação de privacidade. Confirme a identidade do solicitante antes de compartilhar.'
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dados_cliente_${request.id.slice(-8)}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  });

  app.post('/api/privacy/requests/:id/revoke-marketing', requireCompanyEditor, async (req, res) => {
    const id = String(req.params.id || '');
    const request = (activeDb.privacyRequests || []).find((item) => item.id === id);
    if (!request) return res.status(404).json({ error: 'Solicitação não encontrada.' });
    if (request.type !== 'marketing_revocation') return res.status(400).json({ error: 'Esta ação é permitida apenas para pedidos de interrupção de comunicações promocionais.' });

    const target = request.normalizedPhone;
    let affected = 0;
    const now = new Date().toISOString();
    activeDb.reviews = (activeDb.reviews || []).map((review: any) => {
      const current = normalizeDashboardPhone(review.customerPhoneNormalized || review.customerPhone);
      if (!target || current !== target) return review;
      affected += 1;
      const updated = { ...review, marketingConsent: false, marketingConsentRevokedAt: now };
      delete updated.marketingConsentAt;
      return updated;
    });
    request.status = 'completed';
    request.completedAt = now;
    request.updatedAt = now;
    request.result = `Consentimento promocional revogado em ${affected} avaliação(ões) vinculada(s) ao telefone informado.`;
    await saveDb(activeDb);
    return res.json({ success: true, affected, request, reviews: activeDb.reviews });
  });

  // A anonimização é deliberadamente restrita a proprietário/SuperAdmin e exige ação explícita.
  // As notas agregadas permanecem para estatísticas, enquanto nome/telefone e consentimento promocional são removidos.
  app.post('/api/privacy/requests/:id/anonymize', requireCompanyOwner, async (req, res) => {
    const id = String(req.params.id || '');
    const request = (activeDb.privacyRequests || []).find((item) => item.id === id);
    if (!request) return res.status(404).json({ error: 'Solicitação não encontrada.' });
    if (request.type !== 'deletion') return res.status(400).json({ error: 'A anonimização automática é permitida apenas para pedidos de exclusão.' });

    const target = request.normalizedPhone;
    let affected = 0;
    const now = new Date().toISOString();
    activeDb.reviews = (activeDb.reviews || []).map((review: any) => {
      const current = normalizeDashboardPhone(review.customerPhoneNormalized || review.customerPhone);
      if (!target || current !== target) return review;
      affected += 1;
      const cleaned = { ...review };
      delete cleaned.customerName;
      delete cleaned.customerPhone;
      delete cleaned.customerPhoneNormalized;
      delete cleaned.tableNumber;
      delete cleaned.claimedTable;
      delete cleaned.criticism;
      delete cleaned.suggestion;
      delete cleaned.waiterCompliment;
      delete cleaned.waiterCompliments;
      delete cleaned.marketingConsentAt;
      cleaned.marketingConsent = false;
      cleaned.marketingConsentRevokedAt = now;
      cleaned.privacyAnonymizedAt = now;
      return cleaned;
    });

    request.status = 'completed';
    request.completedAt = now;
    request.updatedAt = now;
    request.result = `${affected} avaliação(ões) tiveram identificadores, dados de mesa e campos de texto livre anonimizados/removidos.`;
    await saveDb(activeDb);
    return res.json({ success: true, affected, request, reviews: activeDb.reviews });
  });

  // Validate / Claim Reward Voucher
  app.post('/api/reviews/validate', requireCompanyEditor, async (req, res) => {
    const result = await redeemVoucher(pool, currentCompanyId(), req.body?.code, req.body?.tableNumber);
    adoptCommittedDb(result.db);
    return res.json({ success: true, review: result.value, reviews: result.db.reviews });
  });

  // Delete Single Review
  app.delete('/api/reviews/:id', requireCompanyEditor, async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'ID da avaliação é obrigatório.' });
      }
      const beforeCount = activeDb.reviews.length;
      activeDb.reviews = activeDb.reviews.filter((r: any) => r.id !== id);
      await saveDb(activeDb);
      console.log(`[Central Sync] Avaliação ${id} removida do servidor. Antes: ${beforeCount}, Agora: ${activeDb.reviews.length}`);

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
  app.delete('/api/reviews', requireCompanyEditor, async (_req, res) => {
    try {
      activeDb.reviews = [];
      await saveDb(activeDb);
      console.log('[Central Sync] Todas as avaliações foram limpas do servidor.');

      return res.json({ success: true, reviews: [] });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao limpar avaliações.' });
    }
  });

  // Update Settings
  app.post('/api/settings', requireCompanyEditor, async (req, res) => {
    try {
      const companyId = currentCompanyId();
      const incoming = req.body && typeof req.body === 'object' ? { ...req.body } : {};
      delete incoming.consumptionItems; // Catalog changes use their dedicated transactional routes.
      const incomingName = String(incoming.name || '').trim();

      const result = await pool.query(
        `UPDATE avaliacao_empresas
         SET dados = jsonb_set(
               COALESCE(dados, '{}'::jsonb),
               '{settings}',
               COALESCE(dados->'settings', '{}'::jsonb) || $2::jsonb,
               true
             ),
             nome = CASE WHEN $3 <> '' THEN $3 ELSE nome END,
             atualizado_em = NOW()
         WHERE empresa_id=$1 AND ativo=TRUE
         RETURNING dados`,
        [companyId, JSON.stringify(incoming), incomingName]
      );

      if (!result.rows[0]?.dados) {
        return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
      }

      const persisted = result.rows[0].dados;
      const current = tenantDbs.get(companyId) || {
        settings: { ...DEFAULT_SETTINGS },
        rewards: [],
        waiters: [],
        reviews: [],
        privacyRequests: [],
      };
      current.settings = { ...DEFAULT_SETTINGS, ...(persisted.settings || {}) };
      if (Array.isArray(persisted.rewards)) current.rewards = persisted.rewards;
      if (Array.isArray(persisted.waiters)) current.waiters = persisted.waiters;
      if (Array.isArray(persisted.reviews)) current.reviews = persisted.reviews;
      tenantDbs.set(companyId, current);

      console.log(`[PostgreSQL] Configurações de ${companyId} persistidas sem substituir outras áreas.`);

      return res.json({
        success: true,
        persisted: true,
        settings: current.settings,
        source: 'postgresql',
      });
    } catch (err: any) {
      console.error('[Settings] Erro ao salvar:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Erro ao salvar configurações.',
      });
    }
  });

  // Dedicated PIN Update Endpoint
  app.post('/api/settings/pin', requireCompanyEditor, async (req, res) => {
    try {
      const { pin } = req.body || {};
      if (!pin || typeof pin !== 'string' || pin.trim().length < 3) {
        return res.status(400).json({ error: 'PIN inválido. Mínimo de 3 caracteres.' });
      }
      const trimmedPin = pin.trim();
      activeDb.settings.managerPin = trimmedPin;
      await saveDb(activeDb);
      console.log('[Database] PIN atualizado com persistência confirmada.');
      return res.json({ success: true, managerPin: trimmedPin });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao atualizar senha no servidor.' });
    }
  });

  // Dedicated WhatsApp API Settings Update Endpoint
  app.post('/api/settings/whatsapp', requireCompanyEditor, async (req, res) => {
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
      await saveDb(activeDb);
      console.log(`[Database] Configurações de WhatsApp salvas no banco com sucesso (URL: ${activeDb.settings.whatsappApiUrl || 'nenhuma'})`);
      return res.json({ success: true, settings: activeDb.settings });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar credenciais de WhatsApp no servidor.' });
    }
  });

  app.get('/api/consumption-items', requireCompanyManager, (_req, res) => {
    res.json({ items: activeDb.settings.consumptionItems || [] });
  });
  for (const [method, operation] of [['post', 'create'], ['patch', 'update'], ['delete', 'delete']] as const) {
    app[method](operation === 'create' ? '/api/consumption-items' : '/api/consumption-items/:id', requireCompanyEditor, async (req, res) => {
      const result = await withCompanyTransaction(pool, currentCompanyId(), db =>
        updateConsumptionCatalog(db, operation, String(req.params.id || ''), req.body?.name));
      adoptCommittedDb(result.db);
      res.json({ success: true, items: result.value });
    });
  }

  // Update Rewards
  app.post('/api/rewards', requireCompanyEditor, async (req, res) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Lista de brindes inválida.' });
      }
      const companyId = currentCompanyId();
      const result = await pool.query(
        `UPDATE avaliacao_empresas
         SET dados=jsonb_set(COALESCE(dados,'{}'::jsonb), '{rewards}', $2::jsonb, true),
             atualizado_em=NOW()
         WHERE empresa_id=$1 AND ativo=TRUE
         RETURNING dados`,
        [companyId, JSON.stringify(req.body)]
      );
      if (!result.rows[0]?.dados) return res.status(404).json({ error: 'Empresa não encontrada.' });
      const current = tenantDbs.get(companyId)!;
      current.rewards = req.body;
      return res.json({ success: true, rewards: current.rewards });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar brindes.' });
    }
  });

  // Update Waiters
  app.post('/api/waiters', requireCompanyEditor, async (req, res) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Lista de garçons inválida.' });
      }
      const companyId = currentCompanyId();
      const result = await pool.query(
        `UPDATE avaliacao_empresas
         SET dados=jsonb_set(COALESCE(dados,'{}'::jsonb), '{waiters}', $2::jsonb, true),
             atualizado_em=NOW()
         WHERE empresa_id=$1 AND ativo=TRUE
         RETURNING dados`,
        [companyId, JSON.stringify(req.body)]
      );
      if (!result.rows[0]?.dados) return res.status(404).json({ error: 'Empresa não encontrada.' });
      const current = tenantDbs.get(companyId)!;
      current.waiters = req.body;
      return res.json({ success: true, waiters: current.waiters });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar garçons.' });
    }
  });

  // Full Database Sync Push (Saves rewards, waiters, settings, reviews atomically)
  app.post('/api/sync/push', requireCompanyEditor, async (req, res) => {
    const client = await pool.connect();
    try {
      const companyId = currentCompanyId();
      const { settings, rewards, waiters, reviews } = req.body || {};

      await client.query('BEGIN');
      const locked = await client.query(
        'SELECT dados FROM avaliacao_empresas WHERE empresa_id=$1 AND ativo=TRUE FOR UPDATE',
        [companyId]
      );
      if (!locked.rows[0]?.dados) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Empresa não encontrada.' });
      }

      const currentData = locked.rows[0].dados || {};
      const nextData = {
        ...currentData,
        settings:
          settings && typeof settings === 'object'
            ? { ...(currentData.settings || {}), ...settings, consumptionItems: currentData.settings?.consumptionItems || [] }
            : (currentData.settings || {}),
        rewards: Array.isArray(rewards) ? rewards : (Array.isArray(currentData.rewards) ? currentData.rewards : []),
        waiters: Array.isArray(waiters) ? waiters : (Array.isArray(currentData.waiters) ? currentData.waiters : []),
        // Reviews/voucher state only change through their dedicated server routes.
        reviews: Array.isArray(currentData.reviews) ? currentData.reviews : [],
      };

      const result = await client.query(
        `UPDATE avaliacao_empresas
         SET dados=$2::jsonb,
             nome=COALESCE(NULLIF($3,''), nome),
             atualizado_em=NOW()
         WHERE empresa_id=$1
         RETURNING dados`,
        [companyId, JSON.stringify(nextData), String(nextData.settings?.name || '').trim()]
      );
      await client.query('COMMIT');

      const persisted = result.rows[0].dados;
      tenantDbs.set(companyId, {
        settings: { ...DEFAULT_SETTINGS, ...(persisted.settings || {}) },
        rewards: Array.isArray(persisted.rewards) ? persisted.rewards : [],
        waiters: Array.isArray(persisted.waiters) ? persisted.waiters : [],
        reviews: Array.isArray(persisted.reviews) ? persisted.reviews : [],
        privacyRequests: Array.isArray(persisted.privacyRequests) ? persisted.privacyRequests : [],
      });

      return res.json({
        success: true,
        message: 'PostgreSQL atualizado com merge seguro.',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error('[Sync Push] Erro:', err);
      return res.status(500).json({ error: err?.message || 'Erro ao persistir banco de dados.' });
    } finally {
      client.release();
    }
  });

  function safeExportFilePart(value: unknown): string {
    return String(value || 'empresa').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'empresa';
  }

  function csvCell(value: unknown): string {
    if (value === undefined || value === null) return '""';
    return `"${String(value).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  }

  function reviewAverage(review: any): number {
    const ratings = review?.ratings || {};
    const values = [ratings.service, ratings.ambiance, ratings.products, ratings.waitTime].map((v) => Number(v || 0));
    return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  }

  // Export detalhado de avaliações. Disponível para qualquer usuário autenticado da empresa.
  app.get('/api/exports/reviews.csv', requireCompanyManager, (_req, res) => {
    const rows = Array.isArray(activeDb.reviews) ? activeDb.reviews : [];
    const headers = ['ID','Nome','Telefone','Mesa','Atendente','Nota Atendimento','Nota Ambiente','Nota Produtos','Nota Espera','Media Geral','Destaques','Critica','Sugestao','Brinde','Codigo Voucher','Resgatado','Aviso Privacidade','Versao Aviso','Aceitou Ofertas','Data Avaliacao','Data Resgate','Itens Consumidos'];
    const lines = rows.map((r: any) => [
      r.id, r.customerName || '', r.customerPhone || '', r.tableNumber || '', r.waiterName || '',
      r.ratings?.service ?? '', r.ratings?.ambiance ?? '', r.ratings?.products ?? '', r.ratings?.waitTime ?? '', reviewAverage(r).toFixed(2),
      Array.isArray(r.quickTags) ? r.quickTags.join(' | ') : '', r.criticism || '', r.suggestion || '', r.rewardTitle || '', r.rewardCode || '',
      r.rewardClaimed ? 'Sim' : 'Nao', r.privacyAcceptedAt || '', r.privacyNoticeVersion || '', r.marketingConsent ? 'Sim' : 'Nao', r.createdAt || '', r.claimedAt || '', (r.consumedItems || []).map((item: any) => item.name).join(' | ')
    ].map(csvCell).join(';'));
    const name = safeExportFilePart(activeDb.settings?.name || currentCompanyId());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="avaliacoes_${name}_${new Date().toISOString().slice(0,10)}.csv"`);
    return res.send('\uFEFFsep=;\n' + headers.map(csvCell).join(';') + '\n' + lines.join('\n'));
  });

  // Export do CRM consolidado: uma linha por telefone, com histórico resumido.
  app.get('/api/exports/customers.csv', requireCompanyManager, (_req, res) => {
    const reviews = Array.isArray(activeDb.reviews) ? [...activeDb.reviews] : [];
    reviews.sort((a: any, b: any) => new Date(String(a.createdAt || 0)).getTime() - new Date(String(b.createdAt || 0)).getTime());
    const grouped = new Map<string, any>();
    for (const r of reviews as any[]) {
      const phone = normalizeDashboardPhone(r.customerPhoneNormalized || r.customerPhone);
      const key = phone || `sem-telefone:${r.id}`;
      const current = grouped.get(key) || { phone: r.customerPhone || '', normalizedPhone: phone, name: r.customerName || '', count: 0, firstAt: r.createdAt || '', lastAt: r.createdAt || '', avgSum: 0, lastReward: '', lastRewardCode: '', lastClaimed: false, marketingConsent: false };
      current.count += 1;
      current.avgSum += reviewAverage(r);
      if (r.customerName) current.name = r.customerName;
      if (r.customerPhone) current.phone = r.customerPhone;
      current.lastAt = r.createdAt || current.lastAt;
      current.lastReward = r.rewardTitle || current.lastReward;
      current.lastRewardCode = r.rewardCode || current.lastRewardCode;
      current.lastClaimed = Boolean(r.rewardClaimed);
      current.marketingConsent = Boolean(r.marketingConsent);
      grouped.set(key, current);
    }
    const headers = ['Nome','Telefone','Telefone Normalizado','Total Avaliacoes','Primeira Avaliacao','Ultima Avaliacao','Media Geral','Ultimo Brinde','Ultimo Codigo','Ultimo Brinde Resgatado','Aceitou Ofertas'];
    const lines = [...grouped.values()].sort((a,b) => new Date(String(b.lastAt || 0)).getTime() - new Date(String(a.lastAt || 0)).getTime()).map((c: any) => [
      c.name, c.phone, c.normalizedPhone, c.count, c.firstAt, c.lastAt, (c.avgSum / Math.max(1,c.count)).toFixed(2), c.lastReward, c.lastRewardCode, c.lastClaimed ? 'Sim' : 'Nao', c.marketingConsent ? 'Sim' : 'Nao'
    ].map(csvCell).join(';'));
    const name = safeExportFilePart(activeDb.settings?.name || currentCompanyId());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="clientes_crm_${name}_${new Date().toISOString().slice(0,10)}.csv"`);
    return res.send('\uFEFFsep=;\n' + headers.map(csvCell).join(';') + '\n' + lines.join('\n'));
  });

  // Backup completo da empresa. Proprietário ou SuperAdmin.
  app.get('/api/database/export', requireCompanyOwner, async (_req, res) => {
    const companyId = currentCompanyId();
    const company = await pool.query('SELECT empresa_id,nome,slug,plano,status_assinatura,vencimento_em,criado_em,atualizado_em FROM avaliacao_empresas WHERE empresa_id=$1 LIMIT 1', [companyId]);
    const concreteDb = tenantDbs.get(companyId) || await loadCompanyDb(companyId);
    const payload = {
      format: 'avaliaeganha-company-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      company: company.rows[0] || { empresa_id: companyId, nome: concreteDb.settings?.name || companyId },
      data: concreteDb,
    };
    const name = safeExportFilePart(concreteDb.settings?.name || companyId);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="backup_${name}_${new Date().toISOString().slice(0,10)}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  });

  // Restaura backup v2 ou o formato JSON legado.
  app.post('/api/database/import', requireCompanyOwner, async (req, res) => {
    try {
      const wrapper = req.body;
      const companyId = currentCompanyId();
      if (wrapper?.format === 'avaliaeganha-company-backup' && wrapper?.company?.empresa_id && normalizeCompanyId(wrapper.company.empresa_id) !== companyId) {
        return res.status(409).json({ error: `Este backup pertence à empresa ${wrapper.company.empresa_id} e não pode ser restaurado em ${companyId}.` });
      }
      const data = wrapper?.format === 'avaliaeganha-company-backup' ? wrapper.data : wrapper;
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Arquivo de backup inválido.' });
      if (!data.settings || typeof data.settings !== 'object') return res.status(400).json({ error: 'O backup não contém configurações válidas.' });
      if (!Array.isArray(data.reviews) || !Array.isArray(data.rewards) || !Array.isArray(data.waiters)) return res.status(400).json({ error: 'O backup está incompleto ou em formato incompatível.' });
      const restoredDb: RestaurantDb = {
        settings: { ...DEFAULT_SETTINGS, ...data.settings },
        rewards: data.rewards,
        waiters: data.waiters,
        reviews: data.reviews,
        privacyRequests: Array.isArray(data.privacyRequests) ? data.privacyRequests : [],
      };
      await saveDbToPostgres(restoredDb, companyId);
      adoptCommittedDb(restoredDb);
      return res.json({ success: true, message: 'Backup restaurado com sucesso.', db: restoredDb });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao restaurar backup.' });
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
      companyId: currentCompanyId(),
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

    recordDispatch(record);

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
      }
    }

    if (hasChanges) {
      await saveDb(activeDb);
    }

    return { sent5DaysCount, sent1DayCount };
  }

  // Background WhatsApp Send API (Sends without opening WhatsApp on customer's device)
  app.post('/api/send-whatsapp', requireCompanyEditor, async (req, res) => {
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
  app.post('/api/notifications/expiring', requireCompanyEditor, async (req, res) => {
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
  app.post('/api/test-whatsapp', requireCompanyEditor, async (req, res) => {
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
  app.get('/api/whatsapp-dispatches', requireCompanyManager, (_req, res) => {
    res.json({
      configuredGateway: Boolean(process.env.WHATSAPP_API_URL),
      dispatches: tenantDispatches(recentDispatches, currentCompanyId()),
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
            const msgId = msg?.id ? `${currentCompanyId()}:${msg.id}` : null;
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
              await saveDb(activeDb);

              const record: WhatsAppDispatch = {
      companyId: currentCompanyId(),
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
              recordDispatch(record);
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

  // Automated background interval to check and notify expiring vouchers (5 days and 1 day).
  // IMPORTANT: run once per loaded company inside its tenant context. Running this
  // outside tenantContext would silently use the fallback `demo` tenant.
  const runExpirationChecksForAllCompanies = async () => {
    const companyIds = Array.from(tenantDbs.keys());
    for (const companyId of companyIds) {
      try {
        await tenantContext.run({ companyId }, async () => {
          const context = tenantContext.getStore()!;
          context.db = clone(await loadCompanyDb(companyId));
          context.baseDb = clone(context.db);
          await checkAndSendExpiringNotifications(true);
        });
      } catch (e) {
        console.warn(`[Auto Expiration Check] ${companyId}:`, e);
      }
    }
  };

  setTimeout(() => {
    runExpirationChecksForAllCompanies().catch((e) => console.warn('[Auto Expiration Check] Notice:', e));
  }, 10000);

  setInterval(() => {
    runExpirationChecksForAllCompanies().catch((e) => console.warn('[Auto Expiration Check] Notice:', e));
  }, 30 * 60 * 1000);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    if (err instanceof CommerceError) {
      if (err.status === 429) res.setHeader('Retry-After', '600');
      return res.status(err.status).json({ success: false, error: err.message, code: err.code });
    }
    console.error('[API] Operação não confirmada:', err);
    return res.status(503).json({ success: false, error: 'Não foi possível confirmar a operação. Tente novamente.', code: 'PERSISTENCE_UNAVAILABLE' });
  });
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
