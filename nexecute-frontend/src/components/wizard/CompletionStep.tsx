import { CheckCircle, Database, MessageSquare, Bell, Users, Settings, ExternalLink, ArrowRight } from 'lucide-react';
import type { WizardStepProps } from './SetupWizard';

export function CompletionStep({ stepData, onComplete }: WizardStepProps) {
  const serviceNowData = stepData?.servicenow || {};
  const slackData = stepData?.slack || {};
  // Remove unused testData variable
  // const testData = stepData?.test || {};

  const setupTimeMinutes = stepData?.setupTime || 8;
  const setupTime = setupTimeMinutes < 1 ? `${Math.round(setupTimeMinutes * 60)} seconds` : `${setupTimeMinutes} minutes`;

  return (
    <div className="space-y-6 text-center">
      {/* Success Header */}
      <div className="space-y-4">
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🎉 Setup Complete!</h2>
          <p className="text-lg text-gray-600">
            Your ServiceNow and Slack integration is ready to go
          </p>
          <p className="text-sm text-green-600 font-medium mt-2">
            ⏱ Completed in {setupTime} - Under the 10-minute target!
          </p>
        </div>
      </div>

      {/* Connection Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-left">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Summary</h3>
        
        <div className="space-y-4">
          {/* ServiceNow */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Database className="w-6 h-6 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">ServiceNow</div>
                <div className="text-sm text-gray-600">{serviceNowData.instanceUrl || 'Connected'}</div>
              </div>
            </div>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>

          {/* Slack */}
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-6 h-6 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">Slack</div>
                <div className="text-sm text-gray-600">{slackData.workspaceName || 'your-workspace'}.slack.com</div>
              </div>
            </div>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">What Happens Next?</h3>
        
        <div className="space-y-3 text-sm text-blue-800">
          <div className="flex items-center space-x-3">
            <Bell className="w-4 h-4 text-blue-600" />
            <span>You'll receive Slack notifications for new ServiceNow incidents</span>
          </div>
          <div className="flex items-center space-x-3">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Team members can be automatically assigned to incidents</span>
          </div>
          <div className="flex items-center space-x-3">
            <Settings className="w-4 h-4 text-blue-600" />
            <span>You can customize notification settings in the dashboard</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Settings className="w-5 h-5 text-gray-600" />
          <span className="font-medium">Customize Settings</span>
        </button>
        
        <button className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <ExternalLink className="w-5 h-5 text-gray-600" />
          <span className="font-medium">View Documentation</span>
        </button>
      </div>

      {/* Integration Flow */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Integration Flow</h3>
        
        <div className="flex items-center justify-center space-x-4 text-sm">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-center">
              <div className="font-medium">ServiceNow</div>
              <div className="text-xs text-gray-500">Incident Created</div>
            </div>
          </div>
          
          <ArrowRight className="w-6 h-6 text-gray-400" />
          
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">N</span>
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Nexecute</div>
              <div className="text-xs text-gray-500">Processes & Routes</div>
            </div>
          </div>
          
          <ArrowRight className="w-6 h-6 text-gray-400" />
          
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-center">
              <div className="font-medium">Slack</div>
              <div className="text-xs text-gray-500">Team Notified</div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="pt-6 border-t border-gray-200">
        <button 
          onClick={() => onComplete({})} 
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Go to Dashboard
        </button>
        <p className="text-sm text-gray-500 mt-2">
          Start managing your integrations and customize your notification settings
        </p>
      </div>
    </div>
  );
}