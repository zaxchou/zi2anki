/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 项目 URL */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase 匿名公钥 */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
