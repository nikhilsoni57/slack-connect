import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function SyncLogsPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('Sync Logs');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Sync Logs</h1>
        <p className="text-secondary-600">View synchronization activity logs</p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-secondary-500">
            No sync logs available.
          </div>
        </div>
      </div>
    </div>
  );
}