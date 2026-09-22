/**
 * BloodConnect – Blood Donation Network
 * Supabase Client Configuration & Setup
 * Developed by Noeline Gaikwad
 */

// Helper to normalize Supabase URL (strip /rest/v1 or trailing slashes)
function cleanSupabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  return rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

// Retrieve any custom Supabase credentials saved locally by the user
const storedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('bloodconnect_supabase_url') : null;
const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('bloodconnect_supabase_anon_key') : null;

// Supabase project configuration provided by user
export const SUPABASE_CONFIG = {
  url: cleanSupabaseUrl(storedUrl || (typeof window !== 'undefined' && window.__SUPABASE_URL__) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://uvxxzwcxwhkjxxpvbrqj.supabase.co'),
  anonKey: (storedKey || (typeof window !== 'undefined' && window.__SUPABASE_ANON_KEY__) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_s0vLd_1XnBdZOORd08X0Zw_kRZAGzK3').trim(),
};

// Check if Supabase client library is available
let supabase = null;

function getCreateClientFn() {
  if (typeof window !== 'undefined') {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return window.supabase.createClient.bind(window.supabase);
    }
    if (typeof window.supabase === 'function') {
      return window.supabase;
    }
    if (window.BloodConnectConfig?.supabaseClient) {
      return () => window.BloodConnectConfig.supabaseClient;
    }
  }
  return null;
}

export function initSupabaseClient(url = SUPABASE_CONFIG.url, key = SUPABASE_CONFIG.anonKey) {
  try {
    if (typeof window !== 'undefined' && window.__bloodconnect_supabase__) {
      supabase = window.__bloodconnect_supabase__;
      return supabase;
    }

    const createClientFn = getCreateClientFn();
    if (createClientFn) {
      supabase = createClientFn(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      if (typeof window !== 'undefined') {
        window.__bloodconnect_supabase__ = supabase;
      }
      console.log('✓ Supabase Client successfully initialized for BloodConnect.');
      return supabase;
    } else {
      // If script is still loading from CDN, attempt deferred initialization
      if (typeof window !== 'undefined') {
        const checkInterval = setInterval(() => {
          const fn = getCreateClientFn();
          if (fn && !supabase) {
            clearInterval(checkInterval);
            supabase = fn(url, key, {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
              },
            });
            window.__bloodconnect_supabase__ = supabase;
            console.log('✓ Supabase Client deferred initialization complete.');
          }
        }, 80);
        setTimeout(() => clearInterval(checkInterval), 6000);
      }
      return null;
    }
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
    return null;
  }
}

export function getSupabase() {
  if (typeof window !== 'undefined' && window.__bloodconnect_supabase__) {
    supabase = window.__bloodconnect_supabase__;
    return supabase;
  }
  if (supabase) return supabase;
  return initSupabaseClient();
}

export async function getSupabaseAsync() {
  const current = getSupabase();
  if (current) return current;

  // Try dynamic ESM import from CDN if UMD script hasn't arrived
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    if (mod && mod.createClient) {
      supabase = mod.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      if (typeof window !== 'undefined') {
        window.__bloodconnect_supabase__ = supabase;
      }
      console.log('✓ Supabase Client initialized via dynamic ESM module.');
      return supabase;
    }
  } catch (err) {
    console.warn('Dynamic ESM import fallback notice:', err);
  }

  // Poll for up to 3 seconds for UMD script
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const client = getSupabase();
      if (client || attempts > 30) {
        clearInterval(interval);
        resolve(client || null);
      }
    }, 100);
  });
}

// Initial client instance: attempt immediate initialization
supabase = initSupabaseClient();
if (!supabase && typeof window !== 'undefined') {
  const delayedInit = () => {
    if (!supabase) supabase = initSupabaseClient();
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', delayedInit);
  } else {
    delayedInit();
  }
}

// Helper to check if credentials are provided
export function isSupabaseConfigured() {
  return (
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.url.includes('.supabase.co') &&
    SUPABASE_CONFIG.anonKey &&
    SUPABASE_CONFIG.anonKey.length > 20
  );
}

// Save credentials
export function saveSupabaseConfig(url, anonKey) {
  if (!url || !anonKey) return false;
  const normalizedUrl = cleanSupabaseUrl(url);
  localStorage.setItem('bloodconnect_supabase_url', normalizedUrl);
  localStorage.setItem('bloodconnect_supabase_anon_key', anonKey.trim());
  SUPABASE_CONFIG.url = normalizedUrl;
  SUPABASE_CONFIG.anonKey = anonKey.trim();
  supabase = initSupabaseClient(normalizedUrl, anonKey.trim());
  return true;
}

// Reset credentials
export function resetSupabaseConfig() {
  localStorage.removeItem('bloodconnect_supabase_url');
  localStorage.removeItem('bloodconnect_supabase_anon_key');
  location.reload();
}

// Global exposure for non-module script tag usage
if (typeof window !== 'undefined') {
  window.BloodConnectConfig = {
    SUPABASE_CONFIG,
    getSupabase: () => supabase || initSupabaseClient(),
    isConfigured: isSupabaseConfigured,
    saveConfig: saveSupabaseConfig,
    resetConfig: resetSupabaseConfig,
  };
}
