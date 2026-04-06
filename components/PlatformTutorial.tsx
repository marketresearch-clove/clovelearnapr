import React, { useState } from 'react';
import { FiX, FiChevronRight, FiChevronLeft } from 'react-icons/fi';

const borderLightAnimation = `
  @keyframes borderShine {
    0% {
      box-shadow: 0 0 10px 2px rgba(168, 85, 247, 0.3), inset 0 0 10px rgba(168, 85, 247, 0.1);
    }
    50% {
      box-shadow: 0 0 25px 5px rgba(168, 85, 247, 0.8), inset 0 0 15px rgba(168, 85, 247, 0.3);
    }
    100% {
      box-shadow: 0 0 10px 2px rgba(168, 85, 247, 0.3), inset 0 0 10px rgba(168, 85, 247, 0.1);
    }
  }
  
  .highlight-border-shine {
    animation: borderShine 2s ease-in-out infinite;
  }
`;

interface TutorialStep {
    id: number;
    title: string;
    description: string;
    highlight?: string;
    icon?: string;
    action?: string;
}

interface PlatformTutorialProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    currentStep?: number;
}

const PlatformTutorial: React.FC<PlatformTutorialProps> = ({ isOpen, onClose, onComplete, currentStep: externalStep }) => {
    const [currentStep, setCurrentStep] = useState(externalStep ?? 0);

    React.useEffect(() => {
        if (externalStep !== undefined) {
            setCurrentStep(externalStep);
        }
    }, [externalStep]);

    // Emit tutorial started/ended events
    React.useEffect(() => {
        if (isOpen) {
            const event = new Event('tutorial-started');
            window.dispatchEvent(event);
        } else {
            const event = new Event('tutorial-ended');
            window.dispatchEvent(event);
        }
    }, [isOpen]);

    const steps: TutorialStep[] = [
        {
            id: 1,
            title: 'Welcome to Clove Learning Portal! 👋',
            description: 'Let\'s take a quick tour of the platform to help you get started. This walkthrough will show you all the key features and sections.',
            icon: 'welcome',
            action: 'Get Started'
        },
        {
            id: 2,
            title: 'Set Up Your Profile Photo',
            description: 'Click on your profile icon in the top-right corner to upload a profile photo. This helps others recognize you and personalizes your learning experience.',
            highlight: 'profile-icon',
            icon: 'profile',
            action: 'Upload Photo'
        },
        {
            id: 3,
            title: 'Dashboard Overview',
            description: 'Your Dashboard shows key statistics: Courses In Progress, Courses Completed, Hours Learned, and Certificates Earned. Track your learning journey here!',
            highlight: 'menu-dashboard',
            icon: 'dashboard',
            action: 'Next'
        },
        {
            id: 4,
            title: 'Explore the Catalog',
            description: 'Browse and discover learning courses across various categories. Find courses that match your interests and career goals.',
            highlight: 'menu-catalog',
            icon: 'catalog',
            action: 'Next'
        },
        {
            id: 5,
            title: 'My Learning Path',
            description: 'View all your enrolled courses, track progress, and continue learning. Access lesson materials, assignments, and quizzes here.',
            highlight: 'menu-learning',
            icon: 'learning',
            action: 'Next'
        },
        {
            id: 6,
            title: 'Calendar & Schedules',
            description: 'Keep track of course deadlines, live sessions, and important learning milestones all in one place.',
            highlight: 'menu-calendar',
            icon: 'calendar',
            action: 'Next'
        },
        {
            id: 7,
            title: 'Community & Forums',
            description: 'Connect with fellow learners, participate in discussions, share knowledge, and collaborate on projects.',
            highlight: 'menu-community',
            icon: 'community',
            action: 'Next'
        },
        {
            id: 8,
            title: 'Leaderboard',
            description: 'See how you rank among other learners. Competition can be motivating! Check your position and strive for the top.',
            highlight: 'menu-leaderboard',
            icon: 'leaderboard',
            action: 'Next'
        },
        {
            id: 9,
            title: 'Profile & Settings',
            description: 'Update your personal information, preferences, and account settings. This is where you manage your account details and learning preferences.',
            highlight: 'profile-icon',
            icon: 'settings',
            action: 'Next'
        },
        {
            id: 10,
            title: 'You\'re All Set! 🎉',
            description: 'You now have a complete overview of the Skill-Spire platform. Start exploring, enroll in courses, and begin your learning journey!',
            icon: 'complete',
            action: 'Start Learning'
        }
    ];

    const step = steps[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;

    // Initialize highlight rect state early (before any conditional returns)
    const [highlightRect, setHighlightRect] = React.useState<DOMRect | null>(null);

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
            onClose();
        } else {
            setCurrentStep(curr => curr + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(curr => curr - 1);
        }
    };

    const handleSkip = () => {
        onComplete();
        onClose();
    };

    // Get the element to highlight based on current step
    const getHighlightElement = () => {
        const step = steps[currentStep];
        if (!step?.highlight) return null;
        return document.querySelector(`[data-tutorial="${step.highlight}"]`);
    };

    // Update highlight rect on step change and window events
    React.useEffect(() => {
        const updateRect = () => {
            const element = getHighlightElement();
            if (element) {
                setHighlightRect(element.getBoundingClientRect());
            } else {
                setHighlightRect(null);
            }
        };

        // Update immediately
        updateRect();

        // Update on window events
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect);
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
        };
    }, [currentStep]);

    if (!isOpen) return null;

    return (
        <>
            <style>{borderLightAnimation}</style>

            {/* Highlight Border with Shine Effect - Shows border on relevant section */}
            {highlightRect && (
                <>
                    {/* Border frame with shine effect */}
                    <div
                        className="highlight-border-shine fixed z-[191] pointer-events-none border-2 border-indigo-500 rounded-lg"
                        style={{
                            top: `${highlightRect.top - 8}px`,
                            left: `${highlightRect.left - 8}px`,
                            width: `${highlightRect.width + 16}px`,
                            height: `${highlightRect.height + 16}px`,
                        }}
                    />
                </>
            )}

            {/* Backdrop and Tutorial Modal */}
            <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center">
                {/* Tutorial Modal */}
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-8 text-white">
                        <button
                            onClick={handleSkip}
                            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                        >
                            <FiX size={24} />
                        </button>

                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold">{step.title}</h2>
                        </div>

                        {/* Step Indicator */}
                        <div className="flex items-center gap-2 text-sm text-primary-100">
                            <div className="flex gap-1">
                                {steps.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all ${idx === currentStep
                                            ? 'bg-white w-8'
                                            : idx < currentStep
                                                ? 'bg-primary-200 w-2'
                                                : 'bg-primary-300 w-2'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-6">
                        {/* Icon */}
                        <div className="mb-6 flex justify-center">
                            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                                {step.id === 1 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        rocket_launch
                                    </span>
                                )}
                                {step.id === 2 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        account_circle
                                    </span>
                                )}
                                {step.id === 3 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        dashboard
                                    </span>
                                )}
                                {step.id === 4 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        grid_view
                                    </span>
                                )}
                                {step.id === 5 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        school
                                    </span>
                                )}
                                {step.id === 6 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        calendar_month
                                    </span>
                                )}
                                {step.id === 7 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        forum
                                    </span>
                                )}
                                {step.id === 8 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        leaderboard
                                    </span>
                                )}
                                {step.id === 9 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        settings
                                    </span>
                                )}
                                {step.id === 10 && (
                                    <span className="material-symbols-rounded text-primary-600 text-3xl">
                                        done_all
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <p className="text-slate-800 text-center mb-2 text-sm leading-relaxed">
                            {step.description}
                        </p>

                        {/* Additional Info for specific steps */}
                        {step.id === 3 && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs text-blue-700">
                                    💡 Use these metrics to track your learning progress over time.
                                </p>
                            </div>
                        )}

                        {step.id === 2 && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs text-blue-700">
                                    📸 A profile photo helps build your professional identity on the platform.
                                </p>
                            </div>
                        )}

                        {step.id === 10 && (
                            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                <p className="text-xs text-green-700">
                                    ✨ Need help anytime? Click the help icon in the sidebar to restart this tour.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                        <button
                            onClick={handleSkip}
                            className="text-slate-800 hover:text-slate-900 text-sm font-medium transition-colors"
                        >
                            Skip
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrev}
                                disabled={isFirstStep}
                                className="flex items-center gap-1 px-3 py-2 text-slate-800 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <FiChevronLeft size={18} />
                                <span className="text-sm font-medium hidden sm:inline">Back</span>
                            </button>

                            <button
                                onClick={handleNext}
                                className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
                            >
                                <span>{step.action}</span>
                                <FiChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Progress Text */}
                    <div className="px-6 py-2 text-center text-xs text-slate-800 bg-slate-50">
                        Step {currentStep + 1} of {steps.length}
                    </div>
                </div>
            </div>
        </>
    );
};

export default PlatformTutorial;
