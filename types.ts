export interface Course {
  id: string;
  title: string;
  instructor: string;
  thumbnail: string;
  progress: number; // 0-100
  totalLessons: number;
  completedLessons: number;
  category: string;
  rating: number;
  duration: string;
  totalstudents?: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  duration_minutes?: number;
  isCompleted: boolean;
  type: 'video' | 'quiz' | 'reading' | 'text' | 'pdf' | 'flashcard';
}

export interface Flashcard {
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizQuestion {
  id: number;
  question: string;
  type: 'multiple-choice';
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface QuizData {
  questions: QuizQuestion[];
  duration: number;
  passingScore: number;
}

export interface FlashcardBlockData {
  flashcards: Flashcard[];
  totalCards: number;
}

export interface ContentBlock {
  id: string;
  type: 'text' | 'video' | 'quiz' | 'flashcard';
  title: string;
  content: string;
  url?: string;
  description: string;
  data?: QuizData | FlashcardBlockData;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface User {
  name: string;
  avatar: string;
  role: 'learner' | 'instructor' | 'admin';
  xp: number;
}
