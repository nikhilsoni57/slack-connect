import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/app';
import { 
  SetupWizard, 
  ServiceNowStep, 
  SlackStep, 
  TestConnectionStep, 
  CompletionStep 
} from '../components/wizard';
import type { WizardStep } from '../components/wizard';

export function SetupPage() {
  const { setPageTitle } = useAppStore();
  const navigate = useNavigate();
  const [setupStartTime] = useState(Date.now());

  useEffect(() => {
    setPageTitle('Connection Setup');
  }, [setPageTitle]);

  const wizardSteps: WizardStep[] = [
    {
      id: 'servicenow',
      title: 'ServiceNow',
      description: 'Connect your ServiceNow instance',
      component: ServiceNowStep
    },
    {
      id: 'slack',
      title: 'Slack',
      description: 'Install Slack app',
      component: SlackStep
    },
    {
      id: 'test',
      title: 'Test',
      description: 'Verify integration',
      component: TestConnectionStep
    },
    {
      id: 'complete',
      title: 'Complete',
      description: 'Setup finished',
      component: CompletionStep
    }
  ];

  const handleSetupComplete = (allData: any) => {
    const setupTime = Math.round((Date.now() - setupStartTime) / 1000 / 60 * 10) / 10; // Minutes with 1 decimal
    
    console.log('Setup completed in', setupTime, 'minutes');
    console.log('Setup data:', allData);
    
    // In real implementation, save setup data to backend
    // await apiService.post('/setup/complete', { ...allData, setupTime });
    
    // Navigate to dashboard after a short delay to show completion
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Setup Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Nexecute Connect</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Let's get your ServiceNow and Slack integration set up in under 10 minutes. 
            This wizard will guide you through each step.
          </p>
        </div>

        {/* Time Expectation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-sm text-blue-800">Estimated time: <strong>5-8 minutes</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              <span className="text-sm text-blue-800">Target: <strong>Under 10 minutes</strong></span>
            </div>
          </div>
        </div>

        {/* Wizard */}
        <SetupWizard
          steps={wizardSteps}
          onComplete={handleSetupComplete}
          title="Connection Setup Wizard"
          subtitle="Follow these steps to connect ServiceNow and Slack"
          startTime={setupStartTime}
        />

        {/* Help Section */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            Need help? Check out our{' '}
            <a href="#" className="text-blue-600 hover:text-blue-800 underline">
              setup guide
            </a>{' '}
            or{' '}
            <a href="#" className="text-blue-600 hover:text-blue-800 underline">
              contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}