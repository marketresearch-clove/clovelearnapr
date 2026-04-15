import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const openrouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
const genAI = new GoogleGenerativeAI(geminiApiKey);
const DEFAULT_MODEL_NAME = "gemini-2.5-flash";
const DEFAULT_OPENROUTER_MODEL = "google/gemma-4-31b"; // More reliable than Nemotron
const API_VERSION = "v1beta";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Extract JSON from text that may contain preamble or extra text
 * Handles responses like "Okay, I'll...\n{json here}"
 * Also attempts to fix malformed JSON
 */
const extractJSON = (text: string): string => {
  // Try to find JSON object (starts with {)
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    let json = jsonObjectMatch[0];
    // Try to fix common JSON issues
    json = json.replace(/,\s*}/, '}'); // Remove trailing commas
    json = json.replace(/,\s*]/, ']'); // Remove trailing commas in arrays
    return json;
  }

  // Try to find JSON array (starts with [)
  const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    let json = jsonArrayMatch[0];
    // Try to fix common JSON issues
    json = json.replace(/,\s*}/, '}');
    json = json.replace(/,\s*]/, ']');
    return json;
  }

  // If no JSON found, return original text
  return text;
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

      // Check if it's a retryable error (503, 429, network errors, etc.)
      const isRetryable = error instanceof Error && (
        error.message.includes('503') ||
        error.message.includes('429') ||
        error.message.includes('502') ||
        error.message.includes('500') ||
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('high demand') ||
        error.message.includes('temporarily unavailable') ||
        error.message.includes('overloaded')
      );

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`AI API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

/**
 * Call OpenRouter API with retry logic
 * Uses smaller max_tokens and delays to avoid truncation
 */
const callOpenRouterAPI = async (
  prompt: string,
  modelName: string = DEFAULT_OPENROUTER_MODEL,
  maxRetries: number = 3,
  baseDelay: number = 3000,
  maxTokens: number = 600
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
    const content = choice?.message?.content;

    // Check if response was truncated (finish_reason: 'length')
    if (choice?.finish_reason === 'length') {
      console.warn('⚠️ OpenRouter response truncated (finish_reason: length)');
      lastTruncationError = 'Token limit reached';

      // Retry with smaller token limit
      if (currentMaxTokens > 300) {
        currentMaxTokens = Math.max(300, Math.floor(currentMaxTokens * 0.7));
        console.log(`Retrying with reduced maxTokens: ${currentMaxTokens}`);
        throw new Error('TRUNCATED_RETRY');
      } else {
        // Already at minimum, give up
        throw new Error(`TRUNCATED_FAILED: Even with ${currentMaxTokens} tokens, response truncated. Prompt too complex.`);
      }
    }

    if (!content || content.trim().length === 0) {
      console.error('No content in OpenRouter response:', choice);
      throw new Error('EMPTY_RESPONSE');
    }

    return content;
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
 * Generate course content in TRUE granular chunks - optimized for OpenRouter free tier
 * ONE API CALL = ONE CONTENT TYPE ONLY
 * Avoids token limits and truncation issues
 */
const generateCourseContentChunked = async (
  title: string,
  options: any
): Promise<any> => {
  const { modulesCount = 3, lessonsPerModule = 3, difficulty = 'beginner', contentType = 'text', additionalPrompt = '', quizQuestionsCount = 5, flashcardLimit = 15, modelName, onStatusUpdate } = options;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // STEP 1: Generate course outline ONLY (modules + lesson titles) - MINIMAL
    onStatusUpdate?.('Generating course structure...');
    const outlinePrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. Create outline for "${title}" (${modulesCount} modules, ${lessonsPerModule} lessons each).
    Output format: {"modules": [{"title": "Module Title", "lessons": ["Lesson 1", "Lesson 2"]}]}`;

    const outlineResponse = await callOpenRouterAPI(outlinePrompt, modelName, 4, 4000, 1200);
    const outline = JSON.parse(extractJSON(outlineResponse));
    await delay(5000);

    // STEP 2: Generate course description - MINIMAL
    onStatusUpdate?.('Creating description...');
    const descPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. 1-sentence description of "${title}". Output format: {"description": "..."}`;
    const descResponse = await callOpenRouterAPI(descPrompt, modelName, 3, 3000, 500);
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

        const lessonResponse = await callOpenRouterAPI(lessonPrompt, modelName, 3, 3000, 800);
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

      const quizPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. ${quizQuestionsCount} short quiz questions on "${modules[mIdx].title}".
      Balance option lengths. Output format: [{"question": "Q?", "options": ["A", "B", "C", "D"], "correctAnswer": 0}]`;

      const quizResponse = await callOpenRouterAPI(quizPrompt, modelName, 3, 3000, 1000);
      const quizData = JSON.parse(extractJSON(quizResponse));
      modules[mIdx].lessons.push({
        title: `${modules[mIdx].title} Quiz`,
        type: 'quiz',
        content: quizData || [],
        duration: quizQuestionsCount * 2,
      });
      await delay(4000);
    }

    // STEP 5: Generate flashcards separately if needed - MINIMAL
    if (contentType.includes('flashcard')) {
      onStatusUpdate?.('Generating flashcards...');
      const flashcardPrompt = `RESPOND WITH ONLY VALID JSON. NO PREAMBLE. ${flashcardLimit} flashcard pairs for "${title}". Short Q&A format.
      Output format: [{"front": "Q?", "back": "A?"}]`;

      const flashcardResponse = await callOpenRouterAPI(flashcardPrompt, modelName, 3, 3000, 900);
      const flashcards = JSON.parse(extractJSON(flashcardResponse));
      modules.push({
        title: 'Flashcards',
        description: 'Quick reference cards',
        lessons: [{
          title: 'Key Terms',
          type: 'flashcard',
          content: flashcards || [],
          duration: flashcardLimit,
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
    if (errorMsg.includes('TRUNCATED')) {
      throw new Error('OpenRouter: Content too long. Use Gemini or try shorter course.');
    }
    if (errorMsg.includes('EMPTY')) {
      throw new Error('OpenRouter: Empty response. Try again or switch provider.');
    }
    throw new Error(`OpenRouter generation failed: ${errorMsg}`);
  }
};

/**
 * Generate course content - optimized for both Gemini and OpenRouter
 * For OpenRouter (free tier with rate limits), breaks down into smaller API calls
 * For Gemini, uses single large call for efficiency
 */
export const generateCourseContent = async (title: string, options: { modulesCount?: number, lessonsPerModule?: number, difficulty?: string, contentType?: string, additionalPrompt?: string, quizQuestionsCount?: number, flashcardLimit?: number, modelName?: string, provider?: string, onStatusUpdate?: (status: string) => void } = {}) => {
  const { modulesCount = 3, lessonsPerModule = 3, difficulty = 'beginner', contentType = 'text', additionalPrompt = '', quizQuestionsCount = 5, flashcardLimit = 15, modelName = DEFAULT_MODEL_NAME, provider = 'gemini', onStatusUpdate } = options;

  // For OpenRouter free tier, use chunked generation to avoid rate limits
  if (provider === 'openrouter') {
    return generateCourseContentChunked(title, { modulesCount, lessonsPerModule, difficulty, contentType, additionalPrompt, quizQuestionsCount, flashcardLimit, modelName, onStatusUpdate });
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
