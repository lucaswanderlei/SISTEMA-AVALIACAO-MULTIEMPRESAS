const DEFAULT_COMPANY_ID = 'demo';

export function normalizeCompanyId(value?: string | null): string {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean || DEFAULT_COMPANY_ID;
}

export function getCompanyId(): string {
  if (typeof window === 'undefined') return DEFAULT_COMPANY_ID;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('empresa');
  if (fromQuery) {
    const id = normalizeCompanyId(fromQuery);
    try { localStorage.setItem('multiempresa_current_company', id); } catch {}
    return id;
  }
  try { return normalizeCompanyId(localStorage.getItem('multiempresa_current_company')); } catch { return DEFAULT_COMPANY_ID; }
}

export function tenantKey(key: string): string {
  return `${getCompanyId()}::${key}`;
}

export function withCompanyParam(url: string): string {
  if (typeof window === 'undefined') return url;
  const u = new URL(url, window.location.origin);
  u.searchParams.set('empresa', getCompanyId());
  return `${u.pathname}${u.search}${u.hash}`;
}
