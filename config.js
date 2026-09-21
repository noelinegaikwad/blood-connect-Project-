/**
 * BloodConnect – Blood Donation Network
 * Supabase Client Configuration & Setup
 * Developed by Noeline Gaikwad
 */

// Retrieve any custom Supabase credentials saved locally by the user
const storedUrl = localStorage.getItem('bloodconnect_supabase_url');
const storedKey = localStorage.getItem('bloodconnect_supabase_anon_key');

// Default Supabase project configuration (replace with your actual project details)
export const SUPABASE_CONFIG = {
  url: storedUrl || window.__SUPABASE_URL__ || 'https://vrmeyuaflyzbfiutqyls.supabase.co',
  anonKey: storedKey || window.__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZybWV5dWFmbHl6YmZpdXRxeWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NTk2MDAsImV4cCI6MjA1ODIzNTYwMH0.3e5B8M6n6e-y38y8b4L1kX0W8L1vK9V7X8P7N9Q2R4S',
};

// Check if Supabase client library is available
let supabase = null;

export function initSupabaseClient(url = SUPABASE_CONFIG.url, key = SUPABASE_CONFIG.anonKey) {
  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabase = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      console.log('✓ Supabase Client successfully initialized for BloodConnect.');
      return supabase;
    } else {
      console.warn('Supabase JS library not loaded yet.');
      return null;
    }
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
    return null;
  }
}

// Initial client instance
if (window.supabase) {
  supabase = initSupabaseClient();
} else {
  window.addEventListener('DOMContentLoaded', () => {
    supabase = initSupabaseClient();
  });
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
  localStorage.setItem('bloodconnect_supabase_url', url.trim());
  localStorage.setItem('bloodconnect_supabase_anon_key', anonKey.trim());
  SUPABASE_CONFIG.url = url.trim();
  SUPABASE_CONFIG.anonKey = anonKey.trim();
  supabase = initSupabaseClient(url.trim(), anonKey.trim());
  return true;
}

// Reset credentials
export function resetSupabaseConfig() {
  localStorage.removeItem('bloodconnect_supabase_url');
  localStorage.removeItem('bloodconnect_supabase_anon_key');
  location.reload();
}

// Global exposure for non-module script tag usage
window.BloodConnectConfig = {
  SUPABASE_CONFIG,
  getSupabase: () => supabase || initSupabaseClient(),
  isConfigured: isSupabaseConfigured,
  saveConfig: saveSupabaseConfig,
  resetConfig: resetSupabaseConfig,
};
