import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Review, RewardOption, RestaurantSettings, Waiter } from '../types';
import { getCompanyId } from './tenant';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
/* CRITICAL: The app will break without firebaseConfig.firestoreDatabaseId */
export const db = initializeFirestore(
  app,
  {
    ignoreUndefinedProperties: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot as required by Firestore integration guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is offline or unreachable. Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

// --- Firestore CRUD operations ---

export async function firestoreFetchAll(): Promise<{
  reviews: Review[];
  rewards: RewardOption[];
  waiters: Waiter[];
  settings?: RestaurantSettings;
} | null> {
  try {
    const reviewsCol = collection(db, 'companies', getCompanyId(), 'reviews');
    const rewardsCol = collection(db, 'companies', getCompanyId(), 'rewards');
    const waitersCol = collection(db, 'companies', getCompanyId(), 'waiters');
    const settingsDoc = doc(db, 'companies', getCompanyId(), 'settings', 'restaurant');

    const [reviewsSnap, rewSnap, waitSnap] = await Promise.all([
      getDocs(reviewsCol).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, 'reviews');
      }),
      getDocs(rewardsCol).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, 'rewards');
      }),
      getDocs(waitersCol).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, 'waiters');
      }),
    ]);

    const reviews: Review[] = [];
    reviewsSnap.forEach((d) => {
      reviews.push(d.data() as Review);
    });

    const rewards: RewardOption[] = [];
    rewSnap.forEach((d) => {
      rewards.push(d.data() as RewardOption);
    });

    const waiters: Waiter[] = [];
    waitSnap.forEach((d) => {
      waiters.push(d.data() as Waiter);
    });

    let settings: RestaurantSettings | undefined;
    try {
      const sSnap = await getDocFromServer(settingsDoc);
      if (sSnap.exists()) {
        settings = sSnap.data() as RestaurantSettings;
      }
    } catch {
      // document might not exist yet
    }

    return {
      reviews,
      rewards,
      waiters,
      settings,
    };
  } catch (error) {
    console.error('Error fetching Firestore data:', error);
    return null;
  }
}

export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = sanitizeForFirestore(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned as T;
}

export async function firestoreFetchReviews(): Promise<Review[]> {
  const path = 'reviews';
  try {
    const reviewsCol = collection(db, 'companies', getCompanyId(), 'reviews');
    const snap = await getDocs(reviewsCol);
    const reviews: Review[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.id) {
        reviews.push(data as Review);
      }
    });
    return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('[Firebase] Warning fetching reviews from Firestore:', error);
    return [];
  }
}

export function subscribeToReviews(
  onUpdate: (reviews: Review[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'reviews';
  return onSnapshot(
    collection(db, 'companies', getCompanyId(), 'reviews'),
    (snap) => {
      const reviews: Review[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data && data.id) {
          reviews.push(data as Review);
        }
      });
      reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(reviews);
    },
    (error) => {
      console.warn('[Firebase] Warning onSnapshot for reviews:', error);
      if (onError) onError(error);
    }
  );
}

export async function firestoreSaveReview(review: Review): Promise<boolean> {
  const path = `reviews/${review.id}`;
  try {
    const cleaned = sanitizeForFirestore(review);
    await setDoc(doc(db, 'companies', getCompanyId(), 'reviews', review.id), cleaned, { merge: true });
    return true;
  } catch (error) {
    console.error('[Firebase] Error saving review to Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Re-throw so caller knows or handles
    }
    return false;
  }
}

export async function firestoreSaveRewards(rewards: RewardOption[]): Promise<boolean> {
  try {
    const batch = writeBatch(db);
    rewards.forEach((r) => {
      batch.set(doc(db, 'companies', getCompanyId(), 'rewards', r.id), sanitizeForFirestore(r));
    });
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'rewards');
  }
}

export async function firestoreSaveWaiters(waiters: Waiter[]): Promise<boolean> {
  try {
    const batch = writeBatch(db);
    waiters.forEach((w) => {
      batch.set(doc(db, 'companies', getCompanyId(), 'waiters', w.id), sanitizeForFirestore(w));
    });
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'waiters');
  }
}

export async function firestoreSaveSettings(settings: RestaurantSettings): Promise<boolean> {
  const path = 'settings/restaurant';
  try {
    await setDoc(doc(db, 'companies', getCompanyId(), 'settings', 'restaurant'), sanitizeForFirestore(settings));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function firestoreFetchSettings(): Promise<RestaurantSettings | null> {
  const path = 'settings/restaurant';
  try {
    const snap = await getDoc(doc(db, 'companies', getCompanyId(), 'settings', 'restaurant'));
    if (snap.exists()) {
      return snap.data() as RestaurantSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function firestoreDeleteReview(id: string): Promise<boolean> {
  const path = `reviews/${id}`;
  try {
    await deleteDoc(doc(db, 'companies', getCompanyId(), 'reviews', id));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
