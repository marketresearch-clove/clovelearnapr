/**
 * Content Utility Functions
 * Handles HTML sanitization, shuffling, and formatting for lesson content
 */

/**
 * Strip HTML tags from a string for display purposes
 * Removes all HTML tags but preserves the text content
 */
export const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
};

/**
 * Clean and extract first N characters of HTML content for preview
 * Removes HTML tags and truncates to specified length
 */
export const getHtmlPreview = (html: string, length: number = 150): string => {
    const plainText = stripHtmlTags(html);
    if (plainText.length > length) {
        return plainText.substring(0, length) + '...';
    }
    return plainText;
};

/**
 * Sanitize HTML content by removing potentially harmful tags
 * Allows safe formatting tags like h2, h3, p, strong, ul, li, br, table, etc.
 */
export const sanitizeHtml = (html: string): string => {
    if (!html) return '';

    // Create a temporary element
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // List of allowed tags
    const allowedTags = ['h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'span', 'div', 'blockquote', 'code', 'pre'];

    // Remove disallowed tags
    const walker = document.createTreeWalker(
        temp,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
    );

    const nodesToRemove: Node[] = [];
    let currentNode = walker.nextNode();

    while (currentNode) {
        const tagName = (currentNode as Element).tagName.toLowerCase();
        if (!allowedTags.includes(tagName)) {
            // Keep the content but remove the tag
            const fragment = document.createDocumentFragment();
            while (currentNode.firstChild) {
                fragment.appendChild(currentNode.firstChild);
            }
            (currentNode as Element).parentNode?.replaceChild(fragment, currentNode);
        }
        currentNode = walker.nextNode();
    }

    return temp.innerHTML;
};

/**
 * Shuffle an array while tracking index changes
 * Useful for randomizing quiz options while maintaining correct answer tracking
 */
export interface ShuffleResult {
    items: string[];
    oldIndexOfCorrect: number; // The original index of the correct answer
    newIndexOfCorrect: number; // The new index of the correct answer after shuffle
}

export const shuffleQuizOptions = (
    options: string[],
    correctAnswerIndex: number
): ShuffleResult => {
    // Create array of indices
    const indices = Array.from({ length: options.length }, (_, i) => i);

    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Shuffle options based on indices
    const shuffledOptions = indices.map(i => options[i]);

    // Find new position of correct answer
    const newCorrectIndex = indices.indexOf(correctAnswerIndex);

    return {
        items: shuffledOptions,
        oldIndexOfCorrect: correctAnswerIndex,
        newIndexOfCorrect: newCorrectIndex,
    };
};

/**
 * Shuffle multiple quiz questions with their options
 * Returns questions with shuffled options and updated correct answer indices
 */
export interface QuizQuestion {
    id: number;
    question: string;
    type: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
    hint?: string;
}

export const shuffleQuizQuestions = (questions: QuizQuestion[]): QuizQuestion[] => {
    return questions.map(question => {
        const shuffleResult = shuffleQuizOptions(question.options, question.correctAnswer);
        return {
            ...question,
            options: shuffleResult.items,
            correctAnswer: shuffleResult.newIndexOfCorrect,
        };
    });
};

/**
 * Extract plain text from HTML while preserving some structure
 * Useful for previews and summaries
 */
export const extractTextFromHtml = (html: string): string => {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Replace block-level elements with newlines
    const blockElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td'];
    blockElements.forEach(tag => {
        const elements = temp.getElementsByTagName(tag);
        for (let i = elements.length - 1; i >= 0; i--) {
            const element = elements[i];
            const text = element.textContent || '';
            const newDiv = document.createElement('div');
            newDiv.textContent = text;
            element.parentNode?.replaceChild(newDiv, element);
        }
    });

    return temp.textContent
        ?.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n') || '';
};

/**
 * Convert HTML content to display safely in React
 * Used with dangerouslySetInnerHTML
 */
export const createSafeHtmlContent = (html: string) => {
    return {
        __html: sanitizeHtml(html),
    };
};

/**
 * Check if content contains HTML tags
 */
export const hasHtmlTags = (content: string): boolean => {
    if (!content) return false;
    return /<[^>]*>/.test(content);
};

/**
 * Remove specific HTML tags from content while keeping the text
 */
export const removeSpecificTags = (html: string, tagsToRemove: string[]): string => {
    if (!html) return '';

    let result = html;
    tagsToRemove.forEach(tag => {
        const openTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
        const closeTagRegex = new RegExp(`</${tag}>`, 'gi');
        result = result.replace(openTagRegex, '').replace(closeTagRegex, '');
    });

    return result;
};

/**
 * Normalize HTML content - fixes common formatting issues
 * Converts plain text into properly formatted HTML
 */
export const normalizeHtmlContent = (content: string): string => {
    if (!content) return '';

    // If it already has HTML tags, return as-is
    if (hasHtmlTags(content)) {
        return content;
    }

    // Convert plain text to HTML
    let html = content
        // Escape HTML special characters first
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Convert double line breaks to paragraphs
        .replace(/\n\n+/g, '</p><p>')
        // Convert single line breaks to br tags
        .replace(/\n/g, '<br>')
        // Wrap in paragraph tags
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');

    // Fix any double-wrapped paragraphs
    html = html.replace(/<p><\/p>/g, '');

    return html;
};
