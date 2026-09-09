import { getCompanyId } from './tenant';
import { RestaurantSettings, RewardOption, Review, Waiter } from '../types';


function tenantFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('X-Company-Id', getCompanyId());
  return fetch(input, { ...init, headers });
}

export interface SyncDataResponse {
  settings: RestaurantSettings;
  rewards: RewardOption[];
  waiters: Waiter[];
  reviews: Review[];
  serverTime: string;
}

// Fetch all sync data from server
export async function apiFetchSync(): Promise<SyncDataResponse | null> {
  try {
    const res = await tenantFetch('/api/sync', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Sync API] Could not fetch sync data from server, using local cache:', err);
    return null;
  }
}

// Fetch latest reviews from server (for polling)
export async function apiFetchReviews(): Promise<Review[] | null> {
  try {
    const res = await tenantFetch('/api/reviews', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.reviews || [];
  } catch (err) {
    console.warn('[Sync API] Could not poll reviews from server:', err);
    return null;
  }
}

// Submit a new customer review to the central server
export async function apiSubmitReview(review: Review): Promise<{ success: boolean; review?: Review; error?: string }> {
  try {
    const res = await tenantFetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao enviar avaliação' }));
      return { success: false, error: err.error };
    }
    const data = await res.json();
    return { success: true, review: data.review };
  } catch (err: any) {
    console.error('[Sync API] Error submitting review to server:', err);
    return { success: false, error: err?.message || 'Falha de conexão com o servidor' };
  }
}

// Validate / Claim a reward voucher on the central server
export async function apiValidateReward(code: string, tableNumber?: number): Promise<{ success: boolean; review?: Review; error?: string }> {
  try {
    const res = await tenantFetch('/api/reviews/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, tableNumber }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao validar voucher' }));
      return { success: false, error: err.error };
    }
    const data = await res.json();
    return { success: true, review: data.review };
  } catch (err: any) {
    console.error('[Sync API] Error validating reward on server:', err);
    return { success: false, error: err?.message || 'Falha de conexão com o servidor' };
  }
}

// Sync settings to server
export async function apiSaveSettings(settings: RestaurantSettings): Promise<boolean> {
  try {
    const res = await tenantFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.ok;
  } catch (err) {
    console.error('[Sync API] Error saving settings to server:', err);
    return false;
  }
}

// Update PIN directly on server
export async function apiUpdatePin(pin: string): Promise<boolean> {
  try {
    const res = await tenantFetch('/api/settings/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return res.ok;
  } catch (err) {
    console.error('[Sync API] Error updating PIN on server:', err);
    return false;
  }
}

// Update WhatsApp API credentials directly on server
export async function apiSaveWhatsAppSettings(whatsappData: {
  whatsappApiUrl?: string;
  whatsappApiToken?: string;
  whatsappCustomMessage?: string;
  autoSendWhatsApp?: boolean;
  autoSendMode?: 'silent_api' | 'auto_open' | 'open_app';
}): Promise<boolean> {
  try {
    const res = await tenantFetch('/api/settings/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(whatsappData),
    });
    return res.ok;
  } catch (err) {
    console.error('[Sync API] Error updating WhatsApp API settings on server:', err);
    return false;
  }
}

// Sync rewards to server
export async function apiSaveRewards(rewards: RewardOption[]): Promise<boolean> {
  try {
    const res = await tenantFetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rewards),
    });
    return res.ok;
  } catch (err) {
    console.error('[Sync API] Error saving rewards to server:', err);
    return false;
  }
}

// Sync waiters to server
export async function apiSaveWaiters(waiters: Waiter[]): Promise<boolean> {
  try {
    const res = await tenantFetch('/api/waiters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(waiters),
    });
    return res.ok;
  } catch (err) {
    console.error('[Sync API] Error saving waiters to server:', err);
    return false;
  }
}

// Delete a single review on server
export async function apiDeleteReview(id: string): Promise<{ success: boolean; reviews?: Review[] }> {
  try {
    const res = await tenantFetch(`/api/reviews/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      return { success: false };
    }
    const data = await res.json();
    return { success: true, reviews: data.reviews };
  } catch (err) {
    console.error('[Sync API] Error deleting review on server:', err);
    return { success: false };
  }
}

// Clear all reviews on server
export async function apiClearAllReviews(): Promise<boolean> {
  try {
    const res = await tenantFetch('/api/reviews', {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.error('[Sync API] Error clearing reviews on server:', err);
    return false;
  }
}

// Push all entities to server database for permanent storage
export async function apiSyncPush(data: {
  settings?: RestaurantSettings;
  rewards?: RewardOption[];
  waiters?: Waiter[];
  reviews?: Review[];
}): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await tenantFetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      return { success: false, message: 'Servidor respondeu com erro ao persistir.' };
    }
    const json = await res.json();
    return { success: true, message: json.message };
  } catch (err: any) {
    console.error('[Sync API] Error pushing complete database to server:', err);
    return { success: false, message: err?.message || 'Erro de conexão com o servidor' };
  }
}

// Trigger expiring notifications on server (5 days and 1 day)
export async function apiTriggerExpiringNotifications(payload?: {
  reviewId?: string;
  type?: '5_days' | '1_day';
}): Promise<{
  success: boolean;
  sent5DaysCount: number;
  sent1DayCount: number;
  message: string;
  reviews?: Review[];
}> {
  try {
    const res = await tenantFetch('/api/notifications/expiring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.error('[API] Error triggering expiring notifications:', err);
    return {
      success: false,
      sent5DaysCount: 0,
      sent1DayCount: 0,
      message: err?.message || 'Falha ao disparar notificações de vencimento.',
    };
  }
}
