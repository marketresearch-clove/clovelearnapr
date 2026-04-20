/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_GEMINI_API_KEY1: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_KOKORO_API_URL: string;
  readonly VITE_KOKORO_API_KEY: string;
  readonly VITE_OPENROUTER_API_KEY: string;
  readonly VITE_OLLAMA_API_KEY: string;
  readonly VITE_OLLAMA_API_URL: string;
  readonly VITE_OLLAMA_MODEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
