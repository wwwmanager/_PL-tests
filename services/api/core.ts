/**
 * Core utilities and helpers for API layer
 * Extracted from mockApi.ts for better code splitting
 */

export interface ApiListMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: ApiListMeta;
}

export interface ApiSingleResponse<T> {
  data: T;
  meta: {
    updatedAt: string;
  };
}

/**
 * Deep clone utility using JSON serialization
 */
export const clone = <T>(value: T): T => {
  if (value === undefined) {
    return undefined as T;
  }
  return JSON.parse(JSON.stringify(value));
};

/**
 * Generate random latency for network simulation (120-340ms)
 */
export const randomLatency = () => 120 + Math.floor(Math.random() * 220);

/**
 * Simulate network delay with cloning
 */
export const simulateNetwork = async <T>(payload: T, latency = randomLatency()): Promise<T> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(clone(payload)), latency);
  });

/**
 * Paginate array of items
 */
export const paginate = <T>(items: T[], pageParam = 1, perPageParam = 10): ApiListResponse<T> => {
  const page = Math.max(1, Math.trunc(pageParam));
  const perPage = Math.max(1, Math.trunc(perPageParam));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const startIndex = (page - 1) * perPage;
  return {
    data: items.slice(startIndex, startIndex + perPage),
    meta: {
      total,
      page,
      perPage,
      totalPages,
    },
  };
};

/**
 * Normalize search string (trim + lowercase)
 */
export const normalizeSearch = (value?: string) => value?.trim().toLowerCase() ?? '';

/**
 * Generate unique ID with optional prefix
 */
export const generateId = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
