import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function AnalyticsPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('Analytics');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Analytics</h1>
        <p className="text-secondary-600">View integration performance metrics</p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Performance Metrics</h2>
          <div className="text-center py-8 text-secondary-500">
            Analytics dashboard coming soon.
          </div>
        </div>
      </div>
    </div>
  );
}