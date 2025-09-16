import { useState } from 'react';
import { ExternalLink, AlertCircle, CheckCircle, Loader, MessageSquare, Users, Bell, HelpCircle } from 'lucide-react';
import { WizardStepButtons } from './SetupWizard';
import type { WizardStepProps } from './SetupWizard';
import { cn } from '../../utils/cn';

interface SlackData {
  workspaceName: string;
  isInstalled: boolean;
  installationUrl?: string;
  channelId?: string;
  botToken?: string;
}

export function SlackStep({ onComplete, onBack, isFirstStep, isLastStep, stepData }: WizardStepProps) {
  const [formData, setFormData] = useState<SlackData>({
    workspaceName: stepData?.workspaceName || '',
    isInstalled: stepData?.isInstalled || false,
    installationUrl: stepData?.installationUrl || undefined,
    channelId: stepData?.channelId || undefined,
    botToken: stepData?.botToken || undefined
  });
  
  const [isInstalling, setIsInstalling] = useState(false);
  const [installationError, setInstallationError] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [step, setStep] = useState<'workspace' | 'install' | 'configure'>('workspace');

  const handleWorkspaceSubmit = () => {
    if (!formData.workspaceName.trim()) {
      setInstallationError('Please enter your Slack workspace name');
      return;
    }
    
    setInstallationError('');
    setStep('install');
    
    // Generate installation URL (in real implementation, this would come from your backend)
    const installUrl = `https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=chat:write,channels:read,users:read&workspace=${encodeURIComponent(formData.workspaceName)}`;
    setFormData(prev => ({ ...prev, installationUrl: installUrl }));
  };

  const handleInstallApp = async () => {
    setIsInstalling(true);
    setInstallationError('');

    try {
      // Simulate Slack app installation process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // For demo purposes, simulate successful installation
      const isSuccess = Math.random() > 0.2; // 80% success rate for demo
      
      if (isSuccess) {
        setFormData(prev => ({ 
          ...prev, 
          isInstalled: true,
          botToken: 'xoxb-mock-token-' + Date.now(),
          channelId: 'C' + Math.random().toString(36).substr(2, 9).toUpperCase()
        }));
        setStep('configure');
      } else {
        setInstallationError('Installation failed. Please try again or contact your Slack administrator.');
      }
    } catch (error) {
      setInstallationError('Installation failed. Please try again.');
    } finally {
      setIsInstalling(false);
    }
  };

  const handleContinue = () => {
    onComplete(formData);
  };

  const isFormValid = formData.workspaceName && formData.isInstalled;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect to Slack</h2>
        <p className="text-gray-600">
          Install the Nexecute Connect app in your Slack workspace to receive ServiceNow notifications.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center space-x-4 text-sm">
        <div className={cn(
          'flex items-center space-x-2',
          step === 'workspace' ? 'text-blue-600' : 'text-green-600'
        )}>
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
            step === 'workspace' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
          )}>
            {step === 'workspace' ? '1' : '✓'}
          </div>
          <span>Workspace</span>
        </div>
        
        <div className="flex-1 h-px bg-gray-300" />
        
        <div className={cn(
          'flex items-center space-x-2',
          step === 'install' ? 'text-blue-600' : step === 'configure' ? 'text-green-600' : 'text-gray-400'
        )}>
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
            step === 'install' ? 'bg-blue-600 text-white' : 
            step === 'configure' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'
          )}>
            {step === 'configure' ? '✓' : '2'}
          </div>
          <span>Install App</span>
        </div>
        
        <div className="flex-1 h-px bg-gray-300" />
        
        <div className={cn(
          'flex items-center space-x-2',
          step === 'configure' ? 'text-blue-600' : 'text-gray-400'
        )}>
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
            step === 'configure' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
          )}>
            3
          </div>
          <span>Configure</span>
        </div>
      </div>

      {/* Step 1: Workspace Selection */}
      {step === 'workspace' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="workspaceName" className="block text-sm font-medium text-gray-700 mb-1">
              Slack Workspace Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="workspaceName"
                value={formData.workspaceName}
                onChange={(e) => setFormData(prev => ({ ...prev, workspaceName: e.target.value }))}
                placeholder="your-workspace"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This is the name in your Slack URL: https://your-workspace.slack.com
            </p>
          </div>

          {/* Help Section */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            <HelpCircle className="w-4 h-4" />
            {showHelp ? 'Hide Help' : 'How to find your workspace name?'}
          </button>

          {showHelp && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-blue-900">Finding Your Slack Workspace Name</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p>Your workspace name appears in your Slack URL:</p>
                <div className="bg-white border border-blue-200 rounded px-3 py-2 font-mono text-sm">
                  https://<span className="bg-yellow-200">your-workspace</span>.slack.com
                </div>
                <div className="space-y-1">
                  <p><strong>To find it:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Open Slack in your browser</li>
                    <li>Look at the URL in the address bar</li>
                    <li>Copy the part before ".slack.com"</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleWorkspaceSubmit}
            disabled={!formData.workspaceName.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium',
              !formData.workspaceName.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            Continue to App Installation
          </button>
        </div>
      )}

      {/* Step 2: App Installation */}
      {step === 'install' && (
        <div className="space-y-4">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Install Nexecute Connect App</h3>
              <p className="text-gray-600">
                Click the button below to install the Nexecute Connect app in your <strong>{formData.workspaceName}</strong> workspace.
              </p>
            </div>

            {/* Features List */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
              <h4 className="font-medium text-gray-900 mb-3">The app will be able to:</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <span>Send ServiceNow incident notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Access channel and user information</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span>Post messages to designated channels</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleInstallApp}
              disabled={isInstalling}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium',
                isInstalling
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              )}
            >
              {isInstalling ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Installing App...
                </>
              ) : (
                <>
                  <ExternalLink className="w-5 h-5" />
                  Install to Slack
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configuration Complete */}
      {step === 'configure' && (
        <div className="space-y-4">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Slack App Installed Successfully!</h3>
              <p className="text-gray-600">
                The Nexecute Connect app is now installed in your <strong>{formData.workspaceName}</strong> workspace.
              </p>
            </div>
          </div>

          {/* Installation Details */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-900 mb-2">Installation Details</h3>
            <div className="text-sm text-green-800 space-y-1">
              <div><span className="font-medium">Workspace:</span> {formData.workspaceName}.slack.com</div>
              <div><span className="font-medium">App Status:</span> <span className="text-green-600">Active</span></div>
              <div><span className="font-medium">Permissions:</span> Notifications, Channel Access</div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">What's Next?</h3>
            <p className="text-sm text-blue-800">
              Perfect! Both ServiceNow and Slack are now connected. Next, we'll test the integration to make sure everything is working properly.
            </p>
          </div>
        </div>
      )}

      {/* Installation Error */}
      {installationError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{installationError}</span>
        </div>
      )}

      {/* Navigation Buttons */}
      <WizardStepButtons
        onBack={onBack}
        onNext={handleContinue}
        onComplete={handleContinue}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        nextDisabled={!isFormValid}
        nextLabel="Test Connection"
      />
    </div>
  );
}