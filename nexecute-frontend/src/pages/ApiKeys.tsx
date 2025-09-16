import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function ApiKeysPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('API Keys');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">API Keys</h1>
          <p className="text-secondary-600">Manage API keys for integrations</p>
        </div>
        <button className="btn-primary">
          Generate API Key
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Active API Keys</h2>
          <div className="text-center py-8 text-secondary-500">
            No API keys generated yet.
          </div>
        </div>
      </div>
    </div>
  );
}