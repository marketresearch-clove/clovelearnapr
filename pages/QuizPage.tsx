
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface Question {
  id: number | string;
  text: string;
  options?: string[];
  correctAnswer: string | number;
  points?: number;
}

interface Assessment {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  duration: number;
  passingScore: number;
}

const QuizPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: assessmentId } = useParams<{ id: string }>();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        setLoading(true);
        if (!assessmentId) {
          setError('No assessment ID provided');
          return;
        }

        const response = await fetch(`http://localhost:3001/api/assessments/${assessmentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch assessment');
        }

        const data = await response.json();
        setAssessment(data);
        setTimeLeft(data.duration * 60 || 60);
      } catch (err) {
        console.error('Error fetching assessment:', err);
        setError('Failed to load quiz. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [assessmentId]);

  useEffect(() => {
    if (!assessment) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const userId = localStorage.getItem('userId') || 'anonymous';
          submitAssessment(userId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [assessment, answers]);

  const submitAssessment = async (userId: string) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/assessments/${assessment?.id}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            answers,
            timeTaken: (assessment?.duration || 1) * 60 - timeLeft,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit assessment');
      }

      const result = await response.json();
      navigate('/dashboard', { state: { result } });
    } catch (err) {
      console.error('Error submitting assessment:', err);
      alert('Failed to submit assessment. Please try again.');
    }
  };

  const handleOptionSelect = (optionIndex: number) => {
    setSelectedOption(optionIndex);
    const currentQ = assessment?.questions[currentQuestion];
    if (currentQ) {
      setAnswers({
        ...answers,
        [currentQ.id]: optionIndex.toString(),
      });
    }
  };

  const handleNextQuestion = () => {
    if (assessment && currentQuestion < assessment.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      const nextQ = assessment.questions[currentQuestion + 1];
      setSelectedOption(answers[nextQ.id] ? parseInt(answers[nextQ.id]) : null);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQ = assessment?.questions[currentQuestion - 1];
      setSelectedOption(answers[prevQ?.id || ''] ? parseInt(answers[prevQ?.id || '']) : null);
    }
  };

  const progressCircle = (
    <svg className="w-12 h-12 transform -rotate-90">
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke="currentColor"
        strokeWidth="4"
        fill="transparent"
        className="text-slate-200"
      />
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke="currentColor"
        strokeWidth="4"
        fill="transparent"
        className="text-green-500 transition-all duration-1000 ease-linear"
        strokeDasharray={2 * Math.PI * 20}
        strokeDashoffset={2 * Math.PI * 20 * ((timeLeft > 0 ? timeLeft : 0) / (assessment?.duration ? assessment.duration * 60 : 60))}
      />
    </svg>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!assessment || assessment.questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <p className="text-slate-600 mb-4">No questions found in this quiz.</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQ = assessment.questions[currentQuestion];
  const options = currentQ.options || [];

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 lg:p-8 font-sans">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[600px]">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{assessment.title}</h1>
            <p className="text-slate-500 text-sm mt-1">Question {currentQuestion + 1} of {assessment.questions.length}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              {progressCircle}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] font-bold text-green-600 leading-tight">
                <span>Remaining</span>
                <span className="text-sm">{timeLeft}</span>
                <span>secs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row">

          {/* Question Column */}
          <div className="lg:w-5/12 p-8 lg:p-12 border-r border-slate-100 bg-slate-50 relative flex flex-col">
            <div className="flex-1 z-10">
              <h2 className="text-2xl lg:text-3xl font-medium text-slate-800 leading-normal">
                {currentQ.text}
              </h2>
            </div>

            {/* Decorative Graphics */}
            <div className="absolute bottom-0 left-0 w-full h-32 opacity-50 pointer-events-none overflow-hidden">
              <svg viewBox="0 0 400 150" className="w-full h-full">
                <path d="M0,150 L100,100 L200,150 Z" fill="#E0E7FF" />
                <path d="M50,150 L150,50 L250,150 Z" fill="#C7D2FE" opacity="0.6" />
                <circle cx="350" cy="120" r="10" fill="#818CF8" opacity="0.4" />
                <circle cx="300" cy="140" r="5" fill="#6366F1" opacity="0.4" />
              </svg>
            </div>
          </div>

          {/* Options Column */}
          <div className="lg:w-7/12 p-8 lg:p-12 bg-slate-100/50 flex flex-col">
            <div className="space-y-4 flex-1">
              {options.map((option, index) => {
                const isSelected = selectedOption === index;
                return (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(index)}
                    className={`w-full text-left p-6 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md flex items-start gap-4 group ${isSelected
                      ? 'bg-primary-100 border-primary-300 ring-1 ring-primary-300'
                      : 'bg-white border-slate-200 hover:border-primary-200'
                      }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'
                      }`}>
                      {isSelected && <span className="material-symbols-rounded text-white text-sm">check</span>}
                    </div>
                    <span className={`text-lg ${isSelected ? 'text-primary-900 font-medium' : 'text-slate-700'}`}>
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex justify-between items-center">
              <button
                onClick={handlePreviousQuestion}
                disabled={currentQuestion === 0}
                className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-300 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-rounded">arrow_back</span> Previous
              </button>

              {currentQuestion === assessment.questions.length - 1 ? (
                <button
                  onClick={() => {
                    const userId = localStorage.getItem('userId') || 'anonymous';
                    submitAssessment(userId);
                  }}
                  disabled={selectedOption === null}
                  className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  Submit <span className="material-symbols-rounded">check</span>
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  disabled={selectedOption === null}
                  className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  Next <span className="material-symbols-rounded">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;
