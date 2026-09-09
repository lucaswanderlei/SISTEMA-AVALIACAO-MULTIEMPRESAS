import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';
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
import express from 'express';

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
  whatsappTemplateName: 'avaliacao_brinde',
  whatsappTemplateLanguage: 'pt_BR',
  whatsappWebhookVerifyToken: 'srcoxita_webhook_2026',
};

const DEFAULT_REWARDS = [
  { id: 'reward-1', title: 'PORÇÃO DE BATATA FRITA', description: 'Batata frita crocante por fora e macia por dentro, servida quentinha.', iconName: 'UtensilsCrossed', category: 'appetizer', enabled: true, probabilityWeight: 45 },
  { id: 'reward-2', title: 'CHURROS MIX TRADICIONAL', description: 'Mini churros crocantes recheados, polvilhados no açúcar com canela.', iconName: 'Cake', category: 'dessert', enabled: true, probabilityWeight: 45 },
  { id: 'reward-3', title: '10 % DE DESCONTO', description: '10% de desconto no valor total da sua comanda no Sr. Coxita.', iconName: 'Percent', category: 'discount', enabled: true, probabilityWeight: 5 },
  { id: 'reward-4', title: '5% DE DESCONTO', description: '5% de desconto no valor total da sua comanda no Sr. Coxita.', iconName: 'Percent', category: 'discount', enabled: true, probabilityWeight: 5 },
];

const DEFAULT_WAITERS = [
  { id: 'waiter-1', name: 'Carlos Oliveira', nickname: 'Carlinhos', badgeNumber: '01', role: 'Garçom', active: true, createdAt: new Date().toISOString() },
  { id: 'waiter-2', name: 'Mariana Santos', nickname: 'Mari', badgeNumber: '04', role: 'Garçonete', active: true, createdAt: new Date().toISOString() },
  { id: 'waiter-3', name: 'Lucas Pereira', nickname: 'Luquinhas', badgeNumber: '07', role: 'Garçom', active: true, createdAt: new Date().toISOString() },
  { id: 'waiter-4', name: 'Juliana Costa', nickname: 'Ju', badgeNumber: '11', role: 'Atendente', active: true, createdAt: new Date().toISOString() },
  { id: 'waiter-5', name: 'Marcos Souza', nickname: 'Marquinhos', badgeNumber: '15', role: 'Cumim', active: false, createdAt: new Date().toISOString() },
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
  return { settings: DEFAULT_SETTINGS, rewards: DEFAULT_REWARDS, waiters: DEFAULT_WAITERS, reviews: [] };
}

function saveDb(db: RestaurantDb): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const content = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_FILE, content, 'utf-8');
    try { fs.writeFileSync(DB_BACKUP_FILE, content, 'utf-8'); } catch {}
  } catch (err) {
    console.error('Error writing DB_FILE:', err);
  }
}

let activeDb = loadDb();
if (!fs.existsSync(DB_FILE)) saveDb(activeDb);

async function syncFirestoreToActiveDb(): Promise<void> {
  try {
    const snap = await getDocs(collection(firestoreDb, 'reviews'));
    if (snap && snap.size > 0) {
      const fsReviews: any[] = [];
      snap.forEach((d) => { const data = d.data(); if (data && data.id) fsReviews.push(data); });
      const reviewMap = new Map<string, any>();
      activeDb.reviews.forEach((r: any) => reviewMap.set(r.id, r));
      fsReviews.forEach((r: any) => reviewMap.set(r.id, r));
      activeDb.reviews = Array.from(reviewMap.values()).sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      saveDb(activeDb);
      console.log(`[Firestore Sync] ${fsReviews.length} avaliações sincronizadas!`);
    }
  } catch (err) {
    console.warn('[Firestore Sync] Aviso:', err);
  }
}

function normalizePhoneForWhatsApp(phone: string): string {
  let digits = String(phone || '').replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2).replace(/^0+/, '');
  }
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    if (/^[6-9]/.test(num)) digits = `${ddd}9${num}`;
  }
  return `55${digits}`;
}

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

function buildOfficialVoucherMessage(opts: any): string {
  const firstName = opts.customerName ? opts.customerName.trim().split(' ')[0] : 'Cliente';
  const availDate = opts.availableFrom ? new Date(opts.availableFrom).toLocaleDateString('pt-BR') : 'amanhã';
  const expDate = opts.expiresAt ? new Date(opts.expiresAt).toLocaleDateString('pt-BR') : 'em 15 dias';
  return (
    `*VOUCHER DE CORTESIA - ${(opts.restaurantName || 'Sr. Coxita').toUpperCase()}* 🥟✨\n\n` +
    `Olá ${firstName}! Aqui estão os detalhes do seu brinde conquistado na avaliação:\n\n` +
    `🎁 *Brinde:* ${opts.rewardTitle || 'Cortesia especial'}\n` +
    `🎟️ *Código de Resgate:* ${opts.rewardCode || ''}\n` +
    `📅 *Prazo de Início:* Liberado para resgate a partir de ${availDate} (24h após o sorteio)\n` +
    `⏳ *Prazo para Expirar:* Válido até ${expDate} (15 dias de validade)\n` +
    `⚠️ *Regra Importante:* Só é válido utilizar 1 cortesia/brinde por mesa!\n\n` +
    `Apresente este voucher ao garçom no ${opts.restaurantName || 'Sr. Coxita'} durante sua próxima visita. Esperamos você! 💛`
  );
}

function buildExpiring5DaysMessage(opts: any): string {
  const firstName = opts.customerName ? opts.customerName.trim().split(' ')[0] : 'Cliente';
  const formattedExpDate = opts.expiresAt ? new Date(opts.expiresAt).toLocaleDateString('pt-BR') : 'em 5 dias';
  const daysStr = opts.daysLeft === 5 ? '5 DIAS' : `${opts.daysLeft} dias`;
  return (
    `*LEMBRETE DE CORTESIA - ${(opts.restaurantName || 'Sr. Coxita').toUpperCase()}* 🥟⏳\n\n` +
    `Olá ${firstName}! Tudo bem? Passando para te avisar com carinho que o seu brinde exclusivo da roleta (*${opts.rewardTitle || 'Cortesia especial'}*, código: *${opts.rewardCode || ''}*) VAI EXPIRAR EM ${daysStr}!\n\n` +
    `📅 *Prazo Limite:* Válido até ${formattedExpDate} (restam ${opts.daysLeft} dias).\n` +
    `🎟️ *Código de Resgate:* ${opts.rewardCode || ''}\n` +
    `⚠️ *Regra:* Válido 1 cortesia por mesa.\n\n` +
    `Não deixe sua cortesia vencer! Venha nos visitar esta semana e saboreie seu presente no ${opts.restaurantName || 'Sr. Coxita'}. Esperamos você com muito carinho! 💛`
  );
}

function buildExpiring1DayMessage(opts: any): string {
  const firstName = opts.customerName ? opts.customerName.trim().split(' ')[0] : 'Cliente';
  const formattedExpDate = opts.expiresAt ? new Date(opts.expiresAt).toLocaleDateString('pt-BR') : 'amanhã';
  return (
    `🚨 *ÚLTIMA CHANCE: SEU BRINDE EXPIRA AMANHÃ!* 🥟🔥\n\n` +
    `Olá ${firstName}! Aqui é do ${opts.restaurantName || 'Sr. Coxita'}.\n\n` +
    `⚠️ O prazo de 15 dias para resgate do seu brinde exclusivo (*${opts.rewardTitle || 'Cortesia especial'}*, código: *${opts.rewardCode || ''}*) VENCE AMANHÃ (${formattedExpDate})!\n\n` +
    `⏰ Amanhã é o ÚLTIMO DIA para resgatar seu presente antes que o código seja cancelado automaticamente pelo sistema.\n` +
    `🎟️ *Código de Resgate:* ${opts.rewardCode || ''}\n` +
    `⚠️ *Regra:* Válido 1 cortesia por mesa.\n\n` +
    `Apresente este código ao garçom amanhã no restaurante e garanta sua cortesia especial. Te esperamos! 💛`
  );
}

interface WhatsAppDispatch {
  id: string; phone: string; customerName: string; rewardTitle: string;
  rewardCode: string; restaurantName: string; timestamp: string;
  status: 'sent' | 'delivered' | 'failed'; gateway: string; error?: string; usedTemplateFallback?: boolean;
}
const recentDispatches: WhatsAppDispatch[] = [];

const processedWebhookIds = new Set<string>();
const MAX_WEBHOOK_CACHE = 500;

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
  const templatePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneWithDDI,
    type: 'template',
    template: templateData,
  };
  const externalRes = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(templatePayload) });
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

function buildBrindeTemplateComponents(customerName: string): any[] {
  const firstName = customerName ? customerName.trim().split(' ')[0] : 'Cliente';
  return [
    {
      type: 'body',
      parameters: [{ type: 'text', text: firstName }],
    },
  ];
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
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneWithDDI,
    type: 'text',
    text: { preview_url: false, body: message },
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

async function executeWhatsAppSend(opts: any) {
  const phoneWithDDI = normalizePhoneForWhatsApp(opts.phone);
  const effectiveApiUrl = opts.apiUrl || activeDb.settings.whatsappApiUrl || process.env.WHATSAPP_API_URL;
  const effectiveApiToken = opts.apiToken || activeDb.settings.whatsappApiToken || process.env.WHATSAPP_API_TOKEN;
  const templateName = activeDb.settings.whatsappTemplateName || 'avaliacao_brinde';
  const templateLanguage = activeDb.settings.whatsappTemplateLanguage || 'pt_BR';
  const hasRealGateway = Boolean(effectiveApiUrl && effectiveApiUrl.trim().length > 5);
  let deliveryStatus: 'sent' | 'delivered' | 'failed' = hasRealGateway ? 'sent' : 'failed';
  let gatewayUsed = effectiveApiUrl || 'Nenhum Gateway Conectado';
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
        throw new Error(`Você colocou o número de telefone (+${idSegment}) na URL da Meta. A Meta exige a 'Identificação do número de telefone' (código numérico de 15 a 16 dígitos).`);
      }

      if (opts.templateMode === 'brinde_template') {
        // Send the avaliacao_brinde template with customer first name as parameter
        const components = buildBrindeTemplateComponents(opts.customerName || '');
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
        // Default: send free-text message
        const message = cleanWhatsAppMessage(opts.message);
        const textResult = await sendFreeTextMessage(effectiveApiUrl, effectiveApiToken, phoneWithDDI, message);
        if (textResult.ok) {
          deliveryStatus = 'delivered';
        } else {
          // Fallback: if 24h window is closed (131047), retry with template
          if (textResult.metaCode === 131047 && templateName) {
            const components = buildBrindeTemplateComponents(opts.customerName || '');
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
      errorMessage = err?.message || 'Erro de conexão com o Gateway';
      deliveryStatus = 'failed';
    }
  } else {
    errorMessage = 'Nenhum Gateway de WhatsApp configurado.';
  }

  const record: WhatsAppDispatch = {
    id: `disp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    phone: phoneWithDDI, customerName: opts.customerName || 'Cliente',
    rewardTitle: opts.rewardTitle || 'Cortesia', rewardCode: opts.rewardCode || '',
    restaurantName: opts.restaurantName || 'Sr. Coxita',
    timestamp: new Date().toISOString(), status: deliveryStatus,
    gateway: gatewayUsed, error: errorMessage, usedTemplateFallback,
  };
  recentDispatches.unshift(record);
  if (recentDispatches.length > 50) recentDispatches.pop();

  return {
    success: deliveryStatus === 'delivered', hasRealGateway,
    status: deliveryStatus, dispatch: record, error: errorMessage,
    message: hasRealGateway && deliveryStatus === 'delivered'
      ? usedTemplateFallback
        ? `Template "${templateName}" enviado para +${phoneWithDDI}. Aguardando resposta SIM do cliente.`
        : `Voucher oficial enviado com sucesso para +${phoneWithDDI}!`
      : hasRealGateway ? `Falha ao transmitir: ${errorMessage}`
      : `Lembrete registrado. Conecte a URL da sua API de WhatsApp no Painel.`,
  };
}

async function checkAndSendExpiringNotifications(autoSend = true, targetReviewId?: string, forceType?: '5_days' | '1_day') {
  const validityDays = activeDb.settings.rewardValidityDays || 15;
  const validityMs = validityDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let hasChanges = false;

  for (const rev of activeDb.reviews) {
    if (targetReviewId && rev.id !== targetReviewId) continue;
    if (rev.rewardClaimed) continue;
    if (!rev.customerPhone || rev.customerPhone.trim().length < 8) continue;
    const expiryTime = rev.expiresAt ? new Date(rev.expiresAt).getTime() : new Date(rev.createdAt).getTime() + validityMs;
    const diffMs = expiryTime - now;
    if (diffMs <= 0) continue;
    const daysLeft = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

    if ((daysLeft <= 1 || forceType === '1_day') && (forceType === '1_day' || !rev.notified1DayAt)) {
      if (!forceType && daysLeft > 1) continue;
      const msg = buildExpiring1DayMessage({ customerName: rev.customerName, rewardTitle: rev.rewardTitle, rewardCode: rev.rewardCode, restaurantName: activeDb.settings.name, expiresAt: rev.expiresAt });
      if (autoSend) await executeWhatsAppSend({ phone: rev.customerPhone, message: msg, customerName: rev.customerName, rewardTitle: rev.rewardTitle, rewardCode: rev.rewardCode, restaurantName: activeDb.settings.name });
      rev.notified1DayAt = new Date().toISOString();
      hasChanges = true;
      try { await setDoc(doc(firestoreDb, 'reviews', rev.id), { notified1DayAt: rev.notified1DayAt }, { merge: true }); } catch {}
    } else if ((daysLeft <= 5 || forceType === '5_days') && (forceType === '5_days' || !rev.notified5DaysAt)) {
      if (!forceType && daysLeft <= 1) continue;
      const msg = buildExpiring5DaysMessage({ customerName: rev.customerName, rewardTitle: rev.rewardTitle, rewardCode: rev.rewardCode, restaurantName: activeDb.settings.name, expiresAt: rev.expiresAt, daysLeft });
      if (autoSend) await executeWhatsAppSend({ phone: rev.customerPhone, message: msg, customerName: rev.customerName, rewardTitle: rev.rewardTitle, rewardCode: rev.rewardCode, restaurantName: activeDb.settings.name });
      rev.notified5DaysAt = new Date().toISOString();
      hasChanges = true;
      try { await setDoc(doc(firestoreDb, 'reviews', rev.id), { notified5DaysAt: rev.notified5DaysAt }, { merge: true }); } catch {}
    }
  }
  if (hasChanges) saveDb(activeDb);
}

function apiPlugin(): Plugin {
  const apiApp = express();
  apiApp.use(express.json());

  apiApp.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  apiApp.get('/api/sync', async (_req, res) => {
    if (activeDb.reviews.length === 0) await syncFirestoreToActiveDb();
    res.json({ settings: activeDb.settings, rewards: activeDb.rewards, waiters: activeDb.waiters, reviews: activeDb.reviews, serverTime: new Date().toISOString() });
  });

  apiApp.get('/api/reviews', async (_req, res) => {
    if (activeDb.reviews.length === 0) await syncFirestoreToActiveDb();
    res.json({ reviews: activeDb.reviews, total: activeDb.reviews.length, serverTime: new Date().toISOString() });
  });

  apiApp.post('/api/reviews', async (req, res) => {
    try {
      const review = req.body;
      if (!review || !review.id) return res.status(400).json({ error: 'Dados da avaliação inválidos.' });
      const existingIdx = activeDb.reviews.findIndex((r: any) => r.id === review.id);
      if (existingIdx >= 0) activeDb.reviews[existingIdx] = { ...activeDb.reviews[existingIdx], ...review };
      else activeDb.reviews.unshift(review);
      saveDb(activeDb);
      try { await setDoc(doc(firestoreDb, 'reviews', review.id), sanitizeObj(review), { merge: true }); } catch {}
      return res.json({ success: true, review, reviews: activeDb.reviews });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/reviews/validate', async (req, res) => {
    try {
      const { code, tableNumber } = req.body;
      if (!code) return res.status(400).json({ error: 'Código do voucher é obrigatório.' });
      const cleanCode = String(code).trim().toUpperCase();
      const review = activeDb.reviews.find((r: any) => String(r.rewardCode || '').trim().toUpperCase() === cleanCode);
      if (!review) return res.status(404).json({ error: `Voucher "${cleanCode}" não localizado.` });
      if (review.rewardClaimed) return res.status(400).json({ error: 'Este brinde já foi resgatado.', review });
      review.rewardClaimed = true;
      review.claimedAt = new Date().toISOString();
      if (tableNumber) review.claimedTable = tableNumber;
      saveDb(activeDb);
      try { await setDoc(doc(firestoreDb, 'reviews', review.id), { rewardClaimed: true, claimedAt: review.claimedAt, claimedTable: review.claimedTable || null }, { merge: true }); } catch {}
      return res.json({ success: true, review, reviews: activeDb.reviews });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.delete('/api/reviews/:id', async (req, res) => {
    try {
      const { id } = req.params;
      activeDb.reviews = activeDb.reviews.filter((r: any) => r.id !== id);
      saveDb(activeDb);
      try { await deleteDoc(doc(firestoreDb, 'reviews', id)); } catch {}
      return res.json({ success: true, deletedId: id, remaining: activeDb.reviews.length, reviews: activeDb.reviews });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.delete('/api/reviews', async (_req, res) => {
    try {
      activeDb.reviews = [];
      saveDb(activeDb);
      try { const snap = await getDocs(collection(firestoreDb, 'reviews')); const dp: Promise<any>[] = []; snap.forEach((d) => dp.push(deleteDoc(d.ref))); await Promise.all(dp); } catch {}
      return res.json({ success: true, reviews: [] });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/settings', (req, res) => {
    try { activeDb.settings = { ...activeDb.settings, ...req.body }; saveDb(activeDb); return res.json({ success: true, settings: activeDb.settings }); }
    catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/settings/pin', (req, res) => {
    try {
      const { pin } = req.body || {};
      if (!pin || typeof pin !== 'string' || pin.trim().length < 3) return res.status(400).json({ error: 'PIN inválido.' });
      activeDb.settings.managerPin = pin.trim();
      saveDb(activeDb);
      return res.json({ success: true, managerPin: pin.trim() });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/settings/whatsapp', (req, res) => {
    try {
      const { whatsappApiUrl, whatsappApiToken, whatsappCustomMessage, autoSendWhatsApp, autoSendMode } = req.body || {};
      if (whatsappApiUrl !== undefined) {
        const cleanUrl = String(whatsappApiUrl || '').trim();
        if (cleanUrl && !cleanUrl.includes('SEU_PHONE_NUMBER_ID')) activeDb.settings.whatsappApiUrl = cleanUrl;
        else if (!activeDb.settings.whatsappApiUrl) activeDb.settings.whatsappApiUrl = 'https://graph.facebook.com/v20.0/1295064457026684/messages';
      }
      if (whatsappApiToken !== undefined) {
        const cleanToken = String(whatsappApiToken || '').trim();
        if (cleanToken) activeDb.settings.whatsappApiToken = cleanToken;
      }
      if (whatsappCustomMessage !== undefined) activeDb.settings.whatsappCustomMessage = String(whatsappCustomMessage || '').trim();
      if (req.body.whatsappTemplateName !== undefined) activeDb.settings.whatsappTemplateName = String(req.body.whatsappTemplateName || '').trim();
      if (req.body.whatsappTemplateLanguage !== undefined) activeDb.settings.whatsappTemplateLanguage = String(req.body.whatsappTemplateLanguage || '').trim();
      if (autoSendWhatsApp !== undefined) activeDb.settings.autoSendWhatsApp = Boolean(autoSendWhatsApp);
      if (autoSendMode !== undefined) activeDb.settings.autoSendMode = autoSendMode;
      saveDb(activeDb);
      return res.json({ success: true, settings: activeDb.settings });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/rewards', (req, res) => {
    try { if (Array.isArray(req.body)) { activeDb.rewards = req.body; saveDb(activeDb); } return res.json({ success: true, rewards: activeDb.rewards }); }
    catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/waiters', (req, res) => {
    try { if (Array.isArray(req.body)) { activeDb.waiters = req.body; saveDb(activeDb); } return res.json({ success: true, waiters: activeDb.waiters }); }
    catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/sync/push', (req, res) => {
    try {
      const { settings, rewards, waiters, reviews } = req.body || {};
      let changed = false;
      if (settings && typeof settings === 'object') {
        const safeSettings = { ...settings };
        if (!safeSettings.whatsappApiUrl || safeSettings.whatsappApiUrl.includes('SEU_PHONE_NUMBER_ID'))
          safeSettings.whatsappApiUrl = activeDb.settings.whatsappApiUrl || 'https://graph.facebook.com/v20.0/1295064457026684/messages';
        if (!safeSettings.whatsappApiToken && activeDb.settings.whatsappApiToken) safeSettings.whatsappApiToken = activeDb.settings.whatsappApiToken;
        activeDb.settings = { ...activeDb.settings, ...safeSettings };
        changed = true;
      }
      if (Array.isArray(rewards) && rewards.length > 0) { activeDb.rewards = rewards; changed = true; }
      if (Array.isArray(waiters) && waiters.length > 0) { activeDb.waiters = waiters; changed = true; }
      if (Array.isArray(reviews)) { activeDb.reviews = [...reviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); changed = true; }
      if (changed) saveDb(activeDb);
      return res.json({ success: true, message: 'Banco sincronizado.', counts: { rewards: activeDb.rewards.length, waiters: activeDb.waiters.length, reviews: activeDb.reviews.length }, timestamp: new Date().toISOString() });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.get('/api/database/export', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="banco_restaurante_backup.json"');
    return res.send(JSON.stringify(activeDb, null, 2));
  });

  apiApp.post('/api/database/import', (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Arquivo inválido.' });
      if (data.settings && typeof data.settings === 'object') activeDb.settings = { ...activeDb.settings, ...data.settings };
      if (Array.isArray(data.rewards)) activeDb.rewards = data.rewards;
      if (Array.isArray(data.waiters)) activeDb.waiters = data.waiters;
      if (Array.isArray(data.reviews)) activeDb.reviews = data.reviews;
      saveDb(activeDb);
      return res.json({ success: true, db: activeDb });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/send-whatsapp', async (req, res) => {
    try {
      const { phone, customerName, rewardTitle, rewardCode, message: incomingMessage, restaurantName, availableFrom, expiresAt, apiUrl, apiToken, templateMode } = req.body;
      if (!phone) return res.status(400).json({ error: 'Número é obrigatório.' });
      const sendResult = await executeWhatsAppSend({
        phone, customerName, rewardTitle, rewardCode, restaurantName, apiUrl, apiToken,
        templateMode: templateMode || 'brinde_template',
        message: incomingMessage || buildOfficialVoucherMessage({ customerName, rewardTitle, rewardCode, restaurantName, availableFrom, expiresAt }),
      });
      if (!sendResult.success) return res.status(400).json(sendResult);
      return res.json(sendResult);
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  // WhatsApp Cloud API webhook verification (GET) and message receiver (POST)
  apiApp.get('/api/whatsapp-webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = activeDb.settings.whatsappWebhookVerifyToken || 'srcoxita_webhook_2026';
    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  apiApp.post('/api/whatsapp-webhook', async (req, res) => {
    // Always return 200 quickly to Meta to avoid retries
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

            // Dedup: skip if we already processed this webhook message ID
            if (processedWebhookIds.has(msgId)) continue;
            processedWebhookIds.add(msgId);
            if (processedWebhookIds.size > MAX_WEBHOOK_CACHE) {
              const firstId = processedWebhookIds.values().next().value;
              if (firstId) processedWebhookIds.delete(firstId);
            }

            // Only process text messages
            if (msg.type !== 'text') continue;
            const textBody = (msg.text?.body || '').trim();
            const fromPhone = msg.from;
            if (!textBody || !fromPhone) continue;

            // Check if the message is "SIM" (case-insensitive, trimmed)
            const isSim = /^\s*sim\s*$/i.test(textBody);
            if (!isSim) continue;

            // Normalize the sender phone
            const normalizedPhone = normalizePhoneForWhatsApp(fromPhone);

            // Find the most recent review for this phone that hasn't had its reward sent via WhatsApp yet
            const review = activeDb.reviews.find(
              (r: any) => normalizePhoneForWhatsApp(r.customerPhone || '') === normalizedPhone
                && !r.rewardSentViaWhatsapp
            );
            if (!review) continue;

            // Build the reward message with the existing prize (no new raffle)
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

            // Now the 24h window is open (customer just sent a message), send free-text
            const sendResult = await sendFreeTextMessage(effectiveApiUrl, effectiveApiToken, normalizedPhone, rewardMsg);
            if (sendResult.ok) {
              review.rewardSentViaWhatsapp = true;
              review.whatsappStatus = 'delivered';
              review.whatsappSentAt = new Date().toISOString();
              saveDb(activeDb);
              try { await setDoc(doc(firestoreDb, 'reviews', review.id), {
                rewardSentViaWhatsapp: true,
                whatsappStatus: 'delivered',
                whatsappSentAt: review.whatsappSentAt,
              }, { merge: true }); } catch {}

              const record: WhatsAppDispatch = {
                id: `disp_webhook_${Date.now()}`, phone: normalizedPhone,
                customerName: review.customerName || 'Cliente',
                rewardTitle: review.rewardTitle || 'Cortesia', rewardCode: review.rewardCode || '',
                restaurantName: activeDb.settings.name,
                timestamp: new Date().toISOString(), status: 'delivered',
                gateway: effectiveApiUrl, usedTemplateFallback: false,
              };
              recentDispatches.unshift(record);
              if (recentDispatches.length > 50) recentDispatches.pop();
            } else {
              console.warn('[Webhook] Falha ao enviar brinde após SIM:', sendResult.error);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Webhook] Erro ao processar mensagem:', err);
    }
  });

  apiApp.post('/api/notifications/expiring', async (req, res) => {
    try {
      const { reviewId, type } = req.body;
      await checkAndSendExpiringNotifications(true, reviewId, type);
      return res.json({ success: true, message: 'Notificações processadas.', reviews: activeDb.reviews });
    } catch (err: any) { return res.status(500).json({ error: err?.message }); }
  });

  apiApp.post('/api/test-whatsapp', async (req, res) => {
    try {
      const { phone, apiUrl, apiToken, message, template, templateLanguage } = req.body;
      if (!phone) return res.status(400).json({ error: 'Informe um número.' });
      const effectiveApiUrl = (apiUrl || activeDb.settings.whatsappApiUrl || '').trim();
      const effectiveApiToken = (apiToken || activeDb.settings.whatsappApiToken || '').trim();
      if (!effectiveApiUrl || effectiveApiUrl.length < 5) return res.status(400).json({ error: 'URL do Gateway não informada.' });
      const phoneWithDDI = normalizePhoneForWhatsApp(phone);
      const rawMsg = message || buildOfficialVoucherMessage({ customerName: 'Cliente VIP', rewardTitle: 'PORÇÃO DE BATATA FRITA', rewardCode: 'BRINDE-OFICIAL', restaurantName: 'Sr. Coxita', availableFrom: new Date().toISOString(), expiresAt: new Date(Date.now() + 15 * 86400000).toISOString() });
      const testMsg = cleanWhatsAppMessage(rawMsg);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (effectiveApiToken) { headers['Authorization'] = `Bearer ${effectiveApiToken}`; headers['apikey'] = effectiveApiToken; headers['Client-Token'] = effectiveApiToken; }
      let payload: Record<string, any>;
      if (effectiveApiUrl.includes('graph.facebook.com')) {
        if (template) payload = { messaging_product: 'whatsapp', to: phoneWithDDI, type: 'template', template: { name: template, language: { code: templateLanguage || 'en_US' } } };
        else payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to: phoneWithDDI, type: 'text', text: { preview_url: false, body: testMsg } };
      } else {
        return res.status(400).json({ success: false, error: 'Apenas a Meta Cloud API (graph.facebook.com) é suportada. Verifique a URL configurada.' });
      }
      const externalRes = await fetch(effectiveApiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
      const resText = await externalRes.text().catch(() => '');
      let resJson; try { resJson = JSON.parse(resText); } catch { resJson = resText; }
      if (externalRes.ok) return res.json({ success: true, status: externalRes.status, data: resJson, message: template ? `Template enviado para +${phoneWithDDI}!` : `Mensagem enviada para +${phoneWithDDI}!` });
      return res.status(400).json({ success: false, status: externalRes.status, data: resJson, error: `Gateway retornou HTTP ${externalRes.status}.` });
    } catch (err: any) { return res.status(500).json({ success: false, error: err?.message }); }
  });

  apiApp.get('/api/whatsapp-dispatches', (_req, res) => {
    res.json({ configuredGateway: Boolean(process.env.WHATSAPP_API_URL), dispatches: recentDispatches });
  });

  return {
    name: 'api-server',
    configureServer(server) {
      server.middlewares.use(apiApp);
      syncFirestoreToActiveDb().catch(() => {});
      setTimeout(() => { checkAndSendExpiringNotifications(true).catch((e) => console.warn('[Auto Expiration]', e)); }, 10000);
      setInterval(() => { checkAndSendExpiringNotifications(true).catch((e) => console.warn('[Auto Expiration]', e)); }, 30 * 60 * 1000);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
