import { useState } from 'react';
import { CheckCircle, AlertCircle, Loader, RefreshCw, MessageSquare, Database, Zap, ArrowRight } from 'lucide-react';
import { WizardStepButtons } from './SetupWizard';
import type { WizardStepProps } from './SetupWizard';

interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  errorMessage?: string;
  duration?: number;
}

interface TestData {
  tests: TestResult[];
  allTestsPassed: boolean;
  canRetry: boolean;
}

export function TestConnectionStep({ onComplete, onBack, isFirstStep, isLastStep }: WizardStepProps) {
  const [testData, setTestData] = useState<TestData>({
    tests: [
      {
        id: 'servicenow',
        name: 'ServiceNow Connection',
        description: 'Testing connection to ServiceNow instance',
        status: 'pending'
      },
      {
        id: 'servicenow-auth',
        name: 'ServiceNow Authentication',
        description: 'Verifying user credentials and permissions',
        status: 'pending'
      },
      {
        id: 'slack',
        name: 'Slack App Connection',
        description: 'Testing Slack app installation and permissions',
        status: 'pending'
      },
      {
        id: 'integration',
        name: 'End-to-End Integration',
        description: 'Testing complete ServiceNow to Slack workflow',
        status: 'pending'
      }
    ],
    allTestsPassed: false,
    canRetry: false
  });

  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    setHasStarted(true);
    
    // Reset all tests to pending
    setTestData(prev => ({
      ...prev,
      tests: prev.tests.map(test => ({ ...test, status: 'pending' })),
      allTestsPassed: false,
      canRetry: false
    }));

    const tests = [...testData.tests];
    
    for (let i = 0; i < tests.length; i++) {
      // Set current test to running
      setTestData(prev => ({
        ...prev,
        tests: prev.tests.map((test, index) => 
          index === i ? { ...test, status: 'running' } : test
        )
      }));

      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

      // Simulate test results (50% success rate for demo to show retry functionality)
      const success = Math.random() > 0.5;
      const duration = Math.round(1000 + Math.random() * 2000);

      if (success) {
        setTestData(prev => ({
          ...prev,
          tests: prev.tests.map((test, index) => 
            index === i ? { ...test, status: 'success', duration } : test
          )
        }));
      } else {
        // Simulate different error messages
        const errorMessages = [
          'Connection timeout - please check network connectivity',
          'Authentication failed - please verify credentials',
          'Permission denied - insufficient user privileges',
          'Service temporarily unavailable'
        ];
        
        setTestData(prev => ({
          ...prev,
          tests: prev.tests.map((test, index) => 
            index === i ? { 
              ...test, 
              status: 'error', 
              duration,
              errorMessage: errorMessages[Math.floor(Math.random() * errorMessages.length)]
            } : test
          ),
          canRetry: true
        }));

        setIsRunning(false);
        return;
      }
    }

    // All tests passed
    setTestData(prev => ({
      ...prev,
      allTestsPassed: true
    }));
    setIsRunning(false);
  };

  const retryFailedTests = async () => {
    const failedTests = testData.tests.filter(test => test.status === 'error');
    if (failedTests.length === 0) return;

    setIsRunning(true);
    
    // Reset canRetry to prevent multiple clicks
    setTestData(prev => ({ ...prev, canRetry: false }));

    for (const failedTest of failedTests) {
      const testIndex = testData.tests.findIndex(test => test.id === failedTest.id);
      
      // Set current test to running
      setTestData(prev => ({
        ...prev,
        tests: prev.tests.map((test, index) => 
          index === testIndex ? { ...test, status: 'running', errorMessage: undefined } : test
        )
      }));

      await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 800));

      // Higher success rate for retry (85%)
      const success = Math.random() > 0.15;
      const duration = Math.round(800 + Math.random() * 1200);

      if (success) {
        setTestData(prev => ({
          ...prev,
          tests: prev.tests.map((test, index) => 
            index === testIndex ? { ...test, status: 'success', duration } : test
          )
        }));
      } else {
        setTestData(prev => ({
          ...prev,
          tests: prev.tests.map((test, index) => 
            index === testIndex ? { 
              ...test, 
              status: 'error',
              duration,
              errorMessage: 'Retry failed - please check configuration and try again'
            } : test
          ),
          canRetry: true
        }));
        setIsRunning(false);
        return;
      }
    }

    // Final check if all tests now pass - use a fresh callback to ensure latest state
    setTestData(prev => {
      const allPassed = prev.tests.every(test => test.status === 'success');
      return {
        ...prev,
        allTestsPassed: allPassed,
        canRetry: !allPassed
      };
    });
    setIsRunning(false);
  };

  const handleContinue = () => {
    const stepData = {
      testResults: testData.tests,
      allTestsPassed: testData.allTestsPassed
    };
    
    if (isLastStep) {
      onComplete(stepData);
    } else {
      onComplete(stepData);
    }
  };

  const getTestIcon = (test: TestResult) => {
    switch (test.id) {
      case 'servicenow':
      case 'servicenow-auth':
        return Database;
      case 'slack':
        return MessageSquare;
      case 'integration':
        return Zap;
      default:
        return CheckCircle;
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
      case 'running':
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Integration</h2>
        <p className="text-gray-600">
          Let's test your ServiceNow and Slack integration to ensure everything is working correctly.
        </p>
      </div>

      {/* Test Button */}
      {!hasStarted && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Zap className="w-8 h-8 text-blue-600" />
          </div>
          
          <button
            onClick={runTests}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Zap className="w-5 h-5" />
            Start Connection Test
          </button>
          
          <p className="text-sm text-gray-500">
            This will test all connections and take approximately 30 seconds
          </p>
        </div>
      )}

      {/* Test Results */}
      {hasStarted && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
            {testData.tests.map((test) => {
              const TestIcon = getTestIcon(test);
              return (
                <div key={test.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <TestIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{test.name}</div>
                        <div className="text-xs text-gray-500">{test.description}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {test.duration && (
                        <span className="text-xs text-gray-500">{test.duration}ms</span>
                      )}
                      {getStatusIcon(test.status)}
                    </div>
                  </div>
                  
                  {test.errorMessage && (
                    <div className="mt-2 pl-10 text-sm text-red-600">
                      {test.errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Retry Button */}
          {testData.canRetry && !isRunning && (
            <div className="text-center">
              <button
                onClick={retryFailedTests}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Failed Tests
              </button>
            </div>
          )}

          {/* Success Message */}
          {testData.allTestsPassed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="text-sm font-medium text-green-900">All Tests Passed!</h3>
                  <p className="text-sm text-green-800 mt-1">
                    Your ServiceNow and Slack integration is working perfectly. You're ready to start receiving notifications.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Integration Flow Preview */}
          {testData.allTestsPassed && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">How it works:</h3>
              <div className="flex items-center justify-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>ServiceNow Incident</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-orange-600" />
                  <span>Nexecute Connect</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  <span>Slack Notification</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <WizardStepButtons
        onBack={onBack}
        onNext={handleContinue}
        onComplete={handleContinue}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        nextDisabled={!testData.allTestsPassed}
        nextLabel={isLastStep ? "Complete Setup" : "Continue to Summary"}
        completeLabel="Complete Setup"
      />
    </div>
  );
}