'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {
  CubeIcon,
  UserGroupIcon,
  TruckIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { DashboardStats } from '@/lib/types';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

function StatCard({ title, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 ${bgColor} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await dashboardApi.getStats();
      return response.data;
    },
  });

  const stats = dashboardData?.stats;
  const today = dashboardData?.today;
  const monthly = dashboardData?.monthly;
  const pending = dashboardData?.pending;

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => {
      const response = await dashboardApi.getLowStock();
      return response.data;
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => {
      const response = await dashboardApi.getTopProducts({ limit: 5 });
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">لوحة التحكم</h1>
        <p className="text-gray-500 mt-1">نظرة عامة على النظام</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المنتجات"
          value={stats?.total_products || 0}
          icon={CubeIcon}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="إجمالي العملاء"
          value={stats?.total_clients || 0}
          icon={UserGroupIcon}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="إجمالي الموردين"
          value={stats?.total_suppliers || 0}
          icon={TruckIcon}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <StatCard
          title="الطلبات المعلقة"
          value={pending?.orders || 0}
          icon={ShoppingCartIcon}
          color="text-orange-600"
          bgColor="bg-orange-50"
        />
      </div>

      {/* Sales & Purchases Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="مبيعات اليوم"
          value={formatCurrency(today?.sales || 0)}
          icon={ArrowTrendingUpIcon}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="مبيعات الشهر"
          value={formatCurrency(parseFloat(monthly?.sales) || 0)}
          icon={ArrowTrendingUpIcon}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="مشتريات اليوم"
          value={formatCurrency(today?.purchases || 0)}
          icon={ArrowTrendingDownIcon}
          color="text-red-600"
          bgColor="bg-red-50"
        />
        <StatCard
          title="مشتريات الشهر"
          value={formatCurrency(parseFloat(monthly?.purchases) || 0)}
          icon={ArrowTrendingDownIcon}
          color="text-red-600"
          bgColor="bg-red-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">تنبيه المخزون المنخفض</h2>
          </div>
          {lowStock && lowStock.length > 0 ? (
            <div className="space-y-3">
              {lowStock.slice(0, 5).map((item: { id: number; name: string; total_stock: number; stock_alert: number }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg"
                >
                  <span className="font-medium">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">المخزون:</span>
                    <span className="badge badge-warning">{item.total_stock}</span>
                    <span className="text-sm text-gray-400">/ {item.stock_alert}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">لا توجد منتجات بمخزون منخفض</p>
          )}
        </div>

        {/* Top Products */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">أكثر المنتجات مبيعا</h2>
          {topProducts && topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((item: { id: number; name: string; total_sold: number }, index: number) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="badge badge-info">{item.total_sold} قطعة</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">لا توجد بيانات</p>
          )}
        </div>
      </div>
    </div>
  );
}
