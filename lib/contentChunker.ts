/**
 * Content Chunker for LMS
 * Intelligently breaks down lesson content for better UX and readability
 * Adds pause markers for comprehension improvement
 */

export interface ContentChunk {
    id: string;
    type: 'paragraph' | 'heading' | 'list_item' | 'emphasis';
    text: string;
    pauseAfter?: number; // Pause duration in seconds after reading this chunk
    highlight?: string; // Key terms to emphasize
    wordCount: number;
    estimatedReadTime: number; // in seconds
}

export interface ParsedContent {
    chunks: ContentChunk[];
    totalWordCount: number;
    totalEstimatedReadTime: number;
    summary?: string;
}

class ContentChunker {
    /**
     * Parse HTML content into chunks with intelligent grouping
     */
    parse(htmlContent: string): ParsedContent {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const chunks: ContentChunk[] = [];
        let chunkIndex = 0;
        let totalWordCount = 0;

        this.parseNodes(tempDiv.childNodes, chunks, chunkIndex);

        // Merge small chunks and optimize
        const optimizedChunks = this.optimizeChunks(chunks);

        // Calculate totals
        totalWordCount = optimizedChunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
        const totalEstimatedReadTime = optimizedChunks.reduce(
            (sum, chunk) => sum + chunk.estimatedReadTime,
            0
        );

        // Add pauses after important chunks
        this.addIntelligentPauses(optimizedChunks, totalEstimatedReadTime);

        // Generate summary if content is long
        const summary =
            totalWordCount > 500 ? this.generateSummary(htmlContent) : undefined;

        return {
            chunks: optimizedChunks,
            totalWordCount,
            totalEstimatedReadTime,
            summary,
        };
    }

    /**
     * Parse DOM nodes recursively into chunks
     */
    private parseNodes(
        nodes: NodeList,
        chunks: ContentChunk[],
        startingIndex: number
    ): number {
        let index = startingIndex;

        nodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                const text = element.textContent?.trim() || '';

                if (!text) return;

                const chunkType = this.getChunkType(element.tagName);
                const wordCount = this.countWords(text);

                if (wordCount === 0) return;

                // Highlight key terms in headings and emphasis
                let highlight: string | undefined;
                if (
                    element.tagName === 'H1' ||
                    element.tagName === 'H2' ||
                    element.tagName === 'H3'
                ) {
                    highlight = text;
                } else if (element.tagName === 'STRONG' || element.tagName === 'B') {
                    highlight = text;
                }

                chunks.push({
                    id: `chunk-${index}`,
                    type: chunkType,
                    text: text,
                    highlight,
                    wordCount,
                    estimatedReadTime: this.estimateReadTime(wordCount),
                });

                index++;
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.trim() || '';
                if (!text || text.length < 3) return;

                const wordCount = this.countWords(text);
                if (wordCount === 0) return;

                chunks.push({
                    id: `chunk-${index}`,
                    type: 'paragraph',
                    text: text,
                    wordCount,
                    estimatedReadTime: this.estimateReadTime(wordCount),
                });

                index++;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                index = this.parseNodes(node.childNodes, chunks, index);
            }
        });

        return index;
    }

    /**
     * Determine chunk type from HTML tag
     */
    private getChunkType(
        tagName: string
    ): ContentChunk['type'] {
        switch (tagName.toUpperCase()) {
            case 'H1':
            case 'H2':
            case 'H3':
            case 'H4':
            case 'H5':
            case 'H6':
                return 'heading';
            case 'LI':
                return 'list_item';
            case 'STRONG':
            case 'B':
            case 'EM':
            case 'I':
                return 'emphasis';
            default:
                return 'paragraph';
        }
    }

    /**
     * Count words in text
     */
    private countWords(text: string): number {
        return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    }

    /**
     * Estimate read time in seconds
     * Average: 150-160 words per minute = 2.5 words per second
     */
    private estimateReadTime(wordCount: number): number {
        const wordsPerSecond = 2.5;
        return Math.ceil(wordCount / wordsPerSecond);
    }

    /**
     * Merge small chunks to optimize readability
     */
    private optimizeChunks(chunks: ContentChunk[]): ContentChunk[] {
        const optimized: ContentChunk[] = [];
        let currentGroup: ContentChunk | null = null;

        chunks.forEach((chunk, index) => {
            // Merge small content chunks - keep chunks granular for better TTS highlighting
            if (
                chunk.type === 'paragraph' &&
                chunk.wordCount < 8 &&
                currentGroup &&
                currentGroup.type === 'paragraph'
            ) {
                // Merge with previous
                currentGroup.text += ' ' + chunk.text;
                currentGroup.wordCount += chunk.wordCount;
                currentGroup.estimatedReadTime =
                    this.estimateReadTime(currentGroup.wordCount);
            } else {
                // Push previous group if exists
                if (currentGroup) {
                    optimized.push(currentGroup);
                }
                currentGroup = { ...chunk };
            }
        });

        // Push last group
        if (currentGroup) {
            optimized.push(currentGroup);
        }

        return optimized;
    }

    /**
     * Add intelligent pauses for better comprehension
     */
    private addIntelligentPauses(chunks: ContentChunk[], totalTime: number): void {
        chunks.forEach((chunk, index) => {
            // Pause after headings (to let students process)
            if (chunk.type === 'heading') {
                chunk.pauseAfter = 2; // 2 seconds
            }
            // Pause after complex paragraphs (more than 5 minute of reading)
            else if (chunk.estimatedReadTime > 300) {
                chunk.pauseAfter = 1; // 1 second
            }
            // Pause after lists
            else if (chunk.type === 'list_item' && index < chunks.length - 1) {
                chunk.pauseAfter = 0.5; // 0.5 seconds
            }
        });
    }

    /**
     * Generate a summary using key sentences
     */
    private generateSummary(htmlContent: string): string {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const text = tempDiv.textContent || '';

        // Extract key sentences (first and last of each logical section)
        const sentences = text
            .split(/[.!?]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 10);

        if (sentences.length === 0) return '';

        // Take first, middle, and last sentences for summary
        const indices = [0, Math.floor(sentences.length / 2), sentences.length - 1];
        const summarySentences = [...new Set(indices.map((i) => sentences[i]))].filter(
            (s) => s !== undefined
        );

        return summarySentences.join('. ') + '.';
    }

    /**
     * Split content by natural sections (headings)
     */
    splitBySections(htmlContent: string): Array<{ title: string; content: string }> {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const sections: Array<{ title: string; content: string }> = [];
        let currentSection = { title: 'Introduction', content: '' };

        let element: Element | null = tempDiv.firstElementChild;

        while (element) {
            if (element.tagName.match(/^H[1-3]$/)) {
                // New section
                if (currentSection.content.trim()) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: element.textContent || 'Section',
                    content: '',
                };
            } else {
                currentSection.content += element.outerHTML + '\n';
            }

            element = element.nextElementSibling;
        }

        // Push last section
        if (currentSection.content.trim()) {
            sections.push(currentSection);
        }

        return sections;
    }

    /**
     * Extract key terms and concepts
     */
    extractKeyTerms(htmlContent: string): string[] {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const keyTerms: Set<string> = new Set();

        // Extract bold/strong text as key terms
        tempDiv.querySelectorAll('strong, b').forEach((element) => {
            const term = element.textContent?.trim();
            if (term) {
                keyTerms.add(term);
            }
        });

        // Extract headings as key terms
        tempDiv.querySelectorAll('h2, h3').forEach((element) => {
            const term = element.textContent?.trim();
            if (term && term.length < 50) {
                keyTerms.add(term);
            }
        });

        return Array.from(keyTerms).slice(0, 10); // Return top 10 terms
    }

    /**
     * Create audio chunks from content chunks
     * Each TTS call should be reasonable length (10-30 seconds)
     */
    createAudioChunks(chunks: ContentChunk[]): Array<{
        audioChunkId: string;
        texts: string[];
        pauseBetween: number[];
        totalEstimatedTime: number;
    }> {
        const audioChunks: Array<{
            audioChunkId: string;
            texts: string[];
            pauseBetween: number[];
            totalEstimatedTime: number;
        }> = [];

        let currentAudioChunk = {
            audioChunkId: 'audio-0',
            texts: [] as string[],
            pauseBetween: [] as number[],
            totalEstimatedTime: 0,
        };

        let audioChunkIndex = 0;

        chunks.forEach((chunk, index) => {
            // Aim for 8-10 seconds per audio chunk for better granularity
            const totalRawTime =
                currentAudioChunk.totalEstimatedTime + chunk.estimatedReadTime;
            const pause = chunk.pauseAfter || 0;
            const totalWithPause = totalRawTime + pause;

            if (totalWithPause > 10 && currentAudioChunk.texts.length > 0) {
                // Save current chunk and start new one
                audioChunks.push(currentAudioChunk);
                audioChunkIndex++;

                currentAudioChunk = {
                    audioChunkId: `audio-${audioChunkIndex}`,
                    texts: [chunk.text],
                    pauseBetween: [pause],
                    totalEstimatedTime: chunk.estimatedReadTime,
                };
            } else {
                // Add to current chunk
                currentAudioChunk.texts.push(chunk.text);
                currentAudioChunk.pauseBetween.push(pause);
                currentAudioChunk.totalEstimatedTime += chunk.estimatedReadTime;
            }
        });

        // Push final chunk
        if (currentAudioChunk.texts.length > 0) {
            audioChunks.push(currentAudioChunk);
        }

        return audioChunks;
    }
}

export const contentChunker = new ContentChunker();
