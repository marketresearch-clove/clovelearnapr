import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  response?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, model, maxTokens = 600, temperature = 0.7 } = req.body;

    if (!prompt || !model) {
      return res.status(400).json({ error: 'Missing required fields: prompt, model' });
    }

    const apiUrl = process.env.VITE_OLLAMA_API_URL?.trim() || 'http://localhost:11434';
    const apiKey = process.env.VITE_OLLAMA_API_KEY;
    const isLocalOllama = apiUrl.startsWith('http://localhost') || apiUrl.startsWith('http://127.0.0.1') || apiUrl.startsWith('http://[::1]');

    if (!isLocalOllama && !apiKey) {
      return res.status(500).json({ error: 'Ollama API key not configured on server. Set VITE_OLLAMA_API_KEY for remote Ollama/OpenRouter endpoints.' });
    }

    console.log(`[OLLAMA PROXY] Calling model: ${model}, url: ${apiUrl}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        temperature,
        num_predict: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OLLAMA PROXY] API error (${response.status}):`, errorText);
      return res.status(response.status).json({
        error: `Ollama API error: ${response.status} - ${errorText}`,
      });
    }

    const data = await response.json();

    if (!data.response) {
      return res.status(500).json({ error: 'Empty response from Ollama' });
    }

    console.log(`[OLLAMA PROXY] Success - response length: ${data.response.length}`);
    return res.status(200).json({ response: data.response });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[OLLAMA PROXY] Error:', errorMsg);
    return res.status(500).json({ error: `Server error: ${errorMsg}` });
  }
}
