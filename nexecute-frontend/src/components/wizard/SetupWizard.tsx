import { useState, useCallback, useEffect } from 'react';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<WizardStepProps>;
  isComplete?: boolean;
  isOptional?: boolean;
}

export interface WizardStepProps {
  onNext: () => void;
  onBack: () => void;
  onComplete: (data: any) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  stepData: any;
}

interface SetupWizardProps {
  steps: WizardStep[];
  onComplete: (allData: any) => void;
  className?: string;
  title?: string;
  subtitle?: string;
  startTime?: number;
}

export function SetupWizard({ 
  steps, 
  onComplete, 
  className, 
  title = "Setup Wizard",
  subtitle = "Complete the following steps to get started",
  startTime
}: SetupWizardProps) {
  // Persist wizard state in localStorage
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('nexecute-wizard-step');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const [stepData, setStepData] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('nexecute-wizard-data');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('nexecute-wizard-completed');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('nexecute-wizard-step', currentStep.toString());
  }, [currentStep]);

  useEffect(() => {
    localStorage.setItem('nexecute-wizard-data', JSON.stringify(stepData));
  }, [stepData]);

  useEffect(() => {
    localStorage.setItem('nexecute-wizard-completed', JSON.stringify(Array.from(completedSteps)));
  }, [completedSteps]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, steps.length]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleStepComplete = useCallback((data: any) => {
    const stepId = steps[currentStep].id;
    const newStepData = { ...stepData, [stepId]: data };
    setStepData(newStepData);
    
    if (currentStep === steps.length - 1) {
      // Last step completed - clear saved state
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      localStorage.removeItem('nexecute-wizard-step');
      localStorage.removeItem('nexecute-wizard-data');
      localStorage.removeItem('nexecute-wizard-completed');
      onComplete(newStepData);
    } else {
      handleNext();
    }
  }, [currentStep, steps, stepData, onComplete, handleNext]);

  const handleStepClick = useCallback((stepIndex: number) => {
    // Only allow clicking on completed steps or the next step
    if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
      setCurrentStep(stepIndex);
    }
  }, [currentStep, completedSteps]);

  const clearProgress = useCallback(() => {
    localStorage.removeItem('nexecute-wizard-step');
    localStorage.removeItem('nexecute-wizard-data');
    localStorage.removeItem('nexecute-wizard-completed');
    setCurrentStep(0);
    setStepData({});
    setCompletedSteps(new Set());
  }, []);

  const CurrentStepComponent = steps[currentStep]?.component;

  return (
    <div className={cn('max-w-4xl mx-auto', className)}>
      {/* Header with Start Over Button */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600">{subtitle}</p>
        </div>
        {(currentStep > 0 || completedSteps.size > 0) && (
          <button
            onClick={clearProgress}
            className="text-sm text-gray-500 hover:text-red-600 underline"
          >
            Start Over
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center justify-between">
          {steps.map((step, stepIndex) => {
            const isCompleted = completedSteps.has(stepIndex);
            const isCurrent = stepIndex === currentStep;
            const isClickable = stepIndex <= currentStep || isCompleted;

            return (
              <li key={step.id} className="relative flex-1">
                <button
                  onClick={() => isClickable && handleStepClick(stepIndex)}
                  disabled={!isClickable}
                  className={cn(
                    'group flex flex-col items-center p-4 rounded-lg transition-all duration-200',
                    isClickable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed',
                    isCurrent && 'bg-blue-50'
                  )}
                >
                  {/* Step Circle */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 mb-2 transition-colors">
                    {isCompleted ? (
                      <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                        <CheckIcon className="w-6 h-6 text-white" />
                      </div>
                    ) : (
                      <div className={cn(
                        'w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium',
                        isCurrent 
                          ? 'border-blue-600 bg-blue-600 text-white' 
                          : 'border-gray-300 bg-white text-gray-500'
                      )}>
                        {stepIndex + 1}
                      </div>
                    )}
                  </div>
                  
                  {/* Step Title */}
                  <div className="text-center">
                    <div className={cn(
                      'text-sm font-medium',
                      isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    )}>
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 max-w-24 hidden sm:block">
                      {step.description}
                    </div>
                  </div>
                </button>

                {/* Connector Line */}
                {stepIndex < steps.length - 1 && (
                  <div className="absolute top-5 right-0 left-full w-full flex items-center">
                    <ChevronRightIcon className="w-5 h-5 text-gray-300 mx-2" />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {CurrentStepComponent && (
          <CurrentStepComponent
            onNext={handleNext}
            onBack={handleBack}
            onComplete={handleStepComplete}
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === steps.length - 1}
            stepData={{
              ...stepData[steps[currentStep].id] || {},
              ...(steps[currentStep].id === 'complete' && startTime ? {
                setupStartTime: startTime,
                setupTime: Math.round((Date.now() - startTime) / 1000 / 60 * 10) / 10
              } : {})
            }}
          />
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(((completedSteps.size + (currentStep > completedSteps.size ? 1 : 0)) / steps.length) * 100)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ 
              width: `${((completedSteps.size + (currentStep > completedSteps.size ? 0.5 : 0)) / steps.length) * 100}%` 
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Helper component for step navigation buttons
export function WizardStepButtons({ 
  onBack, 
  onNext, 
  onComplete,
  isFirstStep, 
  isLastStep, 
  nextDisabled = false,
  nextLabel = "Continue",
  completeLabel = "Complete Setup"
}: {
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
  completeLabel?: string;
}) {
  return (
    <div className="flex justify-between pt-6 border-t border-gray-200 mt-6">
      <button
        type="button"
        onClick={onBack}
        disabled={isFirstStep}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-md border',
          isFirstStep 
            ? 'text-gray-400 border-gray-200 cursor-not-allowed' 
            : 'text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        )}
      >
        Back
      </button>
      
      <button
        type="button"
        onClick={isLastStep ? onComplete : onNext}
        disabled={nextDisabled}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-md',
          nextDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        )}
      >
        {isLastStep ? completeLabel : nextLabel}
      </button>
    </div>
  );
}