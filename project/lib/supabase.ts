import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

// Get environment variables with fallbacks for development
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://yhskawezlwtoajaswens.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inloc2thd2V6bHd0b2FqYXN3ZW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwOTgxMzQsImV4cCI6MjA3MDY3NDEzNH0.ur-E0PAGc17mqyu5AaV285fQpSeyN-V4u6Dqni6Bt4I';

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is required. Please check your .env file.');
}

if (!supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env file.');
}

console.log('🔗 Supabase URL:', supabaseUrl);
console.log('🔑 Supabase Key:', supabaseAnonKey ? 'Present' : 'Missing');

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Enable real-time subscriptions
export const enableRealtime = () => {
  supabase.realtime.setAuth(supabaseAnonKey);
};