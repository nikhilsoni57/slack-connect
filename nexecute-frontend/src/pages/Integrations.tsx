import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function IntegrationsPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('Integrations');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Integrations</h1>
          <p className="text-secondary-600">Manage your ServiceNow integrations</p>
        </div>
        <button className="btn-primary">
          Add Integration
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Active Integrations</h2>
          <div className="text-center py-8 text-secondary-500">
            No integrations configured yet.
          </div>
        </div>
      </div>
    </div>
  );
}