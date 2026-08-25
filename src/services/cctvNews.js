import { apiFetch } from '@/services/apiClient.js'

/**
 * Ranked CCTV headlines from /api/cctv-news.
 * @returns {Promise<{ ok: boolean, source: string, asOf: string, counts: object, items: object[], error?: string }>}
 */
export async function fetchCctvNews() {
  const data = await apiFetch('/api/cctv-news')
  return {
    ok: data?.ok !== false,
    source: data?.source || 'cctv',
    asOf: data?.asOf || '',
    counts: data?.counts || { s: 0, a: 0, b: 0, c: 0, today: 0 },
    items: Array.isArray(data?.items) ? data.items : [],
    groups: {
      domestic: Array.isArray(data?.groups?.domestic) ? data.groups.domestic : [],
      world: Array.isArray(data?.groups?.world) ? data.groups.world : [],
    },
    cache: data?.cache || '',
    error: '',
  }
}
