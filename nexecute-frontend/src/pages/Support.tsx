import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function SupportPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('Support');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Support</h1>
        <p className="text-secondary-600">Get help and access documentation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Documentation</h2>
            <div className="space-y-3">
              <a href="#" className="block p-3 border border-secondary-200 rounded-lg hover:bg-secondary-50">
                <div className="font-medium text-primary-600">Getting Started Guide</div>
                <div className="text-sm text-secondary-600">Learn how to set up your first integration</div>
              </a>
              <a href="#" className="block p-3 border border-secondary-200 rounded-lg hover:bg-secondary-50">
                <div className="font-medium text-primary-600">API Reference</div>
                <div className="text-sm text-secondary-600">Complete API documentation</div>
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Contact Support</h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-medium text-blue-900">Email Support</div>
                <div className="text-sm text-blue-700">support@nexecute.com</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="font-medium text-green-900">Live Chat</div>
                <div className="text-sm text-green-700">Available 24/7</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}