'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  PlusIcon,
} from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useAuthStore } from '@/lib/store/auth';
import { settingsApi } from '@/lib/api';
import {
  HomeIcon,
  CubeIcon,
  TagIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  TruckIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  UsersIcon,
  RectangleStackIcon,
  MapPinIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  ArchiveBoxIcon,
  BanknotesIcon,
  WrenchScrewdriverIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

interface MenuSection {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
  roles?: string[];
}

const menuSections: MenuSection[] = [
  {
    name: 'المخزون',
    icon: ArchiveBoxIcon,
    items: [
      { name: 'إدارة المخزون', href: '/dashboard/inventory', icon: ClipboardDocumentListIcon },
      { name: 'المنتجات', href: '/dashboard/products', icon: CubeIcon },
      { name: 'الأصناف', href: '/dashboard/categories', icon: TagIcon },
      { name: 'العلامات التجارية', href: '/dashboard/brands', icon: RectangleStackIcon },
      { name: 'الوحدات', href: '/dashboard/units', icon: BuildingStorefrontIcon },
      { name: 'المستودعات', href: '/dashboard/warehouses', icon: BuildingStorefrontIcon },
      { name: 'حركات المخزون', href: '/dashboard/stock-movements', icon: ArrowPathIcon },
      { name: 'التعديلات', href: '/dashboard/adjustments', icon: ClipboardDocumentListIcon },
    ],
  },
  {
    name: 'المشتريات',
    icon: ArrowTrendingDownIcon,
    items: [
      { name: 'فواتير الشراء', href: '/dashboard/purchases', icon: ArrowTrendingDownIcon },
      { name: 'بونات الطلب', href: '/dashboard/purchase-orders', icon: DocumentDuplicateIcon },
      { name: 'الموردين', href: '/dashboard/suppliers', icon: TruckIcon },
      { name: 'مرتجعات الشراء', href: '/dashboard/purchase-returns', icon: ArrowUturnLeftIcon },
    ],
  },
  {
    name: 'المبيعات',
    icon: ArrowTrendingUpIcon,
    items: [
      { name: 'فواتير البيع', href: '/dashboard/sales', icon: ArrowTrendingUpIcon },
      { name: 'العملاء', href: '/dashboard/clients', icon: UserGroupIcon },
      { name: 'مرتجعات المبيعات', href: '/dashboard/sale-returns', icon: ArrowUturnLeftIcon },
    ],
  },
  {
    name: 'الطلبات والتوصيل',
    icon: ShoppingCartIcon,
    items: [
      { name: 'الطلبات', href: '/dashboard/orders', icon: ShoppingCartIcon },
      { name: 'الجولات', href: '/dashboard/trips', icon: MapPinIcon },
      { name: 'التوصيل', href: '/dashboard/deliveries', icon: TruckIcon },
      { name: 'السائقين', href: '/dashboard/drivers', icon: UsersIcon },
      { name: 'خريطة السائقين', href: '/dashboard/drivers-map', icon: MapPinIcon },
      { name: 'المركبات', href: '/dashboard/vehicles', icon: TruckIcon },
    ],
  },
  {
    name: 'المالية',
    icon: BanknotesIcon,
    items: [
      { name: 'المدفوعات', href: '/dashboard/payments', icon: CurrencyDollarIcon },
      { name: 'المصروفات', href: '/dashboard/dispenses', icon: BanknotesIcon },
      { name: 'التقارير', href: '/dashboard/reports', icon: ChartBarIcon },
    ],
  },
  {
    name: 'الإدارة',
    icon: WrenchScrewdriverIcon,
    roles: ['admin'],
    items: [
      { name: 'الموظفين', href: '/dashboard/employees', icon: UsersIcon },
      { name: 'المستخدمين', href: '/dashboard/users', icon: UsersIcon },
      { name: 'الإعدادات', href: '/dashboard/settings', icon: Cog6ToothIcon },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, checkAuth, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    }
    return false;
  });
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('المخزون');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });

  // Fetch company settings for logo
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data;
        if (settings.company_logo) {
          setCompanyLogo(settings.company_logo);
        }
        if (settings.company_name) {
          setCompanyName(settings.company_name);
        }
      } catch (error) {
        // Use defaults if settings fail to load
      }
    };
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated]);

  // Initialize and listen for dark mode changes
  useEffect(() => {
    // Apply dark mode class on mount
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Listen for storage changes (when settings page changes dark mode)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'darkMode') {
        const newValue = e.newValue === 'true';
        setDarkMode(newValue);
        if (newValue) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [darkMode]);

  // Save sidebar collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Auto-expand section containing active route
  useEffect(() => {
    menuSections.forEach((section) => {
      const hasActiveItem = section.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'));
      if (hasActiveItem) {
        setExpandedSections((prev) =>
          prev.includes(section.name) ? prev : [...prev, section.name]
        );
      }
    });
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((s) => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Alt shortcuts even in inputs
        if (!e.altKey) return;
      }

      // Alt + shortcuts
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 's': // Alt+S = New Sale
            e.preventDefault();
            router.push('/dashboard/sales/new');
            break;
          case 'p': // Alt+P = New Purchase
            e.preventDefault();
            router.push('/dashboard/purchases/new');
            break;
          case 'n': // Alt+N = Products page
            e.preventDefault();
            router.push('/dashboard/products');
            break;
          case 'c': // Alt+C = Clients
            e.preventDefault();
            router.push('/dashboard/clients');
            break;
          case 'f': // Alt+F = Suppliers (Fournisseurs)
            e.preventDefault();
            router.push('/dashboard/suppliers');
            break;
          case 'h': // Alt+H = Home/Dashboard
            e.preventDefault();
            router.push('/dashboard');
            break;
          case 'i': // Alt+I = Inventory
            e.preventDefault();
            router.push('/dashboard/inventory');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [router]);

  const filteredSections = menuSections.filter((section) => {
    if (!section.roles) return true;
    return user && section.roles.includes(user.role);
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full bg-white dark:bg-gray-800 shadow-lg transform transition-all duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 w-64' : 'translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center p-4 border-b dark:border-gray-700 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                {companyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${companyLogo}`}
                    alt={companyName}
                    className="w-10 h-10 rounded-xl object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                    <CubeIcon className="w-6 h-6 text-white" />
                  </div>
                )}
                <span className="font-bold text-lg dark:text-white">{companyName}</span>
              </div>
            )}
            {sidebarCollapsed && (
              companyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${companyLogo}`}
                  alt={companyName}
                  className="w-10 h-10 rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                  <CubeIcon className="w-6 h-6 text-white" />
                </div>
              )
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <XMarkIcon className="w-5 h-5 dark:text-white" />
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
            {/* Dashboard Link */}
            <Link
              href="/dashboard"
              onClick={() => setSidebarOpen(false)}
              title="لوحة التحكم"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mb-2 ${
                pathname === '/dashboard'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <HomeIcon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">لوحة التحكم</span>}
            </Link>

            {/* Accordion Sections */}
            <div className="space-y-1">
              {filteredSections.map((section) => {
                const isExpanded = expandedSections.includes(section.name);
                const hasActiveItem = section.items.some(
                  (item) => pathname === item.href || pathname.startsWith(item.href + '/')
                );

                return (
                  <div key={section.name}>
                    <button
                      onClick={() => !sidebarCollapsed && toggleSection(section.name)}
                      title={section.name}
                      className={`flex items-center w-full px-3 py-2.5 rounded-lg transition-colors ${
                        hasActiveItem
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      } ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                    >
                      <div className={`flex items-center gap-3 ${sidebarCollapsed ? '' : ''}`}>
                        <section.icon className="w-5 h-5 flex-shrink-0" />
                        {!sidebarCollapsed && <span className="text-sm font-medium">{section.name}</span>}
                      </div>
                      {!sidebarCollapsed && (
                        <ChevronDownIcon
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </button>

                    {/* Submenu */}
                    {!sidebarCollapsed && (
                      <div
                        className={`overflow-hidden transition-all duration-200 ${
                          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <ul className="mt-1 mr-4 space-y-1 border-r-2 border-gray-100 dark:border-gray-700">
                          {section.items.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                                    isActive
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium'
                                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                                  }`}
                                >
                                  <item.icon className="w-4 h-4" />
                                  <span>{item.name}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* User section */}
          <div className={`border-t dark:border-gray-700 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && 'تسجيل الخروج'}
            </button>
            {/* Collapse toggle button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
              className={`hidden lg:flex items-center gap-2 w-full px-3 py-2 mt-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Bars3Icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && 'تصغير القائمة'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:mr-16' : 'lg:mr-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Bars3Icon className="w-6 h-6 dark:text-white" />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                مرحبا، {user?.name}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 pb-20">{children}</main>

        {/* Global Shortcuts Footer Bar */}
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 text-white shadow-lg">
          <div className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:mr-16' : 'lg:mr-64'}`}>
            <div className="flex items-center justify-between px-4 py-2">
              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/sales/new"
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">بيع جديد</span>
                  <kbd className="hidden md:inline bg-green-700 px-1.5 py-0.5 rounded text-xs">Alt+S</kbd>
                </Link>
                <Link
                  href="/dashboard/purchases/new"
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">شراء جديد</span>
                  <kbd className="hidden md:inline bg-blue-700 px-1.5 py-0.5 rounded text-xs">Alt+P</kbd>
                </Link>
                <Link
                  href="/dashboard/products"
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <CubeIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">المنتجات</span>
                  <kbd className="hidden md:inline bg-purple-700 px-1.5 py-0.5 rounded text-xs">Alt+N</kbd>
                </Link>
              </div>

              {/* Shortcuts Info */}
              <div className="hidden lg:flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Alt+H</kbd>
                  <span>الرئيسية</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Alt+C</kbd>
                  <span>العملاء</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Alt+F</kbd>
                  <span>الموردين</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Alt+I</kbd>
                  <span>المخزون</span>
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
