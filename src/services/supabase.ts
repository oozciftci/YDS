import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getBackendConfig } from '../stores/settings'

let cachedClient: SupabaseClient | null = null
let cachedUrl = ''
let cachedKey = ''

/**
 * Dinamik Supabase İstemcisi.
 * Koda gömülü URL/anahtar kullanmaz; her zaman Ayarlar sayfasındaki
 * localStorage değerlerini referans alır. Ayarlar değişirse istemci otomatik yenilenir.
 */
export function getSupabase(): SupabaseClient | null {
  const config = getBackendConfig()
  if (!config || !config.url || !config.anonKey) {
    cachedClient = null
    cachedUrl = ''
    cachedKey = ''
    return null
  }

  if (cachedClient && cachedUrl === config.url && cachedKey === config.anonKey) {
    return cachedClient
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'x-client-info': 'yds-pwa-sync',
        },
      },
    })
    cachedUrl = config.url
    cachedKey = config.anonKey
    return cachedClient
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Supabase istemcisi başlatılamadı:', err)
    return null
  }
}
