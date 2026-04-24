import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import AdminLayout from '../components/AdminLayout';
import { generateSurveyContent } from '../lib/aiService';
import { FiSearch, FiCheckCircle, FiClock, FiAlertCircle, FiEye, FiMessageSquare, FiPlus, FiEdit3, FiTrash2, FiDownload } from 'react-icons/fi';

interface Concern {
    id: string;
    user_id: string;
    full_name: string;
    user_email: string;
    category: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    updated_at: string;
    admin_notes?: string;
    resolved_at?: string;
    is_seen?: boolean;
}

interface FeedbackSubmission {
    id: string;
    user_id: string;
    full_name: string;
    user_email: string;
    subject: string;
    description: string;
    status: string;
    is_seen: boolean;
    created_at: string;
    updated_at: string;
}

interface SurveyQuestion {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'likert' | 'matrix';
    options?: string[];
    rows?: string[];
    columns?: string[];
}

interface SurveyResponse {
    id: string;
    survey_id: string;
    user_id: string;
    full_name: string;
    user_email: string;
    answers: Record<string, string | string[] | Record<string, string>>;
    created_at: string;
}

interface Survey {
    id: string;
    title: string;
    description: string;
    questions: SurveyQuestion[];
    is_active: boolean;
    expires_at?: string | null;
    created_at: string;
}

const ConcernManagementPage = () => {
    const [activeTab, setActiveTab] = useState<'concerns' | 'feedbacks' | 'surveys'>('concerns');
    const [loading, setLoading] = useState(true);

    const [concerns, setConcerns] = useState<Concern[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [selectedConcern, setSelectedConcern] = useState<Concern | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [adminNotes, setAdminNotes] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const [feedbacks, setFeedbacks] = useState<FeedbackSubmission[]>([]);
    const [feedbackSearch, setFeedbackSearch] = useState('');
    const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>('all');
    const [feedbackLoading, setFeedbackLoading] = useState(true);
    const [feedbackUpdating, setFeedbackUpdating] = useState(false);

    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
    const [surveyResponseCounts, setSurveyResponseCounts] = useState<Record<string, number>>({});
    const [surveyLoading, setSurveyLoading] = useState(true);
    const [showSurveyForm, setShowSurveyForm] = useState(false);
    const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
    const [showAIGenerator, setShowAIGenerator] = useState(false);
    const [analyticsSurveyId, setAnalyticsSurveyId] = useState<string | null>(null);
    const [aiProvider, setAIProvider] = useState<'gemini' | 'openrouter' | 'ollama'>('gemini');
    const [selectedAIModel, setSelectedAIModel] = useState<string>('gemini-2.5-flash');
    const [aiQuestionType, setAIQuestionType] = useState<'text' | 'textarea' | 'radio' | 'checkbox' | 'likert' | 'matrix' | 'mixed'>('mixed');
    const [aiNumQuestions, setAINumQuestions] = useState<number>(5);
    const [aiSurveyName, setAISurveyName] = useState('');
    const [aiSurveyDescription, setAISurveyDescription] = useState('');
    const [aiGenerating, setAIGenerating] = useState(false);
    const [aiGenerationStatus, setAIGenerationStatus] = useState('');
    const [aiGenerationOutput, setAIGenerationOutput] = useState<string[]>([]);
    const [aiGenerationProgress, setAIGenerationProgress] = useState(0);
    const [surveyFormData, setSurveyFormData] = useState<{
        title: string;
        description: string;
        expires_at: string | null;
        questions: SurveyQuestion[];
    }>({
        title: '',
        description: '',
        expires_at: null,
        questions: [{ id: 'q1', label: '', type: 'text', options: [] }],
    });

    const itemsPerPage = 10;

    const isSurveyExpired = (survey: Survey) => {
        return survey.expires_at ? new Date(survey.expires_at) < new Date() : false;
    };

    useEffect(() => {
        fetchPageData();
    }, []);

    const fetchPageData = async () => {
        setLoading(true);
        await Promise.all([fetchConcerns(), fetchFeedbacks(), fetchSurveys()]);
        setLoading(false);
    };

    const fetchConcerns = async () => {
        try {
            const { data, error } = await supabase
                .from('concerns_tickets')
                .select('id, user_id, full_name, user_email, category, subject, description, status, priority, created_at, updated_at, admin_notes, resolved_at, is_seen')
                .order('created_at', { ascending: false })
                .range(0, 49);

            if (error) throw error;
            const fetchedConcerns = data || [];
            setConcerns(fetchedConcerns);

            const hasUnseen = fetchedConcerns.some((row) => row.is_seen === false);
            if (hasUnseen) {
                await supabase
                    .from('concerns_tickets')
                    .update({ is_seen: true })
                    .eq('is_seen', false);
            }
        } catch (err) {
            console.error('Error fetching concerns:', err);
        }
    };

    const fetchFeedbacks = async () => {
        try {
            setFeedbackLoading(true);
            const { data, error } = await supabase
                .from('feedback_submissions')
                .select('id, user_id, full_name, user_email, subject, description, status, is_seen, created_at, updated_at')
                .order('created_at', { ascending: false })
                .range(0, 49);

            if (error) throw error;
            setFeedbacks(data || []);
        } catch (err) {
            console.error('Error fetching feedback submissions:', err);
        } finally {
            setFeedbackLoading(false);
        }
    };

    const fetchSurveys = async () => {
        try {
            setSurveyLoading(true);
            const [surveyRes, responseRes] = await Promise.all([
                supabase.from('surveys')
                    .select('id, title, description, is_active, expires_at, created_at, questions')
                    .order('created_at', { ascending: false })
                    .range(0, 49),
                supabase.from('survey_responses')
                    .select('id, survey_id, user_id, full_name, user_email, answers, created_at')
                    .order('created_at', { ascending: false })
                    .range(0, 199),
            ]);

            if (surveyRes.error) throw surveyRes.error;
            if (responseRes.error) throw responseRes.error;

            const fetchedSurveys = (surveyRes.data || []).map((survey: any) => ({
                ...survey,
                questions: survey.questions || [],
            }));

            setSurveys(fetchedSurveys);
            setSurveyResponses(responseRes.data || []);

            const counts: Record<string, number> = {};
            (responseRes.data || []).forEach((response: any) => {
                if (!response?.survey_id) return;
                counts[response.survey_id] = (counts[response.survey_id] || 0) + 1;
            });
            setSurveyResponseCounts(counts);
        } catch (err) {
            console.error('Error fetching surveys or responses:', err);
        } finally {
            setSurveyLoading(false);
        }
    };

    const getSurveyAnalytics = (survey: Survey) => {
        const responses = surveyResponses.filter((response) => response.survey_id === survey.id);
        const questionAnalytics = survey.questions.map((question) => {
            const counts: Record<string, number> = {};
            const textAnswers: string[] = [];

            responses.forEach((response) => {
                const answer = response.answers?.[question.id];
                if (question.type === 'checkbox') {
                    if (Array.isArray(answer)) {
                        answer.forEach((value) => {
                            if (!value) return;
                            counts[value] = (counts[value] || 0) + 1;
                        });
                    }
                } else if (question.type === 'matrix') {
                    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
                        Object.entries(answer).forEach(([row, selected]) => {
                            if (!selected) return;
                            const key = `${row} › ${selected}`;
                            counts[key] = (counts[key] || 0) + 1;
                        });
                    }
                } else if (question.type === 'radio' || question.type === 'likert') {
                    if (typeof answer === 'string' && answer) {
                        counts[answer] = (counts[answer] || 0) + 1;
                    }
                } else {
                    if (typeof answer === 'string' && answer.trim()) {
                        textAnswers.push(answer.trim());
                    }
                }
            });

            if (question.options?.length) {
                question.options.forEach((option) => {
                    if (!(option in counts)) {
                        counts[option] = 0;
                    }
                });
            }

            return {
                question,
                counts,
                textAnswers,
                totalResponses: responses.length,
            };
        });

        return {
            survey,
            totalResponses: responses.length,
            questionAnalytics,
        };
    };

    const selectedAnalyticsSurvey = analyticsSurveyId
        ? surveys.find((survey) => survey.id === analyticsSurveyId) ?? null
        : null;

    const surveyAnalytics = selectedAnalyticsSurvey ? getSurveyAnalytics(selectedAnalyticsSurvey) : null;

    const updateSurveyQuestion = (index: number, field: keyof SurveyQuestion, value: string | string[]) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[index] };
            question[field] = value as any;

            if (field === 'type') {
                if (value === 'likert') {
                    question.options = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
                } else if (value === 'matrix') {
                    question.rows = question.rows?.length ? question.rows : ['Row 1', 'Row 2', 'Row 3'];
                    question.columns = question.columns?.length ? question.columns : ['Beginner', 'Intermediate', 'Advanced'];
                } else {
                    question.rows = undefined;
                    question.columns = undefined;
                }
            }

            questions[index] = question;
            return { ...prev, questions };
        });
    };

    const updateSurveyQuestionArray = (questionIndex: number, field: 'rows' | 'columns', itemIndex: number, value: string) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[questionIndex] };
            const list = question[field] ? [...question[field]!] : [''];
            list[itemIndex] = value;
            question[field] = list;
            questions[questionIndex] = question;
            return { ...prev, questions };
        });
    };

    const addMatrixRow = (questionIndex: number) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[questionIndex] };
            question.rows = question.rows ? [...question.rows, `Row ${question.rows.length + 1}`] : ['Row 1'];
            questions[questionIndex] = question;
            return { ...prev, questions };
        });
    };

    const removeMatrixRow = (questionIndex: number, rowIndex: number) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[questionIndex] };
            question.rows = question.rows?.filter((_, idx) => idx !== rowIndex) ?? [];
            questions[questionIndex] = question;
            return { ...prev, questions };
        });
    };

    const addMatrixColumn = (questionIndex: number) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[questionIndex] };
            question.columns = question.columns ? [...question.columns, `Option ${question.columns.length + 1}`] : ['Option 1'];
            questions[questionIndex] = question;
            return { ...prev, questions };
        });
    };

    const removeMatrixColumn = (questionIndex: number, columnIndex: number) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[questionIndex] };
            question.columns = question.columns?.filter((_, idx) => idx !== columnIndex) ?? [];
            questions[questionIndex] = question;
            return { ...prev, questions };
        });
    };

    const addSurveyQuestion = () => {
        setSurveyFormData((prev) => ({
            ...prev,
            questions: [
                ...prev.questions,
                { id: `q${prev.questions.length + 1}`, label: '', type: 'text', options: [] },
            ],
        }));
    };

    const removeSurveyQuestion = (index: number) => {
        setSurveyFormData((prev) => ({
            ...prev,
            questions: prev.questions.filter((_, idx) => idx !== index),
        }));
    };

    const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[questionIndex] };
            question.options = question.options ? [...question.options] : [];
            question.options[optionIndex] = value;
            questions[questionIndex] = question;
            return { ...prev, questions };
        });
    };

    const addQuestionOption = (questionIndex: number) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[questionIndex] };
            question.options = question.options ? [...question.options, ''] : [''];
            questions[questionIndex] = question;
            return { ...prev, questions };
        });
    };

    const removeQuestionOption = (questionIndex: number, optionIndex: number) => {
        setSurveyFormData((prev) => {
            const questions = [...prev.questions];
            const question = { ...questions[questionIndex] };
            question.options = question.options?.filter((_, idx) => idx !== optionIndex) ?? [];
            questions[questionIndex] = question;
            return { ...prev, questions };
        });
    };

    const handleStatusUpdate = async (concernId: string, newStatus: string) => {
        try {
            setUpdatingStatus(true);
            const { error } = await supabase
                .from('concerns_tickets')
                .update({
                    status: newStatus,
                    resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
                    admin_notes: adminNotes,
                })
                .eq('id', concernId);

            if (error) throw error;

            setConcerns((prev) =>
                prev.map((c) =>
                    c.id === concernId
                        ? {
                            ...c,
                            status: newStatus,
                            admin_notes: adminNotes,
                            resolved_at: newStatus === 'resolved' ? new Date().toISOString() : c.resolved_at,
                        }
                        : c
                )
            );

            if (selectedConcern?.id === concernId) {
                setSelectedConcern({
                    ...selectedConcern,
                    status: newStatus,
                    admin_notes: adminNotes,
                });
            }

            setShowDetailModal(false);
            setAdminNotes('');
        } catch (err) {
            console.error('Error updating concern:', err);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleFeedbackStatusUpdate = async (feedbackId: string, newStatus: string) => {
        try {
            setFeedbackUpdating(true);
            const { error } = await supabase
                .from('feedback_submissions')
                .update({ status: newStatus })
                .eq('id', feedbackId);

            if (error) throw error;

            setFeedbacks((prev) =>
                prev.map((item) => (item.id === feedbackId ? { ...item, status: newStatus } : item))
            );
        } catch (err) {
            console.error('Error updating feedback:', err);
        } finally {
            setFeedbackUpdating(false);
        }
    };

    const resetSurveyForm = () => {
        setSurveyFormData({
            title: '',
            description: '',
            expires_at: null,
            questions: [{ id: 'q1', label: '', type: 'text', options: [] }],
        });
        setEditingSurveyId(null);
    };

    const handleCreateSurvey = async () => {
        if (
            !surveyFormData.title.trim() ||
            surveyFormData.questions.every((q) => !q.label.trim()) ||
            surveyFormData.questions.some((q) =>
                (['radio', 'checkbox', 'likert'].includes(q.type) && (!q.options || q.options.length === 0)) ||
                (q.type === 'matrix' && (!q.rows?.length || !q.columns?.length))
            )
        ) {
            return;
        }

        const questionsPayload = surveyFormData.questions
            .filter((question) => question.label.trim())
            .map((question, index) => ({
                id: `q${index + 1}`,
                label: question.label.trim(),
                type: question.type,
                options: question.options?.filter((option) => option.trim()) || [],
                rows: question.rows?.filter((row) => row.trim()) || [],
                columns: question.columns?.filter((column) => column.trim()) || [],
            }));

        try {
            if (editingSurveyId) {
                const { error } = await supabase.from('surveys').update({
                    title: surveyFormData.title.trim(),
                    description: surveyFormData.description.trim(),
                    questions: questionsPayload,
                    expires_at: surveyFormData.expires_at || null,
                }).eq('id', editingSurveyId);

                if (error) throw error;
            } else {
                const { error } = await supabase.from('surveys').insert([
                    {
                        title: surveyFormData.title.trim(),
                        description: surveyFormData.description.trim(),
                        questions: questionsPayload,
                        expires_at: surveyFormData.expires_at || null,
                        is_active: true,
                    },
                ]);

                if (error) throw error;
            }

            resetSurveyForm();
            setShowSurveyForm(false);
            await fetchSurveys();
        } catch (err) {
            console.error('Error saving survey:', err);
        }
    };

    const handleEditSurvey = (survey: Survey) => {
        setEditingSurveyId(survey.id);
        setSurveyFormData({
            title: survey.title,
            description: survey.description,
            expires_at: survey.expires_at || null,
            questions: survey.questions.map((question) => ({
                id: question.id,
                label: question.label,
                type: question.type,
                options: question.options || [],
                rows: question.rows || [],
                columns: question.columns || [],
            })),
        });
        setShowSurveyForm(true);
    };

    const formatAnswerValue = (answer: string | string[] | Record<string, string>) => {
        if (Array.isArray(answer)) {
            return answer.join('; ');
        }
        if (answer && typeof answer === 'object') {
            return Object.entries(answer)
                .map(([row, value]) => `${row}: ${value}`)
                .join('; ');
        }
        return String(answer || '');
    };

    const downloadCSV = (filename: string, rows: string[][]) => {
        const csvContent = rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportSurveyResults = (survey: Survey) => {
        const responses = surveyResponses.filter((response) => response.survey_id === survey.id);
        const headerRow = ['Response ID', 'User Name', 'User Email', 'Submitted At', ...survey.questions.map((question) => question.label)];
        const rows = [headerRow];

        responses.forEach((response) => {
            const row = [
                response.id,
                response.full_name,
                response.user_email,
                new Date(response.created_at).toLocaleString(),
                ...survey.questions.map((question) => formatAnswerValue(response.answers?.[question.id])),
            ];
            rows.push(row);
        });

        downloadCSV(`${survey.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.csv`, rows);
    };

    const handleGenerateSurveyWithAI = async () => {
        if (!aiSurveyName.trim()) {
            return;
        }

        setAIGenerating(true);
        setAIGenerationStatus('Preparing AI generation...');
        setAIGenerationProgress(10);
        setAIGenerationOutput([]);

        try {
            const promptType = aiQuestionType;
            const surveyData = await generateSurveyContent(aiSurveyName.trim(), aiSurveyDescription.trim(), {
                questionType: promptType,
                count: aiNumQuestions,
                modelName: selectedAIModel,
                provider: aiProvider,
                onStatusUpdate: (status) => {
                    setAIGenerationStatus(status);
                    setAIGenerationOutput((prev) => [...prev, `✓ ${status}`]);
                },
            });

            setSurveyFormData({
                title: surveyData.title || aiSurveyName.trim(),
                description: surveyData.description || aiSurveyDescription.trim(),
                expires_at: null,
                questions: surveyData.questions.map((question: any, index: number) => ({
                    id: question.id || `q${index + 1}`,
                    label: question.label || '',
                    type: question.type,
                    options: question.options || [],
                    rows: question.rows || [],
                    columns: question.columns || [],
                })),
            });
            setAIGenerationStatus('AI survey generated successfully');
            setAIGenerationProgress(100);
            setAiModelSelectionFromProvider(aiProvider);

            if (!showSurveyForm) {
                setShowSurveyForm(true);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'AI generation failed';
            setAIGenerationStatus(message);
            setAIGenerationOutput((prev) => [...prev, `❌ ${message}`]);
        } finally {
            setAIGenerating(false);
        }
    };

    const setAiModelSelectionFromProvider = (provider: 'gemini' | 'openrouter' | 'ollama') => {
        if (provider === 'gemini') {
            setSelectedAIModel('gemini-1.5-flash');
        } else if (provider === 'ollama') {
            setSelectedAIModel('gemini-3-flash-preview');
        } else {
            setSelectedAIModel('nvidia/nemotron-3-super-120b-a12b:free');
        }
    };

    const handleToggleSurveyActive = async (surveyId: string, isActive: boolean) => {
        try {
            const { error } = await supabase.from('surveys').update({ is_active: !isActive }).eq('id', surveyId);
            if (error) throw error;
            setSurveys((prev) => prev.map((survey) => (survey.id === surveyId ? { ...survey, is_active: !isActive } : survey)));
        } catch (err) {
            console.error('Error updating survey status:', err);
        }
    };

    const handleDeleteSurvey = async (surveyId: string) => {
        const confirmed = window.confirm('Delete this survey and all related results? This action cannot be undone.');
        if (!confirmed) return;

        try {
            const [{ error: deleteResponsesError }, { error: deleteSurveyError }] = await Promise.all([
                supabase.from('survey_responses').delete().eq('survey_id', surveyId),
                supabase.from('surveys').delete().eq('id', surveyId),
            ]);

            if (deleteResponsesError) throw deleteResponsesError;
            if (deleteSurveyError) throw deleteSurveyError;

            setSurveys((prev) => prev.filter((survey) => survey.id !== surveyId));
            setSurveyResponses((prev) => prev.filter((response) => response.survey_id !== surveyId));
            setSurveyResponseCounts((prev) => {
                const next = { ...prev };
                delete next[surveyId];
                return next;
            });
            if (analyticsSurveyId === surveyId) {
                setAnalyticsSurveyId(null);
            }
        } catch (err) {
            console.error('Error deleting survey:', err);
        }
    };

    const getStatusColor = (status: string) => {
        const colors: { [key: string]: string } = {
            open: 'bg-blue-100 text-blue-800 border-blue-300',
            'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
            resolved: 'bg-green-100 text-green-800 border-green-300',
            closed: 'bg-slate-100 text-slate-800 border-slate-300',
            new: 'bg-blue-100 text-blue-800 border-blue-300',
            reviewed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
        return colors[status] || 'bg-slate-100 text-slate-800';
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'open':
            case 'new':
                return <FiAlertCircle size={16} />;
            case 'in-progress':
                return <FiClock size={16} />;
            case 'resolved':
            case 'reviewed':
                return <FiCheckCircle size={16} />;
            default:
                return null;
        }
    };

    const getCategoryLabel = (category: string) => {
        const labels: { [key: string]: string } = {
            'course-request': 'Course Request',
            issue: 'Report Issue',
            query: 'General Query',
            feedback: 'Feedback',
            other: 'Other',
        };
        return labels[category] || category;
    };

    const filteredConcerns = concerns.filter((concern) => {
        const matchesSearch =
            concern.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            concern.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            concern.user_email.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || concern.status === statusFilter;
        const matchesCategory = categoryFilter === 'all' || concern.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesCategory;
    });

    const filteredFeedbacks = feedbacks.filter((feedback) => {
        const matchesSearch =
            feedback.subject.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
            feedback.full_name.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
            feedback.user_email.toLowerCase().includes(feedbackSearch.toLowerCase());

        const matchesStatus = feedbackStatusFilter === 'all' || feedback.status === feedbackStatusFilter;

        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredConcerns.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedConcerns = filteredConcerns.slice(startIndex, startIndex + itemsPerPage);

    return (
        <AdminLayout title="Surveys & Feedback">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold text-slate-900">Surveys & Feedback</h1>
                        <p className="text-sm text-slate-500 max-w-2xl">
                            Manage learner concerns, platform feedback, and survey definitions from one unified workspace.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['concerns', 'feedbacks', 'surveys'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as 'concerns' | 'feedbacks' | 'surveys')}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === tab
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {tab === 'concerns' ? 'Concern Management' : tab === 'feedbacks' ? 'Feedbacks' : 'Surveys'}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'concerns' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Total Concerns</p>
                                <p className="text-2xl font-bold text-slate-900">{concerns.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Open</p>
                                <p className="text-2xl font-bold text-blue-600">{concerns.filter((c) => c.status === 'open').length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">In Progress</p>
                                <p className="text-2xl font-bold text-yellow-600">{concerns.filter((c) => c.status === 'in-progress').length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Resolved</p>
                                <p className="text-2xl font-bold text-green-600">{concerns.filter((c) => c.status === 'resolved').length}</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <FiSearch size={20} className="text-slate-400" />
                                <h3 className="font-semibold text-slate-900">Filters & Search</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        placeholder="Search by name, email, or subject..."
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="open">Open</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                                    <select
                                        value={categoryFilter}
                                        onChange={(e) => {
                                            setCategoryFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    >
                                        <option value="all">All Categories</option>
                                        <option value="course-request">Course Request</option>
                                        <option value="issue">Report Issue</option>
                                        <option value="query">General Query</option>
                                        <option value="feedback">Feedback</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            {loading ? (
                                <div className="p-8 text-center">
                                    <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                                    <p className="text-slate-600">Loading concerns...</p>
                                </div>
                            ) : paginatedConcerns.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <FiMessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>No concerns found</p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Subject</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {paginatedConcerns.map((concern) => (
                                                    <tr key={concern.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <p className="font-medium text-slate-900 truncate max-w-xs">{concern.subject}</p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-sm text-slate-900">{concern.full_name}</p>
                                                            <p className="text-xs text-slate-500">{concern.user_email}</p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                                {getCategoryLabel(concern.category)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span
                                                                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${getStatusColor(
                                                                    concern.status
                                                                )}`}
                                                            >
                                                                {getStatusIcon(concern.status)}
                                                                {concern.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600">
                                                            {new Date(concern.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedConcern(concern);
                                                                    setAdminNotes(concern.admin_notes || '');
                                                                    setShowDetailModal(true);
                                                                }}
                                                                className="text-blue-600 hover:text-blue-700 font-semibold text-sm inline-flex items-center gap-1"
                                                            >
                                                                <FiEye size={16} />
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                                            <p className="text-sm text-slate-600">
                                                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredConcerns.length)} of{' '}
                                                {filteredConcerns.length}
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Previous
                                                </button>
                                                <div className="flex items-center gap-1">
                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                        <button
                                                            key={page}
                                                            onClick={() => setCurrentPage(page)}
                                                            className={`px-3 py-2 text-sm font-semibold rounded-lg ${currentPage === page
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            {page}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'feedbacks' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Total Feedbacks</p>
                                <p className="text-2xl font-bold text-slate-900">{feedbacks.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">New Feedback</p>
                                <p className="text-2xl font-bold text-blue-600">{feedbacks.filter((item) => item.status === 'new').length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Reviewed</p>
                                <p className="text-2xl font-bold text-emerald-600">{feedbacks.filter((item) => item.status === 'reviewed').length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Closed</p>
                                <p className="text-2xl font-bold text-slate-600">{feedbacks.filter((item) => item.status === 'closed').length}</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Search Feedback</label>
                                    <input
                                        type="text"
                                        value={feedbackSearch}
                                        onChange={(e) => setFeedbackSearch(e.target.value)}
                                        placeholder="Search by subject, name, or email..."
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                    <select
                                        value={feedbackStatusFilter}
                                        onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="new">New</option>
                                        <option value="reviewed">Reviewed</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            {feedbackLoading ? (
                                <div className="p-8 text-center">
                                    <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                                    <p className="text-slate-600">Loading feedback submissions...</p>
                                </div>
                            ) : filteredFeedbacks.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <FiMessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>No feedback submissions found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Subject</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Submitted</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {filteredFeedbacks.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-medium text-slate-900 truncate max-w-xs">{item.subject}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm text-slate-900">{item.full_name}</p>
                                                        <p className="text-xs text-slate-500">{item.user_email}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${getStatusColor(item.status)}`}>
                                                            {getStatusIcon(item.status)}
                                                            {item.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(item.created_at).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4 space-x-2">
                                                        <button
                                                            onClick={() => handleFeedbackStatusUpdate(item.id, item.status === 'new' ? 'reviewed' : 'closed')}
                                                            disabled={feedbackUpdating}
                                                            className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-xs font-semibold"
                                                        >
                                                            {item.status === 'new' ? 'Mark Reviewed' : 'Close'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'surveys' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Total Surveys</p>
                                <p className="text-2xl font-bold text-slate-900">{surveys.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Active Surveys</p>
                                <p className="text-2xl font-bold text-blue-600">{surveys.filter((survey) => survey.is_active).length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Total Responses</p>
                                <p className="text-2xl font-bold text-green-600">{Object.values(surveyResponseCounts).reduce((sum, count) => sum + count, 0)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-4">
                                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Manage Surveys</p>
                                    <button
                                        onClick={() => setShowSurveyForm((value) => !value)}
                                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-semibold"
                                    >
                                        <FiPlus /> Create Survey
                                    </button>
                                </div>
                                <div className="flex flex-col gap-4">
                                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">AI Survey Builder</p>
                                    <button
                                        onClick={() => setShowAIGenerator((value) => !value)}
                                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-slate-900 text-white px-4 py-2  h-9 rounded-full text-sm font-semibold"
                                    >
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        {showAIGenerator ? 'Cancel' : 'Generate AI'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {showSurveyForm && (
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900">{editingSurveyId ? 'Edit Survey' : 'New Survey'}</h3>
                                        <p className="text-sm text-slate-500">
                                            {editingSurveyId ? 'Update the survey and save your changes.' : 'Create a survey for learners and collect responses.'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {editingSurveyId && (
                                            <button
                                                onClick={() => {
                                                    resetSurveyForm();
                                                    setShowSurveyForm(false);
                                                }}
                                                className="text-sm text-slate-500 hover:text-slate-700"
                                            >
                                                Cancel Edit
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowSurveyForm(false)}
                                            className="text-white bg-red-600 px-3 py-1 text-sm font-semibold rounded-full"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Title</label>
                                        <input
                                            type="text"
                                            value={surveyFormData.title}
                                            onChange={(e) => setSurveyFormData({ ...surveyFormData, title: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                                        <input
                                            type="text"
                                            value={surveyFormData.description}
                                            onChange={(e) => setSurveyFormData({ ...surveyFormData, description: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Deadline (Optional)</label>
                                        <input
                                            type="datetime-local"
                                            value={surveyFormData.expires_at || ''}
                                            onChange={(e) => setSurveyFormData({ ...surveyFormData, expires_at: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Survey will automatically end after this date/time.</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-slate-700">Questions</h4>
                                    {surveyFormData.questions.map((question, index) => (
                                        <div key={question.id} className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                                            <div className="grid gap-4 lg:grid-cols-[1fr_auto] items-end">
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Question {index + 1}</label>
                                                    <input
                                                        type="text"
                                                        value={question.label}
                                                        onChange={(e) => updateSurveyQuestion(index, 'label', e.target.value)}
                                                        placeholder="Enter question text"
                                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Question Type</label>
                                                    <select
                                                        value={question.type}
                                                        onChange={(e) => updateSurveyQuestion(index, 'type', e.target.value)}
                                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="textarea">Long Text</option>
                                                        <option value="radio">Single Choice (MCQ)</option>
                                                        <option value="checkbox">Multiple Select</option>
                                                        <option value="likert">Likert Scale</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {['radio', 'checkbox', 'likert'].includes(question.type) && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-semibold text-slate-700">Options</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => addQuestionOption(index)}
                                                            className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                                                        >
                                                            + Add option
                                                        </button>
                                                    </div>
                                                    {(question.options || []).map((option, optionIndex) => (
                                                        <div key={optionIndex} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                value={option}
                                                                onChange={(e) => updateQuestionOption(index, optionIndex, e.target.value)}
                                                                placeholder={`Option ${optionIndex + 1}`}
                                                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeQuestionOption(index, optionIndex)}
                                                                className="text-slate-500 hover:text-slate-700 text-sm"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {question.type === 'likert' && (question.options || []).length === 0 && (
                                                        <div className="text-sm text-slate-500">Likert scale defaults to 5 options.</div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => removeSurveyQuestion(index)}
                                                    className="text-sm text-red-600 hover:text-red-700 rounded-full px-3 py-1 font-semibold bg-red-200 hover:bg-red-600 hover:text-white transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={addSurveyQuestion}
                                        type="button"
                                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-semibold"
                                    >
                                        + Add another question
                                    </button>
                                </div>

                                <button
                                    onClick={handleCreateSurvey}
                                    className="inline-flex items-center justify-center px-5 py-3 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700"
                                >
                                    {editingSurveyId ? 'Save Survey' : 'Publish Survey'}
                                </button>
                            </div>
                        )}

                        {showAIGenerator && (
                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900">AI Survey Generator</h3>
                                        <p className="text-sm text-slate-500">Generate survey questions automatically with AI and then adjust them before publishing.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Survey Name</label>
                                        <input
                                            type="text"
                                            value={aiSurveyName}
                                            onChange={(e) => setAISurveyName(e.target.value)}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                                        <input
                                            type="text"
                                            value={aiSurveyDescription}
                                            onChange={(e) => setAISurveyDescription(e.target.value)}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Question Type</label>
                                        <select
                                            value={aiQuestionType}
                                            onChange={(e) => setAIQuestionType(e.target.value as any)}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        >
                                            <option value="mixed">Mixed / Auto-select</option>
                                            <option value="text">Text</option>
                                            <option value="textarea">Long Text</option>
                                            <option value="radio">Single Choice</option>
                                            <option value="checkbox">Multiple Select</option>
                                            <option value="likert">Likert Scale</option>
                                            <option value="matrix">Matrix</option>
                                        </select>
                                        <p className="text-xs text-slate-500 mt-2">Choose mixed to let AI include multiple question types.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Number of Questions</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={aiNumQuestions}
                                            onChange={(e) => setAINumQuestions(Number(e.target.value))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">AI Provider</label>
                                        <select
                                            value={aiProvider}
                                            onChange={(e) => {
                                                const provider = e.target.value as 'gemini' | 'openrouter' | 'ollama';
                                                setAIProvider(provider);
                                                setAiModelSelectionFromProvider(provider);
                                            }}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        >
                                            <option value="gemini">Google Gemini</option>
                                            <option value="openrouter">OpenRouter</option>
                                            <option value="ollama">Ollama</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">AI Model</label>
                                    <select
                                        value={selectedAIModel}
                                        onChange={(e) => setSelectedAIModel(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    >
                                        {aiProvider === 'gemini' ? (
                                            <>
                                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                            </>
                                        ) : aiProvider === 'ollama' ? (
                                            <>
                                                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                                <option value="glm-5.1:cloud">GLM 5.1 Cloud</option>
                                                <option value="minimax-m2.7:cloud">MiniMax M2.7 Cloud</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="nvidia/nemotron-3-super-120b-a12b:free">Nemotron 3 Super 120B</option>
                                                <option value="nvidia/nemotron-3-nano-30b-a3b:free">Nemotron 3 Nano 30B</option>
                                                <option value="google/gemma-4-31b-a4b:free">Gemma 4 31B</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                {aiGenerating ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs font-medium text-blue-600">
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                                                <span>AI generating survey...</span>
                                            </div>
                                            <span>{aiGenerationProgress}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                                                style={{ width: `${aiGenerationProgress}%` }}
                                            />
                                        </div>
                                        {aiGenerationStatus && (
                                            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                                    {aiGenerationStatus}
                                                </p>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setAIGenerating(false)}
                                            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium"
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleGenerateSurveyWithAI}
                                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-semibold"
                                    >
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        Generate Survey with AI
                                    </button>
                                )}

                                {aiGenerationOutput.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto text-xs text-slate-600">
                                        {aiGenerationOutput.map((line, idx) => (
                                            <div key={idx}>{line}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            {surveyLoading ? (
                                <div className="p-8 text-center">
                                    <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                                    <p className="text-slate-600">Loading survey definitions...</p>
                                </div>
                            ) : surveys.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <FiMessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>No surveys created yet</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Title</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Questions</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Responses</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ends</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {surveys.map((survey) => (
                                                <tr key={survey.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 max-w-[24rem]">
                                                        <div className="font-medium text-slate-900">{survey.title}</div>
                                                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">{survey.description}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-700">{survey.questions.length}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-700">{surveyResponseCounts[survey.id] || 0}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-700">
                                                        {survey.expires_at ? new Date(survey.expires_at).toLocaleDateString() : 'Never'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${isSurveyExpired(survey) ? 'bg-red-100 text-red-800 border-red-300' : survey.is_active ? 'bg-green-100 text-green-800 border-green-300' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                                                            {isSurveyExpired(survey) ? 'Expired' : survey.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap items-center justify-start gap-2">
                                                            <button
                                                                title={survey.is_active ? 'Deactivate survey' : 'Activate survey'}
                                                                onClick={() => handleToggleSurveyActive(survey.id, survey.is_active)}
                                                                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100"
                                                            >
                                                                <FiCheckCircle />
                                                            </button>
                                                            <button
                                                                title="Edit survey"
                                                                onClick={() => handleEditSurvey(survey)}
                                                                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100"
                                                            >
                                                                <FiEdit3 />
                                                            </button>
                                                            <button
                                                                title="Export results"
                                                                onClick={() => handleExportSurveyResults(survey)}
                                                                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100"
                                                            >
                                                                <FiDownload />
                                                            </button>
                                                            <button
                                                                title="Delete survey"
                                                                onClick={() => handleDeleteSurvey(survey.id)}
                                                                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100"
                                                            >
                                                                <FiTrash2 />
                                                            </button>
                                                            <button
                                                                title={analyticsSurveyId === survey.id ? 'Hide analytics' : 'View analytics'}
                                                                onClick={() => setAnalyticsSurveyId(analyticsSurveyId === survey.id ? null : survey.id)}
                                                                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100"
                                                            >
                                                                <FiEye />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {analyticsSurveyId && surveyAnalytics && (
                            <div className="mt-6 bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Survey Analytics</p>
                                        <h3 className="text-xl font-semibold text-slate-900">{surveyAnalytics.survey.title}</h3>
                                        <p className="text-sm text-slate-500 mt-1">{surveyAnalytics.totalResponses} response{surveyAnalytics.totalResponses === 1 ? '' : 's'}</p>
                                    </div>
                                    <div className="min-w-[220px]">
                                        <label className="block text-xs font-semibold text-slate-500 mb-2">Select survey</label>
                                        <select
                                            value={analyticsSurveyId}
                                            onChange={(e) => setAnalyticsSurveyId(e.target.value)}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                        >
                                            <option value="">Choose a survey</option>
                                            {surveys.map((survey) => (
                                                <option key={survey.id} value={survey.id}>
                                                    {survey.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {surveyAnalytics.questionAnalytics.map(({ question, counts, textAnswers, totalResponses }, index) => (
                                    <div key={question.id} className="mt-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{index + 1}. {question.label}</p>
                                                <p className="text-xs text-slate-500">
                                                    {question.type === 'checkbox'
                                                        ? 'Multiple select'
                                                        : question.type === 'radio'
                                                            ? 'Single choice (MCQ)'
                                                            : question.type === 'likert'
                                                                ? 'Likert scale'
                                                                : question.type === 'textarea'
                                                                    ? 'Long text'
                                                                    : 'Text response'}
                                                </p>
                                            </div>
                                            <p className="text-xs text-slate-500">{totalResponses} response{totalResponses === 1 ? '' : 's'}</p>
                                        </div>

                                        {['radio', 'likert', 'checkbox'].includes(question.type) ? (
                                            <div className="mt-4 space-y-3">
                                                {Object.entries(counts).map(([option, count]) => {
                                                    const percent = totalResponses ? (count / totalResponses) * 100 : 0;
                                                    return (
                                                        <div key={option} className="space-y-2">
                                                            <div className="flex items-center justify-between text-sm text-slate-700">
                                                                <span>{option}</span>
                                                                <span className="font-semibold">{count} ({Math.round(percent)}%)</span>
                                                            </div>
                                                            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                                                <div className="h-full bg-blue-600" style={{ width: `${Math.round(percent)}%` }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="mt-4 grid gap-3">
                                                {textAnswers.length > 0 ? (
                                                    textAnswers.slice(0, 5).map((answer, idx) => (
                                                        <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                                            {answer}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-slate-500">No open text responses have been submitted yet.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {showDetailModal && selectedConcern &&
                ReactDOM.createPortal(
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
                            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-slate-200 p-6">
                                <h2 className="text-xl font-bold text-slate-900">Concern Details</h2>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-600 uppercase mb-3">User Information</h3>
                                    <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                                        <p className="text-slate-900">
                                            <span className="font-semibold">Name:</span> {selectedConcern.full_name}
                                        </p>
                                        <p className="text-slate-900">
                                            <span className="font-semibold">Email:</span> {selectedConcern.user_email}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold text-slate-600 uppercase mb-3">Concern Details</h3>
                                    <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-1">Category</p>
                                            <p className="text-slate-900 font-medium">{getCategoryLabel(selectedConcern.category)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-1">Subject</p>
                                            <p className="text-slate-900 font-medium">{selectedConcern.subject}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-1">Description</p>
                                            <p className="text-slate-700 whitespace-pre-wrap">{selectedConcern.description}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold mb-2">Current Status</p>
                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-full border ${getStatusColor(selectedConcern.status)}`}>
                                            {getStatusIcon(selectedConcern.status)}
                                            {selectedConcern.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold mb-2">Submitted</p>
                                        <p className="text-slate-900">{new Date(selectedConcern.created_at).toLocaleString()}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Admin Notes</label>
                                    <textarea
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        placeholder="Add internal notes about this concern..."
                                        rows={4}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                                        disabled={updatingStatus}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleStatusUpdate(selectedConcern.id, 'open')}
                                            disabled={updatingStatus || selectedConcern.status === 'open'}
                                            className="flex-1 bg-blue-100 hover:bg-blue-200 disabled:bg-slate-100 text-blue-800 disabled:text-slate-600 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                        >
                                            Mark as Open
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedConcern.id, 'in-progress')}
                                            disabled={updatingStatus || selectedConcern.status === 'in-progress'}
                                            className="flex-1 bg-yellow-100 hover:bg-yellow-200 disabled:bg-slate-100 text-yellow-800 disabled:text-slate-600 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                        >
                                            In Progress
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedConcern.id, 'resolved')}
                                            disabled={updatingStatus || selectedConcern.status === 'resolved'}
                                            className="flex-1 bg-green-100 hover:bg-green-200 disabled:bg-slate-100 text-green-800 disabled:text-slate-600 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                        >
                                            Resolved
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </AdminLayout>
    );
};

export default ConcernManagementPage;
