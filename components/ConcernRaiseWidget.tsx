import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabaseClient';

interface Concern {
    id: string;
    subject: string;
    status: string;
    created_at: string;
    category: string;
}

interface SurveyQuestion {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'likert';
    options?: string[];
}

interface Survey {
    id: string;
    title: string;
    description: string;
    questions: SurveyQuestion[];
    is_active: boolean;
    created_at: string;
}

interface ConcernRaiseWidgetProps {
    userId: string;
    userEmail: string;
    fullName: string;
}

const ConcernRaiseWidget: React.FC<ConcernRaiseWidgetProps> = ({ userId, userEmail, fullName }) => {
    const [showForm, setShowForm] = useState(false);
    const [showTickets, setShowTickets] = useState(false);
    const [showSurveyModal, setShowSurveyModal] = useState(false);
    const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
    const [concerns, setConcerns] = useState<Concern[]>([]);
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string | string[]>>({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        category: 'course-request',
        subject: '',
        description: '',
    });

    const categories = [
        { value: 'course-request', label: 'Course Request' },
        { value: 'issue', label: 'Report Issue' },
        { value: 'query', label: 'General Query' },
        { value: 'feedback', label: 'Feedback' },
        { value: 'other', label: 'Other' },
    ];

    useEffect(() => {
        fetchSurveys();
    }, []);

    useEffect(() => {
        if (showTickets) {
            fetchConcerns();
        }
    }, [showTickets]);

    const fetchConcerns = async () => {
        try {
            setLoading(true);
            const { data, error: err } = await supabase
                .from('concerns_tickets')
                .select('id, subject, status, created_at, category')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (err) throw err;
            setConcerns(data || []);
        } catch (err) {
            console.error('Error fetching concerns:', err);
            setError('Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    const fetchSurveys = async () => {
        try {
            const { data, error } = await supabase
                .from('surveys')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSurveys((data || []).map((survey: any) => ({
                ...survey,
                questions: survey.questions || [],
            })));
        } catch (err) {
            console.error('Error fetching surveys:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!formData.subject.trim() || !formData.description.trim()) {
            setError('Please fill in all fields');
            return;
        }

        try {
            setLoading(true);
            let result;

            if (formData.category === 'feedback') {
                result = await supabase.from('feedback_submissions').insert([
                    {
                        user_id: userId,
                        full_name: fullName,
                        user_email: userEmail,
                        subject: formData.subject,
                        description: formData.description,
                    },
                ]);
            } else {
                result = await supabase.from('concerns_tickets').insert([
                    {
                        user_id: userId,
                        user_email: userEmail,
                        full_name: fullName,
                        category: formData.category,
                        subject: formData.subject,
                        description: formData.description,
                    },
                ]);
            }

            if (result.error) throw result.error;

            setSuccess(true);
            setFormData({
                category: 'course-request',
                subject: '',
                description: '',
            });

            setTimeout(() => {
                setShowForm(false);
                setSuccess(false);
            }, 2000);

            if (showTickets) {
                fetchConcerns();
            }
        } catch (err) {
            console.error('Error submitting concern or feedback:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    const handleSurveySubmit = async () => {
        if (!selectedSurvey) return;
        const answers = selectedSurvey.questions.reduce((acc, question) => {
            acc[question.id] = surveyAnswers[question.id] ?? '';
            return acc;
        }, {} as Record<string, any>);

        try {
            setLoading(true);
            const { error } = await supabase.from('survey_responses').insert([
                {
                    survey_id: selectedSurvey.id,
                    user_id: userId,
                    full_name: fullName,
                    user_email: userEmail,
                    answers,
                },
            ]);

            if (error) throw error;

            setSuccess(true);
            setSelectedSurvey(null);
            setShowSurveyModal(false);
            setSurveyAnswers({});
            fetchSurveys();

            setTimeout(() => setSuccess(false), 2000);
        } catch (err) {
            console.error('Error submitting survey response:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit survey');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const colors: { [key: string]: string } = {
            open: 'bg-blue-100 text-blue-800',
            'in-progress': 'bg-yellow-100 text-yellow-800',
            resolved: 'bg-green-100 text-green-800',
            closed: 'bg-slate-100 text-slate-800',
        };
        return colors[status] || 'bg-slate-100 text-slate-800';
    };

    return (
        <div className="space-y-2 md:space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl md:rounded-2x1 p-3 md:p-6 border border-blue-200">
                <div className="flex items-start gap-2 md:gap-2">
                    <div className="bg-blue-600 p-2 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-white text-lg md:text-2xl">
                            workspace_premium
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 mb-1 text-xs md:text-sm">
                            Dear Learners
                        </h3>
                        <p className="text-[10px] md:text-xs text-slate-700 mb-2 md:mb-4 line-clamp-2">
                            Submit general feedback, raise a concern, or respond to a survey.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setShowForm(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 md:py-1.5 px-3 md:px-4 rounded text-xs md:text-sm transition-colors"
                            >
                                Raise Issue
                            </button>
                            {surveys.length > 0 && (
                                <button
                                    onClick={() => {
                                        setSelectedSurvey(null);
                                        setShowSurveyModal(true);
                                    }}
                                    className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 font-semibold py-1 md:py-1.5 px-3 md:px-4 rounded text-xs md:text-sm transition-colors"
                                >
                                    Take Survey
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showForm &&
                ReactDOM.createPortal(
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
                            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">Submit Feedback or Concern</h2>
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-2xl">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}
                                {success && (
                                    <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                                        Submission received successfully.
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Category <span className="text-red-600">*</span>
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    >
                                        {categories.map((cat) => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Subject <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        placeholder="Brief subject of your concern or feedback"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Description <span className="text-red-600">*</span>
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe your feedback or concern in detail..."
                                        rows={6}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                                        disabled={loading}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        {loading ? 'Submitting...' : 'Submit'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        disabled={loading}
                                        className="flex-1 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}

            {showSurveyModal &&
                ReactDOM.createPortal(
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
                            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {selectedSurvey ? selectedSurvey.title : 'Available Surveys'}
                                    </h2>
                                    {!selectedSurvey && (
                                        <p className="text-sm text-slate-500">Select a survey to respond to.</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedSurvey(null);
                                        setShowSurveyModal(false);
                                    }}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-2xl">close</span>
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {!selectedSurvey ? (
                                    surveys.length > 0 ? (
                                        <div className="grid gap-4">
                                            {surveys.map((survey) => (
                                                <button
                                                    key={survey.id}
                                                    onClick={() => {
                                                        setSelectedSurvey(survey);
                                                        setSurveyAnswers({});
                                                    }}
                                                    className="text-left p-4 border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-sm transition-colors"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <h3 className="font-semibold text-slate-900">{survey.title}</h3>
                                                            <p className="text-sm text-slate-600 mt-1">{survey.description}</p>
                                                        </div>
                                                        <span className="text-xs font-semibold text-blue-600 uppercase tracking-[0.08em]">
                                                            Take
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500">No active surveys are currently available.</p>
                                    )
                                ) : (
                                    <>
                                        <p className="text-sm text-slate-600">{selectedSurvey.description}</p>
                                        {selectedSurvey.questions.map((question) => (
                                            <div key={question.id}>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">{question.label}</label>
                                                {question.type === 'textarea' && (
                                                    <textarea
                                                        value={(surveyAnswers[question.id] as string) || ''}
                                                        onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [question.id]: e.target.value })}
                                                        rows={4}
                                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                                                    />
                                                )}
                                                {question.type === 'text' && (
                                                    <input
                                                        type="text"
                                                        value={(surveyAnswers[question.id] as string) || ''}
                                                        onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [question.id]: e.target.value })}
                                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                                    />
                                                )}
                                                {question.type === 'radio' && (
                                                    <div className="space-y-2">
                                                        {(question.options || []).map((option, optionIndex) => (
                                                            <label key={optionIndex} className="flex items-center gap-3 text-sm text-slate-700">
                                                                <input
                                                                    type="radio"
                                                                    name={question.id}
                                                                    value={option}
                                                                    checked={surveyAnswers[question.id] === option}
                                                                    onChange={() => setSurveyAnswers({ ...surveyAnswers, [question.id]: option })}
                                                                    className="form-radio text-blue-600"
                                                                />
                                                                {option}
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                                {question.type === 'checkbox' && (
                                                    <div className="space-y-2">
                                                        {(question.options || []).map((option, optionIndex) => {
                                                            const selectedValues = (surveyAnswers[question.id] as string[]) || [];
                                                            return (
                                                                <label key={optionIndex} className="flex items-center gap-3 text-sm text-slate-700">
                                                                    <input
                                                                        type="checkbox"
                                                                        value={option}
                                                                        checked={selectedValues.includes(option)}
                                                                        onChange={(e) => {
                                                                            const nextValues = e.target.checked
                                                                                ? [...selectedValues, option]
                                                                                : selectedValues.filter((value) => value !== option);
                                                                            setSurveyAnswers({ ...surveyAnswers, [question.id]: nextValues });
                                                                        }}
                                                                        className="form-checkbox text-blue-600"
                                                                    />
                                                                    {option}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {question.type === 'likert' && (
                                                    <div className="space-y-2">
                                                        {(question.options || []).map((option, optionIndex) => (
                                                            <label key={optionIndex} className="flex items-center gap-3 text-sm text-slate-700">
                                                                <input
                                                                    type="radio"
                                                                    name={question.id}
                                                                    value={option}
                                                                    checked={surveyAnswers[question.id] === option}
                                                                    onChange={() => setSurveyAnswers({ ...surveyAnswers, [question.id]: option })}
                                                                    className="form-radio text-blue-600"
                                                                />
                                                                {option}
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {error && (
                                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                                                {error}
                                            </div>
                                        )}
                                        {success && (
                                            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                                                Survey response submitted successfully.
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleSurveySubmit}
                                                disabled={loading}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                            >
                                                {loading ? 'Submitting...' : 'Submit Survey'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedSurvey(null);
                                                    setShowSurveyModal(false);
                                                }}
                                                disabled={loading}
                                                className="flex-1 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            <div className="bg-slate-50 rounded-xl md:rounded-2xl p-3 md:p-6 border border-slate-200">
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <button
                        onClick={() => setShowTickets(true)}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1 md:gap-2 text-xs md:text-sm min-w-0"
                    >
                        <span className="material-symbols-outlined text-base md:text-lg flex-shrink-0">list</span>
                        <span className="truncate">View Your Tickets</span>
                    </button>
                    {concerns.length > 0 && (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full flex-shrink-0">
                            {concerns.length}
                        </span>
                    )}
                </div>
            </div>

            {showTickets &&
                ReactDOM.createPortal(
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto mx-4">
                            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-slate-200 p-6 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">Your Concerns & Tickets</h2>
                                <button
                                    onClick={() => setShowTickets(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-2xl">close</span>
                                </button>
                            </div>

                            <div className="p-6">
                                {loading && concerns.length === 0 ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-center">
                                            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                                            <p className="text-slate-600">Loading your tickets...</p>
                                        </div>
                                    </div>
                                ) : concerns.length === 0 ? (
                                    <div className="text-center py-12">
                                        <span className="material-symbols-outlined text-6xl text-slate-200 block mb-3">task_alt</span>
                                        <p className="text-slate-500 font-medium">No concerns raised yet</p>
                                        <p className="text-sm text-slate-400 mt-1">Click "Raise Concern" to submit your first concern</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {concerns.map((concern) => (
                                            <div
                                                key={concern.id}
                                                className="bg-slate-50 p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all"
                                            >
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 text-base">{concern.subject}</h4>
                                                        <p className="text-sm text-slate-600 mt-1">
                                                            Category: <span className="font-semibold">{concern.category.replace('-', ' ').toUpperCase()}</span>
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${getStatusBadge(
                                                            concern.status
                                                        )}`}
                                                    >
                                                        {concern.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    Submitted on {new Date(concern.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6">
                                <button
                                    onClick={() => setShowTickets(false)}
                                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default ConcernRaiseWidget;
