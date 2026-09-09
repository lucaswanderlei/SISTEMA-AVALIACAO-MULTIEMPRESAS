import QRCode from 'qrcode';
import { RestaurantSettings, RewardOption, Review, Waiter } from '../types';
import { INITIAL_REWARDS, INITIAL_REVIEWS, INITIAL_SETTINGS, INITIAL_WAITERS } from '../data/mockData';

const REVIEWS_KEY = 'restaurant_eval_reviews_v2';
const DELETED_REVIEWS_KEY = 'restaurant_eval_deleted_reviews_v1';
const REWARDS_KEY = 'restaurant_eval_rewards_v2';
const SETTINGS_KEY = 'restaurant_eval_settings_v1';
const PIN_KEY = 'restaurant_eval_manager_pin_v1';
const WHATSAPP_CONFIG_KEY = 'restaurant_eval_whatsapp_config_v1';
const WAITERS_KEY = 'restaurant_eval_waiters_v1';
const REWARDS_CUSTOMIZED_KEY = 'restaurant_eval_rewards_customized';
const WAITERS_CUSTOMIZED_KEY = 'restaurant_eval_waiters_customized';

export function savePin(pin: string): void {
  try {
    localStorage.setItem(PIN_KEY, pin.trim());
  } catch {}
}

export function loadSavedPin(): string | null {
  try {
    const p = localStorage.getItem(PIN_KEY);
    return p && p.trim().length > 0 ? p.trim() : null;
  } catch {
    return null;
  }
}

export function saveWhatsAppConfig(config: { whatsappApiUrl?: string; whatsappApiToken?: string; whatsappCustomMessage?: string }): void {
  try {
    localStorage.setItem(WHATSAPP_CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

export function loadWhatsAppConfig(): { whatsappApiUrl?: string; whatsappApiToken?: string; whatsappCustomMessage?: string } | null {
  try {
    const raw = localStorage.getItem(WHATSAPP_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function isRewardsCustomized(): boolean {
  try {
    return localStorage.getItem(REWARDS_CUSTOMIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markRewardsCustomized(): void {
  try {
    localStorage.setItem(REWARDS_CUSTOMIZED_KEY, 'true');
  } catch {}
}

export function isWaitersCustomized(): boolean {
  try {
    return localStorage.getItem(WAITERS_CUSTOMIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markWaitersCustomized(): void {
  try {
    localStorage.setItem(WAITERS_CUSTOMIZED_KEY, 'true');
  } catch {}
}

export function loadSettings(): RestaurantSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const savedPin = loadSavedPin();
    const savedWhatsApp = loadWhatsAppConfig();
    let merged: RestaurantSettings = { ...INITIAL_SETTINGS };
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        merged = { ...INITIAL_SETTINGS, ...parsed };
      }
    }
    if (savedPin) {
      merged.managerPin = savedPin;
    }
    if (savedWhatsApp?.whatsappApiUrl) {
      merged.whatsappApiUrl = savedWhatsApp.whatsappApiUrl;
    }
    if (savedWhatsApp?.whatsappApiToken) {
      merged.whatsappApiToken = savedWhatsApp.whatsappApiToken;
    }
    if (savedWhatsApp?.whatsappCustomMessage) {
      merged.whatsappCustomMessage = savedWhatsApp.whatsappCustomMessage;
    }

    // Never allow empty or placeholder URLs to overwrite the official Meta Cloud API
    if (
      !merged.whatsappApiUrl ||
      merged.whatsappApiUrl.includes('SEU_PHONE_NUMBER_ID') ||
      merged.whatsappApiUrl.includes('SUA_INSTANCIA')
    ) {
      merged.whatsappApiUrl = INITIAL_SETTINGS.whatsappApiUrl;
    }
    if (!merged.whatsappApiToken) {
      merged.whatsappApiToken = INITIAL_SETTINGS.whatsappApiToken;
    }

    return merged;
  } catch (e) {
    console.error('Error reading settings', e);
  }
  return INITIAL_SETTINGS;
}

export function saveSettings(settings: RestaurantSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (settings.managerPin && settings.managerPin.trim().length > 0) {
      savePin(settings.managerPin);
    }
    if (settings.whatsappApiUrl || settings.whatsappApiToken || settings.whatsappCustomMessage) {
      saveWhatsAppConfig({
        whatsappApiUrl: settings.whatsappApiUrl,
        whatsappApiToken: settings.whatsappApiToken,
        whatsappCustomMessage: settings.whatsappCustomMessage,
      });
    }
  } catch (e) {
    console.error('Error saving settings', e);
  }
}

export function loadWaiters(): Waiter[] {
  try {
    const raw = localStorage.getItem(WAITERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading waiters', e);
  }
  return INITIAL_WAITERS;
}

export function saveWaiters(waiters: Waiter[]): void {
  try {
    localStorage.setItem(WAITERS_KEY, JSON.stringify(waiters));
    markWaitersCustomized();
  } catch (e) {
    console.error('Error saving waiters', e);
  }
}

export function loadRewards(): RewardOption[] {
  try {
    const raw = localStorage.getItem(REWARDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading rewards', e);
  }
  return INITIAL_REWARDS;
}

export function saveRewards(rewards: RewardOption[]): void {
  try {
    localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards));
    markRewardsCustomized();
  } catch (e) {
    console.error('Error saving rewards', e);
  }
}

export function loadDeletedReviewIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_REVIEWS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set<string>(parsed.map(String));
      }
    }
  } catch (e) {
    console.error('Error reading deleted review IDs', e);
  }
  return new Set<string>();
}

export function markReviewDeleted(id: string): void {
  try {
    const current = loadDeletedReviewIds();
    current.add(id);
    localStorage.setItem(DELETED_REVIEWS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Error marking review deleted', e);
  }
}

export function clearAllDeletedReviewIds(): void {
  try {
    localStorage.removeItem(DELETED_REVIEWS_KEY);
  } catch {}
}

export function loadReviews(): Review[] {
  try {
    // Purge legacy v1 mock reviews if found
    if (localStorage.getItem('restaurant_eval_reviews_v1')) {
      localStorage.removeItem('restaurant_eval_reviews_v1');
    }
    const raw = localStorage.getItem(REVIEWS_KEY);
    if (raw) {
      const parsed: Review[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deletedIds = loadDeletedReviewIds();
        return parsed.filter((r) => r && r.id && !deletedIds.has(r.id));
      }
    }
  } catch (e) {
    console.error('Error reading reviews', e);
  }
  return INITIAL_REVIEWS;
}

export function saveReviews(reviews: Review[]): void {
  try {
    const deletedIds = loadDeletedReviewIds();
    const cleanReviews = reviews.filter((r) => r && r.id && !deletedIds.has(r.id));
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(cleanReviews));
  } catch (e) {
    console.error('Error saving reviews', e);
  }
}

export function clearAllReviewsStorage(): void {
  try {
    localStorage.removeItem(REVIEWS_KEY);
    localStorage.removeItem(DELETED_REVIEWS_KEY);
    localStorage.removeItem('restaurant_eval_reviews_v1');
    localStorage.removeItem('restaurant_last_eval_date');
    localStorage.removeItem('restaurant_last_eval_phone');
    localStorage.removeItem('restaurant_last_eval_review');
  } catch (e) {
    console.error('Error clearing reviews storage', e);
  }
}

export function generateRewardCode(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `BRINDE-${randomNum}`;
}

export async function generateQrCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 280,
      margin: 2,
      color: {
        dark: '#1e1e24',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}
