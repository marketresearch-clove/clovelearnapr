import React, { useState, useEffect } from 'react';
import { assessmentService } from '../lib/assessmentService';
import { quizResultsService } from '../lib/quizResultsService';

interface QuizQuestion {
  id: number;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options: string[];
  correctAnswer: number;
}

interface InlineQuizRendererProps {
  lessonId: string;
  courseId: string;
  questions: QuizQuestion[];
  title: string;
  description?: string;
  duration?: number;
  passingScore?: number;
  onComplete?: (result: any) => void;
  userId?: string;
  assessmentId?: string;
}

const InlineQuizRenderer: React.FC<InlineQuizRendererProps> = ({
  lessonId,
  courseId,
  questions,
  title,
  description,
  duration = 30,
  passingScore = 70,
  onComplete,
  userId,
  assessmentId,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [previousResult, setPreviousResult] = useState<any>(null);
  const [showPreviousResult, setShowPreviousResult] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(true);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    const loadPreviousResult = async () => {
      if (!userId || !assessmentId) {
        setIsLoadingPrevious(false);
        return;
      }

      try {
        const attempts = await quizResultsService.getQuizAttempts(userId, assessmentId);
        if (attempts && attempts.length > 0) {
          const latestAttempt = attempts[attempts.length - 1];
          if (latestAttempt.passed) {
            setPreviousResult(latestAttempt);
            setShowPreviousResult(true);
          }
        }
      } catch (error) {
        console.error('Error loading previous quiz result:', error);
      } finally {
        setIsLoadingPrevious(false);
      }
    };

    loadPreviousResult();
  }, [userId, assessmentId]);

  useEffect(() => {
    if (submitted || showPreviousResult || !isStarted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted, showPreviousResult, isStarted]);

  const handleOptionSelect = (optionIndex: number) => {
    setSelectedOption(optionIndex);
    setAnswers({
      ...answers,
      [questions[currentQuestion].id]: optionIndex,
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      const nextQ = questions[currentQuestion + 1];
      setSelectedOption(answers[nextQ.id] ?? null);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQ = questions[currentQuestion - 1];
      setSelectedOption(answers[prevQ.id] ?? null);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let score = 0;
      questions.forEach((question) => {
        const userAnswer = answers[question.id];
        if (userAnswer !== undefined && userAnswer === question.correctAnswer) {
          score += 1;
        }
      });

      const percentage = (score / questions.length) * 100;
      const passed = percentage >= passingScore;

      const quizResult = {
        score,
        percentage: Math.round(percentage * 100) / 100,
        passed,
        totalQuestions: questions.length,
        timeTaken: (duration * 60) - timeLeft,
        answers: Object.entries(answers).reduce((acc, [qId, optIdx]) => {
          acc[qId] = optIdx.toString();
          return acc;
        }, {} as Record<string, string>),
      };

      setResult(quizResult);
      setSubmitted(true);

      if (onComplete) {
        onComplete(quizResult);
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    setCurrentQuestion(0);
    setSelectedOption(null);
    setAnswers({});
    setTimeLeft(duration * 60);
    setSubmitted(false);
    setResult(null);
    setShowPreviousResult(false);
    setIsStarted(false);
  };

  const handleStartQuiz = () => {
    setIsStarted(true);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progressPercent = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];
  const options = currentQ?.options || [];

  if (showPreviousResult && previousResult) {
    return (
      <div className="w-full h-full bg-white flex items-center justify-center relative">
        <div className="max-w-2xl w-full p-8 text-center">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            previousResult.passed 
              ? 'bg-green-100 text-green-600' 
              : 'bg-red-100 text-red-600'
          }`}>
            <span className="material-symbols-rounded text-4xl">
              {previousResult.passed ? 'check_circle' : 'cancel'}
            </span>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {previousResult.passed ? 'Quiz Passed!' : 'Quiz Completed'}
          </h2>
          
          <div className="my-6 space-y-2">
            <p className="text-gray-800">
              <span className="font-semibold text-2xl text-gray-900">{previousResult.pointsearned}/{previousResult.totalpoints}</span> points earned
            </p>
            <p className="text-gray-800">
              Score: <span className="font-semibold text-2xl text-gray-900">{previousResult.percentage}%</span>
            </p>
            <p className="text-gray-800">
              Passing Score: <span className="font-semibold">{passingScore}%</span>
            </p>
            <p className="text-gray-600 text-sm">
              Attempt #{previousResult.attemptnumber}
            </p>
          </div>

          <button
            onClick={handleRetakeQuiz}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
          >
            <span className="material-symbols-rounded">refresh</span> Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="w-full h-full bg-white flex items-center justify-center relative">
        <div className="max-w-2xl w-full p-8 text-center">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            result.passed 
              ? 'bg-green-100 text-green-600' 
              : 'bg-red-100 text-red-600'
          }`}>
            <span className="material-symbols-rounded text-4xl">
              {result.passed ? 'check_circle' : 'cancel'}
            </span>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {result.passed ? 'Quiz Passed!' : 'Quiz Completed'}
          </h2>
          
          <div className="my-6 space-y-2">
            <p className="text-gray-800">
              <span className="font-semibold text-2xl text-gray-900">{result.score}/{result.totalQuestions}</span> questions correct
            </p>
            <p className="text-gray-800">
              Score: <span className="font-semibold text-2xl text-gray-900">{result.percentage}%</span>
            </p>
            <p className="text-gray-800">
              Passing Score: <span className="font-semibold">{passingScore}%</span>
            </p>
          </div>

          <button
            onClick={handleRetakeQuiz}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
          >
            <span className="material-symbols-rounded">refresh</span> Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingPrevious) {
    return (
      <div className="w-full h-full bg-white flex items-center justify-center relative">
        <div className="max-w-2xl w-full p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-800">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="w-full h-full bg-white flex items-center justify-center relative">
        <div className="max-w-2xl w-full p-8 text-center">
          <p className="text-gray-800 mb-4">No questions available for this quiz.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 overflow-y-auto relative">
      
      {!isStarted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-100/40 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 px-8 py-6 text-white text-center">
              <span className="material-symbols-rounded text-5xl mb-2">quiz</span>
              <h1 className="text-3xl font-bold">{title}</h1>
            </div>
            <div className="p-8 text-center">
              {description && (
                <p className="text-gray-800 mb-8 text-lg">{description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="material-symbols-rounded text-indigo-600 block mb-1">timer</span>
                  <span className="text-2xl font-bold text-gray-900">{duration}</span>
                  <span className="text-gray-800 text-sm block">Minutes</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="material-symbols-rounded text-indigo-600 block mb-1">list_alt</span>
                  <span className="text-2xl font-bold text-gray-900">{questions.length}</span>
                  <span className="text-gray-800 text-sm block">Questions</span>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-8 flex items-start gap-3 text-left">
                <span className="material-symbols-rounded text-blue-600">info</span>
                <div>
                  <p className="text-blue-900 font-semibold text-sm">Instructions</p>
                  <ul className="text-blue-800 text-xs list-disc list-inside space-y-1 mt-1">
                    <li>You must achieve at least {passingScore}% to pass.</li>
                    <li>The timer will start as soon as you click the button below.</li>
                    <li>Do not refresh the page during the quiz.</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={handleStartQuiz}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-rounded">play_arrow</span>
                Start Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-500 ${!isStarted ? 'blur-lg scale-95 opacity-50 select-none pointer-events-none' : ''}`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-indigo-100 text-sm mt-1">Question {currentQuestion + 1} of {questions.length}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</div>
              <p className="text-indigo-100 text-sm">Time Remaining</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-white h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {description && currentQuestion === 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-900 text-sm">{description}</p>
            </div>
          )}

          {/* Question */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              {currentQ?.question}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {options.map((option, index) => {
                const isSelected = selectedOption === index;
                return (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(index)}
                    className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 group ${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-300' 
                        : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-600' 
                        : 'border-slate-400 group-hover:border-indigo-400'
                    }`}>
                      {isSelected && <span className="material-symbols-rounded text-white text-sm">check</span>}
                    </div>
                    <span className={`text-base ${isSelected ? 'text-indigo-900 font-semibold' : 'text-gray-900'}`}>
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center gap-4 pt-8 border-t border-slate-200">
            <button
              onClick={handlePreviousQuestion}
              disabled={currentQuestion === 0}
              className="px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <span className="material-symbols-rounded">arrow_back</span> Previous
            </button>

            {currentQuestion === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={selectedOption === null || isSubmitting}
                className="px-8 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/30"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded">check</span> Submit
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                disabled={selectedOption === null}
                className="px-8 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/30"
              >
                Next <span className="material-symbols-rounded">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InlineQuizRenderer;
