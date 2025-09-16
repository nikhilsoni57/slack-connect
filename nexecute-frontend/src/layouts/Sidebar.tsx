import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Zap, 
  Users, 
  Settings, 
  BarChart3, 
  MessageSquare,
  Wrench,
  FileText,
  Shield,
  HelpCircle
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { useAccessControl } from '../components/ProtectedRoute';
import { cn } from '../utils/cn';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  current?: boolean;
  badge?: number;
  requiredRole?: 'admin' | 'user';
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Integrations', href: '/integrations', icon: Zap },
  { name: 'Incidents', href: '/incidents', icon: MessageSquare, badge: 3 },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'User Mappings', href: '/user-mappings', icon: Users },
  { name: 'Sync Logs', href: '/sync-logs', icon: FileText },
  { name: 'System Settings', href: '/settings', icon: Settings, requiredRole: 'admin' },
  { name: 'API Keys', href: '/api-keys', icon: Shield, requiredRole: 'admin' },
  { name: 'Support', href: '/support', icon: HelpCircle },
];

const tools: NavigationItem[] = [
  { name: 'Webhooks', href: '/tools/webhooks', icon: Wrench },
  { name: 'Field Mappings', href: '/tools/field-mappings', icon: Settings },
];

export function Sidebar() {
  const { sidebarOpen, sidebarCollapsed, setSidebarOpen } = useAppStore();
  const { canAccess } = useAccessControl();

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-secondary-200 px-4 py-6 custom-scrollbar">
          {/* Logo */}
          <div className="flex h-10 shrink-0 items-center">
            {sidebarCollapsed ? (
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">N</span>
                </div>
                <span className="text-lg font-semibold text-secondary-900">
                  Nexecute Connect
                </span>
              </div>
            )}
          </div>

          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {/* Main navigation */}
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation
                    .filter(item => canAccess(item.requiredRole))
                    .map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        onClick={closeSidebar}
                        className={({ isActive }) =>
                          cn(
                            isActive ? 'sidebar-link-active' : 'sidebar-link-inactive',
                            'group'
                          )
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!sidebarCollapsed && (
                          <>
                            <span className="truncate">{item.name}</span>
                            {item.badge && (
                              <span className="ml-auto bg-primary-100 text-primary-600 text-xs font-medium px-2 py-1 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {sidebarCollapsed && item.badge && (
                          <span className="absolute left-8 -top-1 bg-primary-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>

              {/* Tools section */}
              {!sidebarCollapsed && (
                <li>
                  <div className="text-xs font-semibold leading-6 text-secondary-400 uppercase tracking-wider">
                    Tools
                  </div>
                  <ul role="list" className="-mx-2 mt-2 space-y-1">
                    {tools.map((item) => (
                      <li key={item.name}>
                        <NavLink
                          to={item.href}
                          onClick={closeSidebar}
                          className={({ isActive }) =>
                            cn(
                              isActive ? 'sidebar-link-active' : 'sidebar-link-inactive',
                              'group'
                            )
                          }
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              )}

              {/* Status indicator */}
              <li className="-mx-2 mt-auto">
                <div className={cn(
                  'flex items-center gap-x-3 px-3 py-2 text-sm',
                  sidebarCollapsed && 'justify-center'
                )}>
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                  {!sidebarCollapsed && (
                    <span className="text-secondary-600 text-xs">
                      All systems operational
                    </span>
                  )}
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-secondary-200 transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto px-4 py-6 custom-scrollbar">
          {/* Mobile logo */}
          <div className="flex h-10 shrink-0 items-center">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-lg font-semibold text-secondary-900">
                Nexecute Connect
              </span>
            </div>
          </div>

          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {/* Main navigation */}
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation
                    .filter(item => canAccess(item.requiredRole))
                    .map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        onClick={closeSidebar}
                        className={({ isActive }) =>
                          cn(
                            isActive ? 'sidebar-link-active' : 'sidebar-link-inactive',
                            'group'
                          )
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.name}</span>
                        {item.badge && (
                          <span className="ml-auto bg-primary-100 text-primary-600 text-xs font-medium px-2 py-1 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>

              {/* Tools section */}
              <li>
                <div className="text-xs font-semibold leading-6 text-secondary-400 uppercase tracking-wider">
                  Tools
                </div>
                <ul role="list" className="-mx-2 mt-2 space-y-1">
                  {tools.map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        onClick={closeSidebar}
                        className={({ isActive }) =>
                          cn(
                            isActive ? 'sidebar-link-active' : 'sidebar-link-inactive',
                            'group'
                          )
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>

              {/* Status indicator */}
              <li className="-mx-2 mt-auto">
                <div className="flex items-center gap-x-3 px-3 py-2 text-sm">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-secondary-600 text-xs">
                    All systems operational
                  </span>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}