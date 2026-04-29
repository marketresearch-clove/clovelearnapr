import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const openrouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
const genAI = new GoogleGenerativeAI(geminiApiKey);
const DEFAULT_MODEL_NAME = "gemini-1.5-flash";
const DEFAULT_OPENROUTER_MODEL = "google/gemma-4-31b"; // More reliable than Nemotron
const DEFAULT_OLLAMA_MODEL = "qwen2.5:3b";
const API_VERSION = "v1beta";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Extract JSON from text that may contain preamble or extra text
 * Handles responses like "Okay, I'll...\n{json here}"
 * Also attempts to fix truncated or malformed JSON
 */
const extractJSON = (text: string): string => {
  let cleaned = text.trim();

  // 1) Remove markdown code blocks if present
  if (cleaned.includes('```json')) {
    cleaned = cleaned.split('```json')[1]?.split('```')[0]?.trim() || cleaned;
  } else if (cleaned.includes('```')) {
    cleaned = cleaned.split('```')[1]?.split('```')[0]?.trim() || cleaned;
  }

  // 2) Find the first occurrence of { or [
  const firstBracket = cleaned.search(/[\[{]/);
  if (firstBracket === -1) {
    return cleaned;
  }

  const opening = cleaned[firstBracket];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastValidJsonIndex = -1;

  // 3) Try to find a complete JSON structure
  for (let i = firstBracket; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === opening) {
        depth += 1;
      } else if (char === closing) {
        depth -= 1;
        if (depth === 0) {
          lastValidJsonIndex = i;
          // Don't break here, keep searching for the largest possible valid JSON block
          // (though usually the first one is what we want)
        }
      }
    }
  }

  // 4) If we found a complete structure, return it
  if (lastValidJsonIndex !== -1) {
    cleaned = cleaned.slice(firstBracket, lastValidJsonIndex + 1);
  } else {
    // 5) If NOT complete (truncated), we need to repair it
    cleaned = repairTruncatedJSON(cleaned.slice(firstBracket));
  }

  // Final cleanup for common AI JSON output issues
  
  // 1) Remove numbered list markers inside JSON arrays (e.g., [ 1. { "a": 1 }, 2. { "b": 2 } ])
  cleaned = cleaned.replace(/(\[|\,)\s*\d+\.\s*/g, '$1 ');

  // 2) Missing commas between adjacent objects in arrays (e.g., } { )
  cleaned = cleaned.replace(/}\s*\{/g, '}, {');

  // 3) Missing commas between adjacent strings in arrays (e.g., "a" "b" )
  cleaned = cleaned.replace(/"\s*"/g, '", "');

  // 4) Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // 5) Fix double commas
  cleaned = cleaned.replace(/,\s*,/g, ',');

  return cleaned;
};

/**
 * Robust JSON repair for truncated responses
 * Closes unclosed strings, objects, and arrays
 */
const repairTruncatedJSON = (json: string): string => {
  let depth = [];
  let inString = false;
  let escape = false;
  let result = "";

  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    
    if (escape) {
      result += char;
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      result += char;
      escape = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString) {
      result += char;
      continue;
    }

    if (char === '{' || char === '[') {
      depth.push(char === '{' ? '}' : ']');
      result += char;
    } else if (char === '}' || char === ']') {
      if (depth.length > 0 && depth[depth.length - 1] === char) {
        depth.pop();
        result += char;
      }
    } else {
      result += char;
    }
  }

  // If we're inside a string, close it
  if (inString) {
    result += '"';
  }

  // If it's an array and the last character is a comma, remove it
  result = result.trim();
  if (result.endsWith(',')) {
    result = result.slice(0, -1);
  }

  // Close all unclosed objects and arrays in reverse order
  while (depth.length > 0) {
    const closing = depth.pop();
    result += closing;
  }

  // One more pass: if we have an incomplete property/value in an object, it might still fail
  // But this handles the most common truncation issues where it stops mid-way
  try {
    JSON.parse(result);
    return result;
  } catch (e) {
    // If it still fails, try to remove the last comma-separated item in an array/object
    // This is useful for truncated quiz arrays like [{"q1"...}, {"q2"...}, {"q3" (truncated)
    const lastComma = result.lastIndexOf(',');
    if (lastComma !== -1) {
      const parentOpening = result.lastIndexOf('[', lastComma);
      const parentClosing = result.includes(']') ? result.lastIndexOf(']') : -1;
      
      // If it looks like an array element was truncated
      if (parentOpening !== -1 && (parentClosing === -1 || parentClosing < lastComma)) {
        let repaired = result.slice(0, lastComma) + ']';
        try {
          JSON.parse(repaired);
          return repaired;
        } catch (e2) {}
      }
    }
    return result;
  }
};

/**
 * Utility function to retry API calls with exponential backoff
 * Handles temporary failures like 503 errors from high demand
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Extract status code if available
      const status = (error as any)?.status || (error as any)?.response?.status;
      const errorMsg = lastError.message || String(lastError);

      // Check if it's a retryable error (503, 429, network errors, etc.)
      const isRetryable =
        status === 429 ||
        status === 503 ||
        status === 502 ||
        status === 500 ||
        errorMsg.includes('503') ||
        errorMsg.includes('429') ||
        errorMsg.includes('502') ||
        errorMsg.includes('500') ||
        errorMsg.includes('fetch') ||
        errorMsg.includes('network') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('high demand') ||
        errorMsg.includes('temporarily unavailable') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('TRUNCATED_RETRY') ||
        errorMsg.includes('Too Many Requests');

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      // Increase delay significantly for 429 errors
      const multiplier = (status === 429 || errorMsg.includes('429')) ? 4 : 2;
      const delay = (baseDelay * Math.pow(multiplier, attempt)) + (Math.random() * 2000);

      console.warn(`AI API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms:`, errorMsg);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

/**
 * Call OpenRouter API with retry logic
 * Uses smaller max_tokens and delays to avoid truncation
 */
const normalizeOpenRouterContent = (content: any): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item?.text) {
          return String(item.text);
        }
        if (typeof item?.content === 'string') {
          return item.content;
        }
        if (Array.isArray(item?.content)) {
          return normalizeOpenRouterContent(item.content);
        }
        return '';
      })
      .join('');
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') {
      return content.text;
    }
    if (typeof content.content === 'string') {
      return content.content;
    }
    if (Array.isArray(content.content)) {
      return normalizeOpenRouterContent(content.content);
    }
  }

  return String(content ?? '');
};

const callOpenRouterAPI = async (
  prompt: string,
  modelName: string = DEFAULT_OPENROUTER_MODEL,
  maxRetries: number = 3,
  baseDelay: number = 3000,
  maxTokens: number = 2000
): Promise<string> => {
  if (!openrouterApiKey) {
    throw new Error('OpenRouter API key not configured. For local development, set VITE_OPENROUTER_API_KEY in .env.local. For production deployment (Netlify/Vercel), set the environment variable in your hosting platform dashboard.');
  }

  let lastTruncationError: string | null = null;
  let currentMaxTokens = maxTokens;
  let currentPrompt = prompt;

  return retryWithBackoff(async () => {
    console.log(`Calling OpenRouter with model: ${modelName}, maxTokens: ${currentMaxTokens}`);

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'Skill Spire LMS',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: currentPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: currentMaxTokens,
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Failed to parse OpenRouter response:', parseError);
      throw new Error(`OpenRouter returned invalid JSON: ${response.statusText}`);
    }

    console.log('OpenRouter response status:', response.status, 'data:', data);

    // Check for error object in response (OpenRouter sometimes returns 200 with error inside)
    if (data?.error) {
      const errorMsg = data.error.message || data.error.error || JSON.stringify(data.error);
      console.error('OpenRouter API Error (in response body):', { status: response.status, error: data.error });

      // Check specific error types
      if (errorMsg.includes('authentication') || errorMsg.includes('invalid') || errorMsg.includes('Unauthorized')) {
        throw new Error(`OpenRouter authentication failed: ${errorMsg}`);
      }

      if (errorMsg.includes('not found') || errorMsg.includes('model')) {
        throw new Error(`OpenRouter model not found: ${modelName}. Error: ${errorMsg}`);
      }

      if (errorMsg.includes('overloaded') || errorMsg.includes('busy') || errorMsg.includes('429')) {
        throw new Error(`OpenRouter service overloaded: ${errorMsg}`);
      }

      throw new Error(`OpenRouter error: ${errorMsg}`);
    }

    // Check HTTP status AFTER checking for error objects
    if (!response.ok) {
      const errorMsg = data?.message || JSON.stringify(data);
      console.error('OpenRouter API HTTP Error:', { status: response.status, error: data });

      // Check if it's an auth error
      if (response.status === 401 || response.status === 403) {
        throw new Error(`OpenRouter authentication failed: ${errorMsg}`);
      }

      // Check if it's a not found error (model doesn't exist)
      if (response.status === 404) {
        throw new Error(`OpenRouter model not found: ${modelName}. Error: ${errorMsg}`);
      }

      throw new Error(`OpenRouter API error: ${response.status} - ${errorMsg}`);
    }

    // Now check for valid response structure
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('Invalid OpenRouter response format - no choices:', data);
      throw new Error(`Invalid response format from OpenRouter: no choices in response. Got: ${JSON.stringify(data).substring(0, 200)}`);
    }

    const choice = data.choices[0];
    const rawContent = normalizeOpenRouterContent(choice?.message?.content);
    const content = rawContent?.trim();

    // Check if response was truncated (finish_reason: 'length')
    if (choice?.finish_reason === 'length') {
      console.warn('⚠️ OpenRouter response truncated (finish_reason: length)');
      lastTruncationError = 'Token limit reached';

      // Retry with larger token limit to get full response
      if (currentMaxTokens < 1500) {
        currentMaxTokens = Math.min(1500, Math.floor(currentMaxTokens * 1.5));
        console.log(`Retrying with increased maxTokens: ${currentMaxTokens}`);
        throw new Error('TRUNCATED_RETRY');
      } else {
        // Already at limit, give up
        throw new Error(`TRUNCATED_FAILED: Even with ${currentMaxTokens} tokens, response truncated. Prompt too complex.`);
      }
    }

    if (!content || content.length === 0) {
      console.error('No content in OpenRouter response:', choice);
      throw new Error('EMPTY_RESPONSE');
    }

    return content;
  }, maxRetries, baseDelay);
};

/**
 * Call Ollama API via Cloudflare Worker proxy to avoid CORS issues
 * Uses Cloudflare Workers endpoint (https://ollama-proxy.clovetech.workers.dev)
 */
const LOCAL_OLLAMA_API_URL = import.meta.env.VITE_OLLAMA_API_URL || 'http://localhost:11434';
const LOCAL_OLLAMA_API_KEY = import.meta.env.VITE_OLLAMA_API_KEY || '';
const CLOUDFLARE_WORKER_URL = 'https://skill-spire-ollama-proxy.subharam-v.workers.dev';

const isLocalOllamaUrl = (url: string) => {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('skill-spire-ollama-proxy.subharam-v.workers.dev')) return false;
  if (normalized.includes('ollama-proxy.clovetech.workers.dev')) return false;
  return normalized.startsWith('http://') || normalized.startsWith('https://');
};

/**
 * Fetch available models from local Ollama instance
 */
export const fetchAvailableOllamaModels = async (): Promise<{ value: string, label: string }[]> => {
  const baseUrl = LOCAL_OLLAMA_API_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/tags`;

  try {
    console.log(`Fetching Ollama models from: ${endpoint}`);
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Ollama models: ${response.status}`);
    }

    const data = await response.json();
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((m: any) => ({
        value: m.name,
        label: `${m.name} (Local)`
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
};

const callLocalOllamaAPI = async (
  prompt: string,
  modelName: string,
  maxRetries: number,
  baseDelay: number,
  maxTokens: number
): Promise<string> => {
  const baseUrl = LOCAL_OLLAMA_API_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/generate`;

  console.log(`Calling local Ollama directly - url: ${endpoint}, model: ${modelName}, maxTokens: ${maxTokens}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(LOCAL_OLLAMA_API_KEY ? { Authorization: `Bearer ${LOCAL_OLLAMA_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: modelName,
      prompt,
      temperature: 0.7,
      num_predict: maxTokens,
      stream: false,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`Local Ollama API error (${response.status}):`, text);
    throw new Error(`Local Ollama API failed with status ${response.status}: ${text}`);
  }

  const data = JSON.parse(text);
  if (!data.response || typeof data.response !== 'string' || data.response.trim().length === 0) {
    console.error('Local Ollama returned invalid response:', data);
    throw new Error('EMPTY_RESPONSE');
  }

  return data.response;
};

const callOllamaAPI = async (
  prompt: string,
  modelName: string = DEFAULT_OLLAMA_MODEL,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxTokens: number = 2000
): Promise<string> => {
  const useLocal = LOCAL_OLLAMA_API_URL.trim().length > 0 && LOCAL_OLLAMA_API_URL !== CLOUDFLARE_WORKER_URL && isLocalOllamaUrl(LOCAL_OLLAMA_API_URL);

  return retryWithBackoff(async () => {
    if (useLocal) {
      try {
        return await callLocalOllamaAPI(prompt, modelName, maxRetries, baseDelay, maxTokens);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Local Ollama API error:', errorMsg);
        throw new Error(`Local Ollama failed: ${errorMsg}`);
      }
    }

    console.log(`Calling Ollama via Cloudflare Worker - model: ${modelName}, maxTokens: ${maxTokens}`);

    try {
      const response = await fetch(CLOUDFLARE_WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: modelName,
          maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ollama Worker error (${response.status}):`, errorText);
        if (response.status === 401 || errorText.includes('Missing Authentication header')) {
          throw new Error(
            `Ollama Worker unauthorized. Check your Cloudflare Worker environment variables: OLLAMA_API_KEY and OLLAMA_API_URL. Details: ${errorText}`
          );
        }
        throw new Error(`Ollama Worker failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error('Ollama Worker returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data.response || data.response.trim().length === 0) {
        console.error('No content in Ollama response:', data);
        throw new Error('EMPTY_RESPONSE');
      }

      console.log('Ollama response received via Cloudflare Worker');
      return data.response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('ERR_')) {
        throw new Error(
          `Cannot reach Ollama via Cloudflare Worker. Ensure: ` +
          `1) Worker is deployed at ollama-proxy.clovetech.workers.dev, ` +
          `2) OLLAMA_API_KEY is set in Cloudflare environment, ` +
          `3) OLLAMA_API_URL is correct. Details: ${errorMsg}`
        );
      }
      throw error;
    }
  }, maxRetries, baseDelay);
};

/**
 * Strip HTML tags from a string
 */
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  // Remove HTML tags
  return html.replace(/<[^>]*>/g, '');
};

/**
 * Recursively clean course content generated by AI
 * Ensures titles don't contain HTML tags
 */
const cleanAIGeneratedContent = (content: any): any => {
  if (Array.isArray(content)) {
    return content.map(item => cleanAIGeneratedContent(item));
  }

  if (typeof content === 'object' && content !== null) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(content)) {
      if (key === 'title' && typeof value === 'string') {
        // Strip HTML from titles
        cleaned[key] = stripHtmlTags(value).trim();
      } else if (typeof value === 'object') {
        cleaned[key] = cleanAIGeneratedContent(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  return content;
};

/**
 * Generate course content in TRUE granular chunks - optimized for OpenRouter and Ollama
 * ONE API CALL = ONE CONTENT TYPE ONLY
 * Avoids token limits and truncation issues
 */
const generateCourseContentChunked = async (
  title: string,
  options: any
): Promise<any> => {
  const { modulesCount = 3, lessonsPerModule = 3, difficulty = 'beginner', contentType = 'text', additionalPrompt = '', quizQuestionsCount = 5, flashcardLimit = 15, modelName, provider = 'openrouter', onStatusUpdate } = options;

  // Helper function to call the right API based on provider
  const callAI = async (prompt: string, maxRetries: number = 3, delayMs: number = 1000, maxTokens: number = 600) => {
    if (provider === 'ollama') {
      return callOllamaAPI(prompt, modelName || DEFAULT_OLLAMA_MODEL, maxRetries, delayMs, maxTokens);
    } else {
      return callOpenRouterAPI(prompt, modelName || DEFAULT_OPENROUTER_MODEL, maxRetries, delayMs, maxTokens);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // STEP 1: Generate course outline ONLY (modules + lesson titles) - MINIMAL
    onStatusUpdate?.('Generating course structure...');
    const outlinePrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. Create outline for "${title}" (${modulesCount} modules, ${lessonsPerModule} lessons each).
    Output format: {"modules": [{"title": "Module Title", "lessons": ["Lesson 1", "Lesson 2"]}]}`;

    const outlineResponse = await callAI(outlinePrompt, 4, 4000, 1200);
    const outline = JSON.parse(extractJSON(outlineResponse));
    await delay(5000);

    // STEP 2: Generate course description - MINIMAL
    onStatusUpdate?.('Creating description...');
    const descPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. 1-sentence description of "${title}". Output format: {"description": "..."}`;
    const descResponse = await callAI(descPrompt, 3, 3000, 800);
    const descData = JSON.parse(extractJSON(descResponse));
    await delay(4000);

    // STEP 3: Generate EACH LESSON individually - MINIMAL OUTPUT
    const modules = outline.modules.map((m: any) => ({
      title: m.title,
      description: `Learn about ${m.title}`,
      lessons: m.lessons,
    }));

    for (let mIdx = 0; mIdx < modules.length; mIdx++) {
      for (let lIdx = 0; lIdx < modules[mIdx].lessons.length; lIdx++) {
        const lessonTitle = modules[mIdx].lessons[lIdx];
        onStatusUpdate?.(`Writing: ${lessonTitle}...`);

        const lessonPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. 2-3 sentence explanation for "${lessonTitle}".
        Output format: {"content": "explanation here", "duration": 10}`;

        const lessonResponse = await callAI(lessonPrompt, 3, 3000, 800);
        const lessonData = JSON.parse(extractJSON(lessonResponse));
        modules[mIdx].lessons[lIdx] = {
          title: lessonTitle,
          type: 'text',
          content: lessonData.content || lessonTitle,
          duration: lessonData.duration || 10,
        };
        await delay(4000);
      }
    }

    // STEP 4: Generate EACH QUIZ individually (one per module) - MINIMAL
    for (let mIdx = 0; mIdx < modules.length; mIdx++) {
      onStatusUpdate?.(`Creating quiz: ${modules[mIdx].title}...`);

      const questions: any[] = [];
      const questionsPerCall = Math.min(quizQuestionsCount, provider === 'ollama' ? 1 : 3);
      
      if (provider === 'ollama') {
        // For Ollama, generate questions one by one for maximum reliability
        for (let qIdx = 0; qIdx < quizQuestionsCount; qIdx++) {
          onStatusUpdate?.(`Creating quiz question ${qIdx + 1}/${quizQuestionsCount} for ${modules[mIdx].title}...`);
          
          const quizPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. Generate 1 multiple-choice quiz question on "${modules[mIdx].title}".
          Output format: {"question": "Q?", "options": ["A", "B", "C", "D"], "correctAnswer": 0}`;

          try {
            const quizResponse = await callAI(quizPrompt, 2, 2000, 600);
            const questionData = JSON.parse(extractJSON(quizResponse));
            if (questionData && questionData.question) {
              questions.push(questionData);
            }
          } catch (e) {
            console.error(`Failed to generate quiz question ${qIdx + 1}:`, e);
          }
          await delay(2000);
        }
      } else {
        // For OpenRouter, batch a few together
        const quizPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. ${questionsPerCall} short quiz questions on "${modules[mIdx].title}".
        Keep answers brief (1-3 words max). Output format: [{"question": "Q?", "options": ["A", "B", "C", "D"], "correctAnswer": 0}]`;

        const quizResponse = await callAI(quizPrompt, 3, 3000, 1000);
        const quizData = JSON.parse(extractJSON(quizResponse));
        if (Array.isArray(quizData)) {
          questions.push(...quizData);
        } else if (quizData && typeof quizData === 'object') {
          questions.push(quizData);
        }
      }

      modules[mIdx].lessons.push({
        title: `${modules[mIdx].title} Quiz`,
        type: 'quiz',
        content: questions,
        duration: questions.length * 2,
      });
      await delay(3000);
    }

    // STEP 5: Generate flashcards separately if needed - MINIMAL
    if (contentType.includes('flashcard')) {
      onStatusUpdate?.('Generating flashcards...');
      
      const flashcards: any[] = [];
      
      if (provider === 'ollama') {
        // Generate flashcards one by one for Ollama
        const count = Math.min(flashcardLimit, 10); // Keep it reasonable
        for (let i = 0; i < count; i++) {
          onStatusUpdate?.(`Creating flashcard ${i + 1}/${count} for ${title}...`);
          const flashcardPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. Generate 1 flashcard (Q&A pair) for "${title}".
          Output format: {"front": "Question?", "back": "Answer"}`;

          try {
            const flashcardResponse = await callAI(flashcardPrompt, 2, 2000, 500);
            const cardData = JSON.parse(extractJSON(flashcardResponse));
            if (cardData && cardData.front) {
              flashcards.push(cardData);
            }
          } catch (e) {
            console.error(`Failed to generate flashcard ${i + 1}:`, e);
          }
          await delay(2000);
        }
      } else {
        const flashcardPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. ${flashcardLimit} flashcard pairs for "${title}". Short Q&A format.
        Output format: [{"front": "Q?", "back": "A?"}]`;

        const flashcardResponse = await callAI(flashcardPrompt, 3, 3000, 900);
        const flashcardData = JSON.parse(extractJSON(flashcardResponse));
        if (Array.isArray(flashcardData)) {
          flashcards.push(...flashcardData);
        }
      }

      modules.push({
        title: 'Flashcards',
        description: 'Quick reference cards',
        lessons: [{
          title: 'Key Terms',
          type: 'flashcard',
          content: flashcards,
          duration: flashcards.length,
        }],
      });
      await delay(4000);
    }

    // STEP 6: Compile final response
    onStatusUpdate?.('Finalizing course...');
    const courseContent = {
      title,
      description: descData.description || `Learn ${title}`,
      modules: modules.map((m: any, idx: number) => ({
        id: `m${idx + 1}`,
        title: m.title,
        description: m.description,
        lessons: (m.lessons || []).map((l: any, lidx: number) => ({
          id: `l${lidx + 1}`,
          title: l.title,
          type: l.type || 'text',
          content: Array.isArray(l.content) ? l.content : [{ title: l.title, type: l.type, content: l.content }],
          duration: l.duration || 10,
          islocked: false,
        })),
      })),
    };

    return courseContent;
  } catch (error) {
    console.error('Error in chunked generation:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    const providerName = provider === 'ollama' ? 'Ollama' : 'OpenRouter';
    if (errorMsg.includes('TRUNCATED')) {
      throw new Error(`${providerName}: Content too long. Use Gemini or try shorter course.`);
    }
    if (errorMsg.includes('EMPTY')) {
      throw new Error(`${providerName}: Empty response. Try again or switch provider.`);
    }
    throw new Error(`${providerName} generation failed: ${errorMsg}`);
  }
};

/**
 * Generate course content - optimized for Gemini, OpenRouter, and Ollama
 * For OpenRouter and Ollama (free tier/local with rate limits), breaks down into smaller API calls
 * For Gemini, uses single large call for efficiency
 */
export const generateCourseContent = async (title: string, options: { modulesCount?: number, lessonsPerModule?: number, difficulty?: string, contentType?: string, additionalPrompt?: string, quizQuestionsCount?: number, flashcardLimit?: number, modelName?: string, provider?: string, onStatusUpdate?: (status: string) => void } = {}) => {
  const { modulesCount = 3, lessonsPerModule = 3, difficulty = 'beginner', contentType = 'text', additionalPrompt = '', quizQuestionsCount = 5, flashcardLimit = 15, modelName = DEFAULT_MODEL_NAME, provider = 'gemini', onStatusUpdate } = options;

  // For OpenRouter and Ollama, use chunked generation to avoid rate limits
  if (provider === 'openrouter' || provider === 'ollama') {
    return generateCourseContentChunked(title, { modulesCount, lessonsPerModule, difficulty, contentType, additionalPrompt, quizQuestionsCount, flashcardLimit, modelName, provider, onStatusUpdate });
  }

  const includesFlashcards = contentType?.includes('flashcard');
  const flashcardCount = includesFlashcards ? flashcardLimit : 0;

  const prompt = `
    You are an expert in creating educational content. Your task is to generate a course structure for a course titled "${title}".
    The course should have exactly ${modulesCount} modules and each module should have exactly ${lessonsPerModule} lessons.
    IMPORTANT: In each module, the last lesson MUST be a separate "quiz" type lesson (not embedded in another lesson) that covers the content of all preceding lessons in that module. 
    For example, if lessonsPerModule is 4, then lessons 1, 2, and 3 should be "text" or "video" content, and lesson 4 MUST be a standalone "quiz" lesson.
    The "quiz" lesson should contain exactly ${quizQuestionsCount} questions.
    Difficulty Level: ${difficulty}
    Primary Content Style: ${contentType}
    ${additionalPrompt ? `Additional Instructions: ${additionalPrompt}` : ''}
    
    For each lesson, provide a title, a short content description, and a duration in minutes.
    The output should be a JSON object with the following keys:
    - "title": A refined version of the course title
    - "description": A comprehensive course description
    - "modules": An array of module objects.
    Each module object should have "id" (e.g. "m1", "m2"), "title", and "lessons" properties.
    The "lessons" property should be an array of lesson objects, each with:
    - "id" (e.g. "l1", "l2")
    - "title"
    - "type": set to a primary type like "text", "quiz", "video", or "flashcard".
    - "content": This must be an array of ContentBlock objects. 
        - For a "quiz" type lesson, the content array should contain exactly ONE ContentBlock of type "quiz".
        - For a "flashcard" type lesson, the content array should contain exactly ONE ContentBlock of type "flashcard".
        - For other types, it should contain one or more ContentBlocks.
    Each ContentBlock should have:
        - "id": a valid UUID (e.g. "550e8400-e29b-41d4-a716-446655440000"). IMPORTANT: Generate proper UUIDs, NOT simple strings like "c1" or "m1".
        - "type": "text", "video", "quiz", or "flashcard".
        - "title": A title for this block.
        - "content": 
            - For "text" type: A string of well-formatted HTML content.
                - Use <h2> for main headings and <h3> for sub-headings.
                - ALWAYS wrap headings in <strong> tags or use <h2>/<h3> to make them bold.
                - Use <p> tags for paragraphs and ENSURE there is proper vertical spacing between them (add <br/> between <p> tags).
                - Use <ul> and <li> for bullet points.
                - Occasionally include a well-formatted HTML <table> with <thead>, <tbody>, <tr>, <th>, and <td> tags to present structured or comparative data when appropriate.
                - If you mention a concept that would benefit from a video, you can include a descriptive YouTube search link or a placeholder like "https://www.youtube.com/results?search_query=topic+tutorial".
            - For "video" type: A descriptive summary of what the video should cover.
            - For "quiz" type: An empty string (data will be in the data property).
            - For "flashcard" type: An empty string (data will be in the data property).
        - "url": 
            - For "video" type: Provide a HIGHLY RELEVANT YouTube video URL if you know one (e.g., from a reputable educational channel), OR a specific YouTube search URL (e.g., "https://www.youtube.com/results?search_query=how+to+use+autocad+layers").
            - For other types: Leave empty or provide a relevant resource link.
        - "data": 
            - For "quiz" type: An object with "questions" (array of question objects), "duration" (minutes), and "passingScore" (percentage).
            - Each question object in "questions" should have: "id" (number), "question" (string), "type" ("multiple-choice"), "options" (array of strings), "correctAnswer" (index number), and "explanation" (string).
            - For "flashcard" type: An object with "flashcards" (array of flashcard objects) and "totalCards" (count).
            - Each flashcard object should have: "front" (string with question/prompt), "back" (string with answer/explanation), and "difficulty" (one of: "easy", "medium", "hard").
        - "description": A short summary of this block.
    - "duration_minutes" (integer)
    - "islocked": false
    
    ${includesFlashcards ? `
    FLASHCARD GENERATION INSTRUCTIONS:
    - When generating flashcard content blocks, create exactly ${flashcardCount} flashcard items.
    - Most items should be standard flashcards (type: "card").
    - Occasionally (every 5-7 cards), include a "quiz" type item to test knowledge.
    - For "card" type:
        - Front side: Questions, prompts, or concepts to learn
        - Back side: Complete answers, explanations, or definitions
    - For "quiz" type:
        - Front side: A multiple-choice question
        - Back side: The correct answer text
        - Include "quiz_data" with "options" (array of 4 strings), "correct_answer" (index), and "explanation".
    - Mix difficulty levels (easy, medium, hard) naturally based on topic complexity.
    - Make flashcards practical and suitable for spaced repetition learning.
    ` : ''}
    
    Ensure the "text" content is comprehensive and educational.
    Do not include any markdown formatting or extra text outside the JSON.
  `;

  try {
    let text: string;

    if (provider === 'openrouter') {
      text = await callOpenRouterAPI(prompt, modelName, 4, 3000);
    } else {
      onStatusUpdate?.('📚 Generating course structure with Gemini...');
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: API_VERSION });
      const result = await retryWithBackoff(async () => {
        const response = await model.generateContent(prompt);
        return response;
      }, 4, 3000); // 4 retries, starting with 3 second delay for better 503 handling

      onStatusUpdate?.('📖 Processing response...');
      const response = await result.response;
      text = await response.text();
    }

    // Clean the response to ensure it's valid JSON
    onStatusUpdate?.('📝 Parsing and validating JSON...');
    let cleanedText = text.trim();

    // Remove markdown code blocks if present
    if (cleanedText.includes('```json')) {
      cleanedText = cleanedText.split('```json')[1].split('```')[0].trim();
    } else if (cleanedText.includes('```')) {
      cleanedText = cleanedText.split('```')[1].split('```')[0].trim();
    }

    // Attempt to find the first '{' and last '}' to extract the JSON object
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }

    // Fix common JSON issues like bad escapes
    // Replace single backslashes that aren't followed by a valid escape character
    // This is a common issue with AI output
    cleanedText = cleanedText.replace(/\\([^"\\\/bfnrtu])/g, '$1');

    const generated = JSON.parse(cleanedText);

    // Clean up any HTML tags in titles
    onStatusUpdate?.('📄 Cleaning up content...');
    const cleanedGenerated = cleanAIGeneratedContent(generated);

    const moduleCount = cleanedGenerated.modules?.length || 0;
    const lessonCount = cleanedGenerated.modules?.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0) || 0;
    onStatusUpdate?.(`✅ Course ready: ${moduleCount} modules, ${lessonCount} lessons`);
    return cleanedGenerated;
  } catch (error) {
    console.error("Error generating course content:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    const is503 = errorMsg.includes('503') || errorMsg.includes('overloaded') || errorMsg.includes('busy');
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit');
    const isAuthError = errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('authentication') || errorMsg.includes('API key');
    const isModelError = errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('model not found');
    const isJsonError = errorMsg.includes('JSON') || errorMsg.includes('no choices');

    let message = "Failed to generate course content from AI.";

    if (provider === 'openrouter') {
      if (isAuthError) {
        message = "❌ OpenRouter authentication failed. Check your API key configuration. For local development, set VITE_OPENROUTER_API_KEY in .env.local. For production deployment (Netlify/Vercel), set the environment variable in your hosting platform dashboard.";
      } else if (isModelError) {
        message = "❌ OpenRouter model not available. Try switching to a different model from the dropdown.";
      } else if (isRateLimit || is503) {
        message = "⏳ OpenRouter is busy right now. Try again in a moment or switch to Google Gemini.";
      } else if (isJsonError) {
        message = "❌ OpenRouter returned an unexpected response format. Check the browser console for details.";
      } else {
        message = `OpenRouter error: ${errorMsg.substring(0, 100)}`;
      }
    } else {
      if (isAuthError) {
        message = "❌ Google API key is invalid. Check your VITE_GEMINI_API_KEY in .env.local";
      } else if (is503) {
        message = "⏳ Google AI service is temporarily overloaded. Try again in a few moments or switch to OpenRouter.";
      } else if (isRateLimit) {
        message = "⏳ Google AI rate limit reached. Try switching to OpenRouter.";
      }
    }

    throw new Error(message);
  }
};

export interface AIGenerationOptions {
  tone?: 'formal' | 'casual' | 'professional' | 'conversational';
  length?: 'short' | 'medium' | 'long';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  includeExamples?: boolean;
  includeSummary?: boolean;
  type?: string;
  topic?: string;
  count?: number;
  includeExplanations?: boolean;
  language?: string;
}

export const generateLessonContent = async (
  lessonTitle: string,
  courseTitle?: string,
  options: AIGenerationOptions = {}
) => {
  const modelName = (options as any).modelName || DEFAULT_MODEL_NAME;
  const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: API_VERSION });

  const {
    tone = 'professional',
    length = 'medium',
    difficulty = 'intermediate',
    includeExamples = true,
    includeSummary = true,
  } = options;

  const lengthGuidance = {
    short: '200-300 words',
    medium: '400-600 words',
    long: '800-1000 words',
  };

  const prompt = `
    You are an expert educational content creator. Generate high-quality lesson content for the following:
    
    Lesson Title: "${lessonTitle}"
    ${courseTitle ? `Course Title: "${courseTitle}"` : ''}
    
    Requirements:
    - Tone: ${tone}
    - Length: ${lengthGuidance[length]}
    - Difficulty Level: ${difficulty}
    - Include practical examples: ${includeExamples ? 'Yes' : 'No'}
    - Include a summary: ${includeSummary ? 'Yes' : 'No'}
    
    Create engaging, clear, and well-structured educational content that is appropriate for the specified difficulty level.
    - Use HTML tags for formatting.
    - Use <h2> or <h3> for headings and ALWAYS make them bold (e.g., <h2><strong>Heading</strong></h2>).
    - Use <p> tags for paragraphs and ENSURE there is proper vertical spacing between them (add <br/> between paragraphs if necessary).
    - Use <ul> and <li> for bullet points.
    - Occasionally include a well-formatted HTML <table> to present comparative or structured data if it adds value to the lesson.
    - Return only the HTML content string without any markdown code blocks or JSON.
  `;

  try {
    const result = await retryWithBackoff(async () => {
      const response = await model.generateContent(prompt);
      return response;
    }, 4, 3000); // 4 retries, starting with 3 second delay for better 503 handling

    const response = await result.response;
    const text = await response.text();

    return {
      content: text.trim(),
      success: true,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating lesson content:", error);
    const is503 = error instanceof Error && error.message.includes('503');
    const message = is503
      ? "Google AI service is temporarily overloaded. Please try again in a few moments."
      : "Failed to generate lesson content from AI.";
    throw new Error(message);
  }
};

export const generateTextVariation = async (
  existingContent: string,
  lessonTitle: string,
  variationType: 'shorter' | 'longer' | 'simpler' | 'more_detailed' | 'different_perspective' = 'different_perspective',
  modelName?: string
) => {
  const model = genAI.getGenerativeModel({ model: modelName || DEFAULT_MODEL_NAME }, { apiVersion: API_VERSION });

  const variationGuide = {
    shorter: 'Create a more concise version (reduce by 50%)',
    longer: 'Expand the content (increase by 50-100%)',
    simpler: 'Simplify the language for a beginner audience',
    more_detailed: 'Add more technical details and depth',
    different_perspective: 'Rewrite from a different angle or perspective',
  };

  const prompt = `
    You are an expert educational content creator. 
    
    Original Lesson Content for "${lessonTitle}":
    ${existingContent}
    
    Task: ${variationGuide[variationType]}
    
    Maintain the core concepts and educational value while making the requested change.
    - Use HTML tags for formatting (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <table>).
    - Ensure headings are bold and paragraphs have proper spacing.
    - Return only the modified HTML content string without any additional commentary or markdown code blocks.
  `;

  try {
    const result = await retryWithBackoff(async () => {
      const response = await model.generateContent(prompt);
      return response;
    }, 4, 3000); // 4 retries, starting with 3 second delay for better 503 handling

    const response = await result.response;
    const text = await response.text();

    return {
      content: text.trim(),
      success: true,
      variationType,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating text variation:", error);
    const is503 = error instanceof Error && error.message.includes('503');
    const message = is503
      ? "Google AI service is temporarily overloaded. Please try again in a few moments."
      : "Failed to generate text variation from AI.";
    throw new Error(message);
  }
};

export const generateQuizQuestions = async (
  lessonContent: string,
  lessonTitle: string,
  numberOfQuestions: number = 5,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  modelName?: string
) => {
  const model = genAI.getGenerativeModel({ model: modelName || DEFAULT_MODEL_NAME }, { apiVersion: API_VERSION });

  // Strip HTML tags from content for cleaner AI processing
  const stripHtml = (html: string) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  const cleanContent = stripHtml(lessonContent);

  const prompt = `
    You are an expert in creating educational assessments with high-quality multiple-choice questions.

    Based on this lesson content for "${lessonTitle}":
    ${cleanContent}

    Create ${numberOfQuestions} multiple-choice quiz questions with difficulty level: ${difficulty}

    CRITICAL REQUIREMENTS:
    1. Randomize the position of the correct answer (correctAnswer index should be 0, 1, 2, or 3 randomly)
    2. Do NOT always place correct answers at the same position
    3. Create plausible, realistic distractors (wrong answer options)
    4. Make questions clear and unambiguous

    ⚠️ TEXT LENGTH BALANCE (IMPORTANT FOR AVOIDING ANSWER HINTS):
    - ALL four options must have SIMILAR text length (within 5-15 words each)
    - Do NOT make the correct answer noticeably longer or shorter than wrong answers
    - Wrong answers should be as detailed and realistic as the correct answer
    - This prevents test-takers from guessing based on text length alone
    - Example GOOD: All options are 8-12 words
    - Example BAD: Correct = 20 words, Wrong = 5 words (gives away the answer)

    Format the response as a JSON array with the following structure for each question:
    {
      "question": "Question text here",
      "options": ["Option A (8-12 words)", "Option B (8-12 words)", "Option C (8-12 words)", "Option D (8-12 words)"],
      "correctAnswer": <number between 0-3>,
      "explanation": "Why this is the correct answer"
    }

    CHECKLIST before returning:
    ✓ All options are similar length
    ✓ Correct answer is NOT the longest or shortest option
    ✓ All options are plausible but only ONE is correct
    ✓ correctAnswer index varies (not always 0, 1, 2, or 3)

    Return ONLY valid JSON array, no other text.
  `;

  try {
    const result = await retryWithBackoff(async () => {
      const response = await model.generateContent(prompt);
      return response;
    }, 4, 3000); // 4 retries, starting with 3 second delay for better 503 handling

    const response = await result.response;
    const text = await response.text();

    // Clean the response to ensure it's valid JSON
    let cleanedText = text.trim();

    // Remove markdown code blocks if present
    if (cleanedText.includes('```json')) {
      cleanedText = cleanedText.split('```json')[1].split('```')[0].trim();
    } else if (cleanedText.includes('```')) {
      cleanedText = cleanedText.split('```')[1].split('```')[0].trim();
    }

    // Attempt to find the first '[' and last ']' to extract the JSON array
    const firstBrace = cleanedText.indexOf('[');
    const lastBrace = cleanedText.lastIndexOf(']');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }

    // Fix common JSON issues like bad escapes
    cleanedText = cleanedText.replace(/\\([^"\\\/bfnrtu])/g, '$1');

    let questions = JSON.parse(cleanedText);

    // Validate and log text length balance for each question
    questions = questions.map((question: any) => {
      const optionLengths = question.options.map((opt: string) => opt.split(' ').length);
      const maxLength = Math.max(...optionLengths);
      const minLength = Math.min(...optionLengths);
      const balance = maxLength - minLength;

      if (balance > 10) {
        console.warn(`⚠️ Question "${question.question.substring(0, 50)}..." has unbalanced option lengths:`, optionLengths, `(difference: ${balance} words)`);
      }

      return question;
    });

    return {
      questions,
      success: true,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating quiz questions:", error);
    const is503 = error instanceof Error && error.message.includes('503');
    const message = is503
      ? "Google AI service is temporarily overloaded. Please try again in a few moments."
      : "Failed to generate quiz questions from AI.";
    throw new Error(message);
  }
};

export const generateSkillsForCourse = async (
  courseTitle: string,
  courseDescription: string,
  category: string = '',
  level: string = 'beginner',
  existingFamilies: string[] = [],
  existingSkills: Array<{ name: string; family: string }> = [],
  modelName?: string
) => {
  const model = genAI.getGenerativeModel({ model: modelName || DEFAULT_MODEL_NAME }, { apiVersion: API_VERSION });

  const existingSkillsText = existingSkills.length > 0
    ? `\nExisting skills already in the system (reuse these by exact name when relevant):\n${existingSkills.map(s => `- "${s.name}" (family: ${s.family})`).join('\n')}\n`
    : '';

  const prompt = `
    You are an expert in identifying relevant professional skills for courses.

    Based on this course information:
    Title: ${courseTitle}
    Description: ${courseDescription}
    Category: ${category}
    Level: ${level}

    ${existingFamilies.length > 0 ? `Existing skill families in the system: ${existingFamilies.join(', ')}. Use these families when appropriate; only create a new family if none of the existing ones fit.` : ''}
    ${existingSkillsText}
    Suggest 5-8 relevant skills that students should develop by taking this course.
    Rules:
    - If an existing skill name matches what you would suggest, use that exact name and family.
    - Not all skills from a family need to be included — only suggest skills actually relevant to this course.
    - Skills should be specific and measurable.

    For each skill provide:
    1. Skill name (use exact existing name when reusing, otherwise specific and measurable)
    2. Skill family/category
    3. Brief description of what students will learn

    Return ONLY a valid JSON array, no other text:
    [{"name": "...", "family": "...", "description": "..."}]
  `;

  try {
    const result = await retryWithBackoff(async () => {
      const response = await model.generateContent(prompt);
      return response;
    }, 4, 3000); // 4 retries, starting with 3 second delay for better 503 handling

    const response = await result.response;
    const text = await response.text();

    // Clean the response to ensure it's valid JSON
    let cleanedText = text.trim();

    // Remove markdown code blocks if present
    if (cleanedText.includes('```json')) {
      cleanedText = cleanedText.split('```json')[1].split('```')[0].trim();
    } else if (cleanedText.includes('```')) {
      cleanedText = cleanedText.split('```')[1].split('```')[0].trim();
    }

    // Attempt to find the first '[' and last ']' to extract the JSON array
    const firstBrace = cleanedText.indexOf('[');
    const lastBrace = cleanedText.lastIndexOf(']');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }

    // Fix common JSON issues
    cleanedText = cleanedText.replace(/\\([^"\\\/bfnrtu])/g, '$1');

    const skills = JSON.parse(cleanedText);

    return {
      skills,
      success: true,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating skills for course:", error);
    const is503 = error instanceof Error && error.message.includes('503');
    const message = is503
      ? "Google AI service is temporarily overloaded. Please try again in a few moments."
      : "Failed to generate skills suggestions from AI.";
    throw new Error(message);
  }
};

export const generateFlashcardContent = async (
  options: AIGenerationOptions = {}
): Promise<Array<{ front: string; back: string }>> => {
  const modelName = (options as any).modelName || DEFAULT_MODEL_NAME;
  const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: API_VERSION });

  const {
    topic = '',
    count = 10,
    difficulty = 'intermediate',
    includeExplanations = true,
  } = options;

  if (!topic) {
    throw new Error('Topic is required for flashcard generation');
  }

  if (count < 1 || count > 50) {
    throw new Error('Card count must be between 1 and 50');
  }

  const difficultyMap = {
    beginner: 'simple and foundational',
    intermediate: 'moderately complex with practical applications',
    advanced: 'complex with in-depth technical details',
  };

  const prompt = `
    You are an expert educational content creator specializing in flashcard design.
    
    Create exactly ${count} flashcard pairs for the following topic:
    Topic: "${topic}"
    Difficulty Level: ${difficulty} (${difficultyMap[difficulty]})
    
    Each flashcard should have:
    - Front (question/prompt): Clear, concise, and focused on testing understanding
    - Back (answer/explanation): Accurate and informative${includeExplanations ? ', with a brief explanation when helpful' : ''
    }
    
    Requirements:
    1. Create exactly ${count} cards - no more, no less
    2. Vary the types of front content (definitions, problems, scenarios, concepts, etc.)
    3. Make backs concise but complete
    4. Ensure good balance between breadth and depth
    5. Avoid duplicates or similar questions
    6. Make them suitable for active learning and spaced repetition
    
    Format the response as a JSON array with this exact structure:
    [
      {
        "front": "Question or prompt here",
        "back": "Answer or explanation here"
      },
      ...
    ]
    
    Return ONLY the valid JSON array, no other text or markdown formatting.
  `;

  try {
    const result = await retryWithBackoff(async () => {
      const response = await model.generateContent(prompt);
      return response;
    }, 4, 3000); // 4 retries, starting with 3 second delay for better 503 handling

    const response = await result.response;
    const text = await response.text();

    // Clean the response to ensure it's valid JSON
    let cleanedText = text.trim();

    // Remove markdown code blocks if present
    if (cleanedText.includes('```json')) {
      cleanedText = cleanedText.split('```json')[1].split('```')[0].trim();
    } else if (cleanedText.includes('```')) {
      cleanedText = cleanedText.split('```')[1].split('```')[0].trim();
    }

    // Attempt to find the first '[' and last ']' to extract the JSON array
    const firstBrace = cleanedText.indexOf('[');
    const lastBrace = cleanedText.lastIndexOf(']');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }

    // Fix common JSON issues
    cleanedText = cleanedText.replace(/\\([^"\\\/bfnrtu])/g, '$1');

    const flashcards = JSON.parse(cleanedText);

    // Validate the result
    if (!Array.isArray(flashcards)) {
      throw new Error('Response is not an array');
    }

    if (flashcards.length !== count) {
      console.warn(
        `Generated ${flashcards.length} flashcards instead of ${count} requested`
      );
    }

    // Ensure each card has front and back
    const validatedFlashcards = flashcards.map((card: any) => ({
      front: String(card.front || '').trim(),
      back: String(card.back || '').trim(),
    }));

    return validatedFlashcards;
  } catch (error) {
    console.error('Error generating flashcards:', error);
    const is503 = error instanceof Error && error.message.includes('503');
    const message = is503
      ? "Google AI service is temporarily overloaded. Please try again in a few moments."
      : "Failed to generate flashcards from AI. Please try again.";
    throw new Error(message);
  }
};

export interface SurveyGenerationOptions {
  questionType?: 'text' | 'textarea' | 'radio' | 'checkbox' | 'likert' | 'matrix' | 'mixed';
  count?: number;
  modelName?: string;
  provider?: 'gemini' | 'openrouter' | 'ollama';
  onStatusUpdate?: (status: string) => void;
}

export const generateSurveyContent = async (
  title: string,
  description: string,
  options: SurveyGenerationOptions = {}
) => {
  const {
    questionType = 'radio',
    count = 5,
    modelName = DEFAULT_MODEL_NAME,
    provider = 'gemini',
    onStatusUpdate,
  } = options;

  // Allow more questions - chunked generation for smaller models
  const maxQuestionsPerProvider = provider === 'gemini' ? 30 : 15;
  const normalizedCount = Math.max(1, Math.min(count, maxQuestionsPerProvider));
  const likertOptions = [
    'Strongly disagree',
    'Disagree',
    'Neutral',
    'Agree',
    'Strongly agree',
  ];

  // Simplify prompt for smaller models - use only radio or text questions
  const simplifiedType = (questionType === 'matrix' || questionType === 'mixed' || questionType === 'checkbox') ? 'radio' : questionType;

  const prompt = `Survey title: "${title}"
Description: "${description}"
Generate exactly ${normalizedCount} ${simplifiedType} questions.
Return ONLY valid JSON. NO PREAMBLE. NO MARKDOWN BLOCKS.
Expected format:
{"title": "${title}", "description": "${description}", "questions": [{"id": "q1", "label": "Question text?", "type": "${simplifiedType}", "options": ["Option A", "Option B", "Option C"]}]}
Rules:
1. Return ONLY the JSON object.
2. 3-4 options per question.
3. Keep labels short and concise.`;

  const callAI = async (promptText: string) => {
    if (provider === 'openrouter') {
      onStatusUpdate?.('Calling OpenRouter AI...');
      // Use generous token limit for JSON generation - truncation fix handles retries
      return callOpenRouterAPI(promptText, modelName, 4, 3000, 1000);
    }

    if (provider === 'ollama') {
      onStatusUpdate?.('Calling Ollama AI...');
      return callOllamaAPI(promptText, modelName, 4, 3000, 1000);
    }

    onStatusUpdate?.('Calling Gemini AI...');
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: API_VERSION });
    const result = await retryWithBackoff(async () => {
      const response = await model.generateContent(promptText);
      return response;
    }, 4, 3000);

    const response = await result.response;
    return response.text();
  };

  try {
    onStatusUpdate?.('Generating survey content...');

    // Use chunked generation for smaller models
    let allQuestions: any[] = [];
    if (provider !== 'gemini' && normalizedCount > 3) {
      // Generate in chunks of 3 for smaller models
      const questionsPerChunk = 3;
      const chunks = Math.ceil(normalizedCount / questionsPerChunk);

      for (let chunk = 0; chunk < chunks; chunk++) {
        const chunkSize = Math.min(questionsPerChunk, normalizedCount - (chunk * questionsPerChunk));
        onStatusUpdate?.(`Generating ${chunkSize} questions (${chunk + 1}/${chunks})...`);

        const chunkPrompt = `Survey: "${title}"
Description: "${description}"
Generate exactly ${chunkSize} ${simplifiedType} questions for part ${chunk + 1}.
Return ONLY valid JSON. NO PREAMBLE. NO MARKDOWN BLOCKS.
Expected format:
{"questions": [{"id": "q${chunk * 3 + 1}", "label": "Question?", "type": "${simplifiedType}", "options": ["A", "B", "C"]}]}`;

        try {
          const text = await callAI(chunkPrompt);
          const jsonText = extractJSON(text);
          const chunkData = JSON.parse(jsonText);
          if (Array.isArray(chunkData.questions)) {
            allQuestions = allQuestions.concat(chunkData.questions);
          } else {
            console.warn(`Chunk ${chunk + 1} did not return questions array:`, chunkData);
          }
        } catch (chunkError) {
          console.warn(`Chunk ${chunk + 1} generation failed:`, chunkError);
          // Continue to next chunk on error
        }

        if (chunk < chunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between chunks
        }
      }

      if (allQuestions.length === 0) {
        onStatusUpdate?.('No valid chunked survey questions; retrying with a full request...');
        try {
          const text = await callAI(prompt);
          const jsonText = extractJSON(text);
          const generated = JSON.parse(jsonText);
          if (Array.isArray(generated.questions)) {
            allQuestions = generated.questions;
          } else {
            console.warn('Full request did not return questions array:', generated);
          }
        } catch (retryError) {
          console.warn('Full request retry failed:', retryError);
        }
      }
    } else {
      // Single call for Gemini
      let text = await callAI(prompt);
      let jsonText = extractJSON(text);

      if (!jsonText.trim().startsWith('{')) {
        const first = jsonText.indexOf('{');
        const last = jsonText.lastIndexOf('}');
        if (first !== -1 && last > first) {
          jsonText = jsonText.substring(first, last + 1);
        }
      }

      const generated = JSON.parse(jsonText);
      allQuestions = Array.isArray(generated.questions) ? generated.questions : [];
    }

    if (allQuestions.length === 0) {
      throw new Error('No questions generated from AI');
    }

    const questions = allQuestions.slice(0, normalizedCount);
    const normalizedQuestions = questions.map((question: any, index: number) => {
      const id = question.id || `q${index + 1}`;
      const rawType = String(question.type || '').trim().toLowerCase();
      const isValidType = ['text', 'textarea', 'radio', 'checkbox', 'likert', 'matrix'].includes(rawType);
      const type = isValidType
        ? (rawType as 'text' | 'textarea' | 'radio' | 'checkbox' | 'likert' | 'matrix')
        : questionType === 'mixed'
          ? Array.isArray(question.rows) && question.rows.length && Array.isArray(question.columns) && question.columns.length
            ? 'matrix'
            : Array.isArray(question.options) && question.options.length
              ? 'radio'
              : 'text'
          : questionType;
      const label = String(question.label || question.prompt || `Question ${index + 1}`).trim();
      const options = Array.isArray(question.options)
        ? question.options.map((opt: any) => String(opt || '').trim()).filter(Boolean)
        : type === 'likert'
          ? likertOptions
          : [];
      const rows = Array.isArray(question.rows)
        ? question.rows.map((row: any) => String(row || '').trim()).filter(Boolean)
        : [];
      const columns = Array.isArray(question.columns)
        ? question.columns.map((column: any) => String(column || '').trim()).filter(Boolean)
        : [];

      return {
        id,
        label,
        type,
        options,
        rows,
        columns,
      };
    });

    return {
      title: title.trim(),
      description: description.trim(),
      questions: normalizedQuestions,
    };
  } catch (error) {
    console.error('Error generating survey content:', error);
    const message = error instanceof Error ? error.message : String(error);

    // Fallback: Use pre-built template questions if AI generation fails or returns no valid output
    if (
      message.includes('TRUNCATED') ||
      message.includes('too complex') ||
      message.includes('No questions generated') ||
      message.includes('Invalid response format') ||
      message.includes('No valid') ||
      message.includes('EMPTY_RESPONSE')
    ) {
      console.warn('AI generation failed, using fallback template...');
      const templates: Record<string, any[]> = {
        radio: [
          { id: 'q1', label: `How satisfied are you with "${title}"?`, type: 'radio', options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'] },
          { id: 'q2', label: 'Would you recommend this?', type: 'radio', options: ['Highly Likely', 'Likely', 'Unlikely', 'Very Unlikely'] },
          { id: 'q3', label: 'How was your experience?', type: 'radio', options: ['Excellent', 'Good', 'Average', 'Poor'] },
        ],
        text: [
          { id: 'q1', label: `What is your feedback on "${title}"?`, type: 'text', options: [] },
          { id: 'q2', label: 'What could be improved?', type: 'text', options: [] },
          { id: 'q3', label: 'Additional comments?', type: 'text', options: [] },
        ],
        likert: [
          { id: 'q1', label: `I found "${title}" valuable.`, type: 'likert', options: likertOptions },
          { id: 'q2', label: 'The content was clear and easy to understand.', type: 'likert', options: likertOptions },
          { id: 'q3', label: 'I would use this again.', type: 'likert', options: likertOptions },
        ],
      };

      const templateQuestions = templates[simplifiedType] || templates.radio;
      return {
        title: title.trim(),
        description: description.trim(),
        questions: templateQuestions.slice(0, normalizedCount),
      };
    }

    throw new Error(`AI survey generation failed: ${message}`);
  }
};
