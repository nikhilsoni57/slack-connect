import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../store/app';
import { cn } from '../utils/cn';

export function DashboardLayout() {
  const { sidebarOpen, sidebarCollapsed } = useAppStore();

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        {/* Header */}
        <Header />
        
        {/* Main content */}
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => useAppStore.getState().setSidebarOpen(false)}
        />
      )}
    </div>
  );
}