import { useEffect } from 'react';
import { useAppStore } from '../../store/app';

export function WebhooksPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('Webhooks');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Webhooks</h1>
          <p className="text-secondary-600">Manage webhook endpoints for real-time notifications</p>
        </div>
        <button className="btn-primary">
          Create Webhook
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Active Webhooks</h2>
          <div className="text-center py-8 text-secondary-500">
            No webhooks configured yet.
          </div>
        </div>
      </div>
    </div>
  );
}