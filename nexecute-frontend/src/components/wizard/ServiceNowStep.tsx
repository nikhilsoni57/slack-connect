import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader, HelpCircle } from 'lucide-react';
import { WizardStepButtons } from './SetupWizard';
import type { WizardStepProps } from './SetupWizard';
import { cn } from '../../utils/cn';

interface ServiceNowData {
  instanceUrl: string;
  username: string;
  isValidated: boolean;
  oAuthToken?: string;
}

export function ServiceNowStep({ onComplete, onBack, isFirstStep, isLastStep, stepData }: WizardStepProps) {
  const [formData, setFormData] = useState<ServiceNowData>({
    instanceUrl: stepData?.instanceUrl || '',
    username: stepData?.username || '',
    isValidated: stepData?.isValidated || false,
    oAuthToken: stepData?.oAuthToken || undefined
  });
  
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);

  // URL validation
  const validateInstanceUrl = (url: string): boolean => {
    if (!url) return false;
    
    // ServiceNow instance URL patterns
    const patterns = [
      /^https:\/\/[a-zA-Z0-9-]+\.service-now\.com\/?$/,
      /^https:\/\/[a-zA-Z0-9-]+\.servicenowservices\.com\/?$/,
      /^https:\/\/[a-zA-Z0-9-]+\.service-now\.com\/[a-zA-Z0-9-]*\/?$/
    ];
    
    return patterns.some(pattern => pattern.test(url));
  };

  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ 
      ...prev, 
      instanceUrl: url,
      isValidated: false 
    }));
    setValidationError('');
  };

  const handleValidateConnection = async () => {
    if (!validateInstanceUrl(formData.instanceUrl)) {
      setValidationError('Please enter a valid ServiceNow instance URL (e.g., https://your-instance.service-now.com)');
      return;
    }

    if (!formData.username.trim()) {
      setValidationError('Please enter your ServiceNow username');
      return;
    }

    setIsValidating(true);
    setValidationError('');

    try {
      // Simulate API call to validate ServiceNow connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo purposes, simulate successful validation
      const isValid = Math.random() > 0.3; // 70% success rate for demo
      
      if (isValid) {
        setFormData(prev => ({ 
          ...prev, 
          isValidated: true,
          oAuthToken: 'mock-oauth-token-' + Date.now()
        }));
      } else {
        setValidationError('Unable to connect to ServiceNow instance. Please check your URL and credentials.');
      }
    } catch (error) {
      setValidationError('Connection failed. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleContinue = () => {
    onComplete(formData);
  };

  const isFormValid = formData.instanceUrl && formData.username && formData.isValidated;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect to ServiceNow</h2>
        <p className="text-gray-600">
          Connect your ServiceNow instance to enable seamless integration with Slack.
        </p>
      </div>

      {/* Help Toggle */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        <HelpCircle className="w-4 h-4" />
        {showHelp ? 'Hide Help' : 'Need Help?'}
      </button>

      {/* Help Section */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-blue-900">Finding Your ServiceNow Instance URL</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>Your ServiceNow instance URL typically looks like:</p>
            <div className="bg-white border border-blue-200 rounded px-3 py-2 font-mono text-sm">
              https://your-company.service-now.com
            </div>
            <div className="space-y-1">
              <p><strong>To find it:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Log into your ServiceNow instance</li>
                <li>Copy the URL from your browser address bar</li>
                <li>Remove any path after the domain (keep only the base URL)</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* Instance URL */}
        <div>
          <label htmlFor="instanceUrl" className="block text-sm font-medium text-gray-700 mb-1">
            ServiceNow Instance URL <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="url"
              id="instanceUrl"
              value={formData.instanceUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://your-instance.service-now.com"
              className={cn(
                'block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                validationError && !formData.isValidated ? 'border-red-300' : 'border-gray-300'
              )}
            />
            {formData.isValidated && (
              <CheckCircle className="absolute right-3 top-2.5 w-5 h-5 text-green-500" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Example: https://acme.service-now.com
          </p>
        </div>

        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            ServiceNow Username <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="username"
            value={formData.username}
            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value, isValidated: false }))}
            placeholder="your.username"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your ServiceNow login username (not email)
          </p>
        </div>

        {/* Test Connection Button */}
        <div>
          <button
            onClick={handleValidateConnection}
            disabled={!formData.instanceUrl || !formData.username || isValidating}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium',
              (!formData.instanceUrl || !formData.username || isValidating)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : formData.isValidated
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            {isValidating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Testing Connection...
              </>
            ) : formData.isValidated ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Connection Verified
              </>
            ) : (
              'Test Connection'
            )}
          </button>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Success Message */}
        {formData.isValidated && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>Successfully connected to ServiceNow instance!</span>
          </div>
        )}
      </div>

      {/* OAuth Information */}
      {formData.isValidated && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Connection Details</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div><span className="font-medium">Instance:</span> {formData.instanceUrl}</div>
            <div><span className="font-medium">User:</span> {formData.username}</div>
            <div><span className="font-medium">Status:</span> <span className="text-green-600">Connected</span></div>
          </div>
        </div>
      )}

      {/* Next Steps Info */}
      {formData.isValidated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">What's Next?</h3>
          <p className="text-sm text-blue-800">
            Great! Your ServiceNow connection is ready. Next, we'll connect your Slack workspace to complete the integration.
          </p>
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
        nextLabel="Continue to Slack"
      />
    </div>
  );
}