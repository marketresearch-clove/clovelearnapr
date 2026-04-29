/**
 * Cloudflare Worker - Ollama API Proxy
 * Proxies requests from browser to OpenRouter API (for Ollama-compatible models)
 * Deployed at: https://ollama-proxy.clovetech.workers.dev
 *
 * Environment Variables (set in Cloudflare Dashboard):
 * - OLLAMA_API_KEY: Your OpenRouter API key (since Ollama uses OpenRouter for cloud models)
 * - OLLAMA_API_URL: OpenRouter API URL (https://openrouter.ai/api/v1)
 */

interface OllamaRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

interface OllamaResponse {
  response?: string;
  error?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST requests are allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    try {
      // Parse incoming request
      let requestData: OllamaRequest;
      try {
        requestData = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { prompt, model, maxTokens = 600, temperature = 0.7 } = requestData;

      // Validate required fields
      if (!prompt || !model) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: prompt, model' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get API credentials from environment
      const apiKey = env.OLLAMA_API_KEY;
      const apiUrl = env.OLLAMA_API_URL || 'https://openrouter.ai/api/v1';

      console.log(`[OLLAMA] API Key present: ${!!apiKey}, URL: ${apiUrl}`);

      if (!apiKey || apiKey.trim().length === 0) {
        console.error('[OLLAMA] API key not configured in Cloudflare environment');
        return new Response(
          JSON.stringify({ error: 'Ollama Worker error: OLLAMA_API_KEY is missing or empty. Configure it in your Cloudflare Worker variables.' }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      console.log(`[OLLAMA] Proxying request - model: ${model}, tokens: ${maxTokens}`);

      // Call OpenRouter API (OpenAI-compatible format)
      const ollamaResponse = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://skill-spire-lms.com',
          'X-Title': 'Skill Spire LMS',
          'User-Agent': 'Skill-Spire-LMS/1.0 (Cloudflare Worker)',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        }),
      });

      // Handle API errors
      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text();
        console.error(
          `[OLLAMA] API error - status: ${ollamaResponse.status}, body: ${errorText}`
        );

        const responseData: OllamaResponse = {
          error: `Ollama API error: ${ollamaResponse.status} - ${errorText}`,
        };

        return new Response(JSON.stringify(responseData), {
          status: ollamaResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Parse OpenRouter response (OpenAI format)
      const data = await ollamaResponse.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('[OLLAMA] Invalid response format from OpenRouter:', data);
        return new Response(
          JSON.stringify({ error: 'Invalid response format from Ollama API' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log(
        `[OLLAMA] Success - response length: ${data.choices[0].message.content.length} chars`
      );

      // Return success response
      return new Response(JSON.stringify({ response: data.choices[0].message.content }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      console.error('[OLLAMA] Worker error:', errorMsg);

      return new Response(
        JSON.stringify({
          error: `Cloudflare Worker error: ${errorMsg}`,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};

interface Env {
  OLLAMA_API_KEY: string;
  OLLAMA_API_URL?: string;
}
