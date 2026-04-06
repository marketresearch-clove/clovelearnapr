import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const MODEL_NAME = "gemini-2.5-flash";
const API_VERSION = "v1beta";

export const generateCourseContent = async (title: string, options: { modulesCount?: number, lessonsPerModule?: number, difficulty?: string, contentType?: string, additionalPrompt?: string, quizQuestionsCount?: number, flashcardLimit?: number } = {}) => {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, { apiVersion: API_VERSION });
  const { modulesCount = 3, lessonsPerModule = 3, difficulty = 'beginner', contentType = 'text', additionalPrompt = '', quizQuestionsCount = 5, flashcardLimit = 15 } = options;

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
    const result = await model.generateContent(prompt);
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
    return generated;
  } catch (error) {
    console.error("Error generating course content:", error);
    throw new Error("Failed to generate course content from AI.");
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
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, { apiVersion: API_VERSION });

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
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    return {
      content: text.trim(),
      success: true,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating lesson content:", error);
    throw new Error("Failed to generate lesson content from AI.");
  }
};

export const generateTextVariation = async (
  existingContent: string,
  lessonTitle: string,
  variationType: 'shorter' | 'longer' | 'simpler' | 'more_detailed' | 'different_perspective' = 'different_perspective'
) => {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, { apiVersion: API_VERSION });

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
    const result = await model.generateContent(prompt);
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
    throw new Error("Failed to generate text variation from AI.");
  }
};

export const generateQuizQuestions = async (
  lessonContent: string,
  lessonTitle: string,
  numberOfQuestions: number = 5,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
) => {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, { apiVersion: API_VERSION });

  const prompt = `
    You are an expert in creating educational assessments.
    
    Based on this lesson content for "${lessonTitle}":
    ${lessonContent}
    
    Create ${numberOfQuestions} multiple-choice quiz questions with difficulty level: ${difficulty}
    
    Format the response as a JSON array with the following structure for each question:
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is the correct answer"
    }
    
    Return ONLY valid JSON array, no other text.
  `;

  try {
    const result = await model.generateContent(prompt);
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

    const questions = JSON.parse(cleanedText);

    return {
      questions,
      success: true,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating quiz questions:", error);
    throw new Error("Failed to generate quiz questions from AI.");
  }
};

export const generateSkillsForCourse = async (
  courseTitle: string,
  courseDescription: string,
  category: string = '',
  level: string = 'beginner',
  existingFamilies: string[] = [],
  existingSkills: Array<{ name: string; family: string }> = []
) => {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, { apiVersion: API_VERSION });

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
    const result = await model.generateContent(prompt);
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
    throw new Error("Failed to generate skills suggestions from AI.");
  }
};

export const generateFlashcardContent = async (
  options: AIGenerationOptions = {}
): Promise<Array<{ front: string; back: string }>> => {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, { apiVersion: API_VERSION });

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
    const result = await model.generateContent(prompt);
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
    throw new Error('Failed to generate flashcards from AI. Please try again.');
  }
};
