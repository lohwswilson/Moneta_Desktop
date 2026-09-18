import axios, { type AxiosInstance, type AxiosAdapter } from 'axios';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

let apiClient: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Custom Tauri native adapter for production builds (Rust reqwest, zero browser CORS)
const createTauriAdapter = (): AxiosAdapter => {
  return async (config) => {
    let fullUrl = config.url || '';
    if (config.baseURL && !fullUrl.startsWith('http')) {
      fullUrl = config.baseURL.replace(/\/+$/, '') + '/' + fullUrl.replace(/^\/+/, '');
    }

    const headers: Record<string, string> = {};
    if (config.headers) {
      Object.entries(config.headers).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          headers[k] = String(v);
        }
      });
    }

    const res = await tauriFetch(fullUrl, {
      method: (config.method || 'GET').toUpperCase(),
      headers,
      body: config.data
        ? typeof config.data === 'string'
          ? config.data
          : JSON.stringify(config.data)
        : undefined,
    });

    const responseData = await res.json().catch(() => null);

    return {
      data: responseData,
      status: res.status,
      statusText: res.statusText,
      headers: {} as any,
      config,
      request: {},
    };
  };
};

export const configureApiClient = (serverUrl: string, apiToken: string): AxiosInstance => {
  const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Clean token: strip accidental 'Bearer ' prefix
  let cleanToken = (apiToken || '').trim();
  if (cleanToken.toLowerCase().startsWith('bearer ')) {
    cleanToken = cleanToken.slice(7).trim();
  }

  const targetUrl = (serverUrl || 'https://weeseng.dev8.ansis.com.sg').replace(/\/+$/, '');

  // In local development (whether in browser or in tauri dev), route through Vite proxy ''
  // to avoid browser CORS preflights
  let cleanBaseUrl = targetUrl;
  let adapter: AxiosAdapter | undefined = undefined;

  if (isLocalDev) {
    cleanBaseUrl = '';
  } else if (isTauri) {
    // In production standalone desktop builds, use native Rust HTTP plugin (zero CORS!)
    adapter = createTauriAdapter();
  }

  apiClient = axios.create({
    baseURL: cleanBaseUrl,
    timeout: 45000,
    adapter,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(cleanToken ? { Authorization: `Bearer ${cleanToken}` } : {}),
    },
  });

  return apiClient;
};

export const getApiClient = (): AxiosInstance => apiClient;
