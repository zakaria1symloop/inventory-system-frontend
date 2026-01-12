'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { reportsApi } from '@/lib/api';

// Tab definitions
const tabs = [
  { id: 'sales', name: 'المبيعات', icon: '📈' },
  { id: 'delivery', name: 'التوصيل', icon: '🚚' },
  { id: 'stock', name: 'المخزون', icon: '📦' },
  { id: 'financial', name: 'المالية', icon: '💰' },
  { id: 'debt', name: 'الديون', icon: '💳' },
];

// Sub-tabs for each main tab
const subTabs: Record<string, { id: string; name: string }[]> = {
  sales: [
    { id: 'summary', name: 'ملخص' },
    { id: 'by-product', name: 'حسب المنتج' },
    { id: 'by-client', name: 'حسب العميل' },
    { id: 'by-seller', name: 'حسب البائع' },
  ],
  delivery: [
    { id: 'summary', name: 'ملخص' },
    { id: 'by-livreur', name: 'حسب السائق' },
    { id: 'details', name: 'التفاصيل' },
  ],
  stock: [
    { id: 'summary', name: 'المخزون الحالي' },
    { id: 'movements', name: 'الحركات' },
    { id: 'low-stock', name: 'نقص المخزون' },
  ],
  financial: [
    { id: 'summary', name: 'ملخص مالي' },
    { id: 'client-balances', name: 'أرصدة العملاء' },
    { id: 'collections', name: 'التحصيلات' },
  ],
  debt: [
    { id: 'summary', name: 'ملخص الديون' },
    { id: 'details', name: 'تفاصيل الديون' },
    { id: 'aging', name: 'تقادم الديون' },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = any;

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of month
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData>(null);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from_date: dateFrom, to_date: dateTo };
      let response;

      // Determine which API to call based on tabs
      if (activeTab === 'sales') {
        if (activeSubTab === 'summary') response = await reportsApi.salesSummary(params);
        else if (activeSubTab === 'by-product') response = await reportsApi.salesByProduct(params);
        else if (activeSubTab === 'by-client') response = await reportsApi.salesByClient(params);
        else if (activeSubTab === 'by-seller') response = await reportsApi.salesBySeller(params);
      } else if (activeTab === 'delivery') {
        if (activeSubTab === 'summary') response = await reportsApi.deliverySummary(params);
        else if (activeSubTab === 'by-livreur') response = await reportsApi.deliveryByLivreur(params);
        else if (activeSubTab === 'details') response = await reportsApi.deliveryDetails(params);
      } else if (activeTab === 'stock') {
        if (activeSubTab === 'summary') response = await reportsApi.stockSummary(params);
        else if (activeSubTab === 'movements') response = await reportsApi.stockMovements(params);
        else if (activeSubTab === 'low-stock') response = await reportsApi.lowStockAlert(params);
      } else if (activeTab === 'financial') {
        if (activeSubTab === 'summary') response = await reportsApi.financialSummary(params);
        else if (activeSubTab === 'client-balances') response = await reportsApi.clientBalances(params);
        else if (activeSubTab === 'collections') response = await reportsApi.collectionsReport(params);
      } else if (activeTab === 'debt') {
        if (activeSubTab === 'summary') response = await reportsApi.debtSummary(params);
        else if (activeSubTab === 'details') response = await reportsApi.debtDetails(params);
        else if (activeSubTab === 'aging') response = await reportsApi.debtAging(params);
      }

      if (response) {
        setReportData(response.data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('خطأ في تحميل التقرير');
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeSubTab, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Reset sub-tab when main tab changes
  useEffect(() => {
    setActiveSubTab(subTabs[activeTab]?.[0]?.id || 'summary');
  }, [activeTab]);

  // Export to Excel
  const exportToExcel = () => {
    if (!reportData) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const data = reportData.data || [];
    if (data.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    // Create CSV content
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) =>
        headers.map(h => {
          const val = row[h];
          // Handle commas and quotes in values
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val ?? '';
        }).join(',')
      )
    ].join('\n');

    // Add BOM for Arabic support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${activeTab}_${activeSubTab}_${dateFrom}_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير التقرير بنجاح');
  };

  // Export to PDF
  const exportToPdf = () => {
    if (!reportData) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    // Create print-friendly HTML
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة');
      return;
    }

    const tabName = tabs.find(t => t.id === activeTab)?.name || '';
    const subTabName = subTabs[activeTab]?.find(s => s.id === activeSubTab)?.name || '';

    let tableHtml = '';
    const data = reportData.data || [];

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const headerLabels = getColumnLabels(activeTab, activeSubTab);

      tableHtml = `
        <table style="width:100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              ${headers.map(h => `<th style="border: 1px solid #ddd; padding: 12px; text-align: right;">${headerLabels[h] || h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map((row: Record<string, unknown>) => `
              <tr>
                ${headers.map(h => `<td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${formatValue(row[h], h)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    // Add summary section if available
    let summaryHtml = '';
    if (reportData.summary || reportData.totals) {
      const summaryData = reportData.summary || reportData.totals;
      summaryHtml = `
        <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px;">
          <h3 style="margin-bottom: 10px;">ملخص</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
            ${Object.entries(summaryData).map(([key, value]) => `
              <div>
                <div style="color: #6b7280; font-size: 12px;">${getSummaryLabel(key)}</div>
                <div style="font-weight: bold; font-size: 18px;">${formatValue(value, key)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير ${tabName} - ${subTabName}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; direction: rtl; }
          h1 { color: #1f2937; margin-bottom: 5px; }
          .period { color: #6b7280; margin-bottom: 20px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>تقرير ${tabName} - ${subTabName}</h1>
        <div class="period">الفترة: ${dateFrom} إلى ${dateTo}</div>
        ${summaryHtml}
        ${tableHtml}
        <div style="margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px;">
          تم إنشاء التقرير بتاريخ ${new Date().toLocaleString('ar-SA')}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success('جاري طباعة التقرير');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">التقارير</h1>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Excel
          </button>
          <button onClick={exportToPdf} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="card mb-4">
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span className="ml-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs and Filters */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Sub-tabs */}
          <div className="flex gap-2">
            {subTabs[activeTab]?.map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => setActiveSubTab(subTab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSubTab === subTab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {subTab.name}
              </button>
            ))}
          </div>

          {/* Date Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">من:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input py-1.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">إلى:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input py-1.5"
              />
            </div>
            <button
              onClick={fetchReport}
              className="btn btn-primary py-1.5"
              disabled={loading}
            >
              {loading ? 'جاري التحميل...' : 'تحديث'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : reportData ? (
          <ReportContent
            tab={activeTab}
            subTab={activeSubTab}
            data={reportData}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            لا توجد بيانات
          </div>
        )}
      </div>
    </div>
  );
}

// Report content component
function ReportContent({ tab, subTab, data }: { tab: string; subTab: string; data: ReportData }) {
  // Sales Summary
  if (tab === 'sales' && subTab === 'summary') {
    return <SalesSummaryReport data={data} />;
  }

  // Sales by Product
  if (tab === 'sales' && subTab === 'by-product') {
    return <SalesByProductReport data={data} />;
  }

  // Sales by Client
  if (tab === 'sales' && subTab === 'by-client') {
    return <SalesByClientReport data={data} />;
  }

  // Sales by Seller
  if (tab === 'sales' && subTab === 'by-seller') {
    return <SalesBySellerReport data={data} />;
  }

  // Delivery Summary
  if (tab === 'delivery' && subTab === 'summary') {
    return <DeliverySummaryReport data={data} />;
  }

  // Delivery by Livreur
  if (tab === 'delivery' && subTab === 'by-livreur') {
    return <DeliveryByLivreurReport data={data} />;
  }

  // Delivery Details
  if (tab === 'delivery' && subTab === 'details') {
    return <DeliveryDetailsReport data={data} />;
  }

  // Stock Summary
  if (tab === 'stock' && subTab === 'summary') {
    return <StockSummaryReport data={data} />;
  }

  // Stock Movements
  if (tab === 'stock' && subTab === 'movements') {
    return <StockMovementsReport data={data} />;
  }

  // Low Stock
  if (tab === 'stock' && subTab === 'low-stock') {
    return <LowStockReport data={data} />;
  }

  // Financial Summary
  if (tab === 'financial' && subTab === 'summary') {
    return <FinancialSummaryReport data={data} />;
  }

  // Client Balances
  if (tab === 'financial' && subTab === 'client-balances') {
    return <ClientBalancesReport data={data} />;
  }

  // Collections
  if (tab === 'financial' && subTab === 'collections') {
    return <CollectionsReport data={data} />;
  }

  // Debt Summary
  if (tab === 'debt' && subTab === 'summary') {
    return <DebtSummaryReport data={data} />;
  }

  // Debt Details
  if (tab === 'debt' && subTab === 'details') {
    return <DebtDetailsReport data={data} />;
  }

  // Debt Aging
  if (tab === 'debt' && subTab === 'aging') {
    return <DebtAgingReport data={data} />;
  }

  return <div className="text-center py-8 text-gray-500">تقرير غير متوفر</div>;
}

// ============ Sales Reports ============

function SalesSummaryReport({ data }: { data: ReportData }) {
  const { summary, sales_by_day, top_products, top_clients } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="إجمالي الطلبات" value={summary?.total_orders || 0} />
        <StatCard title="الطلبات المسلمة" value={summary?.delivered_orders || 0} color="green" />
        <StatCard title="الطلبات الملغاة" value={summary?.cancelled_orders || 0} color="red" />
        <StatCard title="الإيرادات" value={formatCurrency(summary?.total_revenue)} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div>
          <h3 className="font-semibold mb-3">أفضل المنتجات</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-right p-2">المنتج</th>
                <th className="text-right p-2">الكمية</th>
                <th className="text-right p-2">الإيرادات</th>
              </tr>
            </thead>
            <tbody>
              {top_products?.map((p: ReportData, i: number) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{p.total_quantity}</td>
                  <td className="p-2">{formatCurrency(p.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Clients */}
        <div>
          <h3 className="font-semibold mb-3">أفضل العملاء</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-right p-2">العميل</th>
                <th className="text-right p-2">الطلبات</th>
                <th className="text-right p-2">الإيرادات</th>
              </tr>
            </thead>
            <tbody>
              {top_clients?.map((c: ReportData, i: number) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2">{c.total_orders}</td>
                  <td className="p-2">{formatCurrency(c.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales by Day Chart (simple table for now) */}
      <div>
        <h3 className="font-semibold mb-3">المبيعات حسب اليوم</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-right p-2">التاريخ</th>
                <th className="text-right p-2">الطلبات</th>
                <th className="text-right p-2">الإيرادات</th>
              </tr>
            </thead>
            <tbody>
              {sales_by_day?.map((d: ReportData, i: number) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{d.date}</td>
                  <td className="p-2">{d.orders}</td>
                  <td className="p-2">{formatCurrency(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SalesByProductReport({ data }: { data: ReportData }) {
  const { data: products, totals } = data;

  return (
    <div>
      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="إجمالي الكمية" value={totals?.total_quantity || 0} />
        <StatCard title="إجمالي الإيرادات" value={formatCurrency(totals?.total_revenue)} color="blue" />
        <StatCard title="إجمالي التكلفة" value={formatCurrency(totals?.total_cost)} color="orange" />
        <StatCard title="إجمالي الربح" value={formatCurrency(totals?.total_profit)} color="green" />
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-3">المنتج</th>
              <th className="text-right p-3">الفئة</th>
              <th className="text-right p-3">الكمية</th>
              <th className="text-right p-3">الإيرادات</th>
              <th className="text-right p-3">التكلفة</th>
              <th className="text-right p-3">الربح</th>
            </tr>
          </thead>
          <tbody>
            {products?.map((p: ReportData, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.barcode}</div>
                </td>
                <td className="p-3">{p.category_name || '-'}</td>
                <td className="p-3">{p.total_quantity}</td>
                <td className="p-3">{formatCurrency(p.total_revenue)}</td>
                <td className="p-3">{formatCurrency(p.total_cost)}</td>
                <td className="p-3">
                  <span className={p.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(p.profit)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesByClientReport({ data }: { data: ReportData }) {
  const { data: clients, totals } = data;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="عدد العملاء" value={totals?.total_clients || 0} />
        <StatCard title="إجمالي الطلبات" value={totals?.total_orders || 0} color="blue" />
        <StatCard title="إجمالي الإيرادات" value={formatCurrency(totals?.total_revenue)} color="green" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-3">العميل</th>
              <th className="text-right p-3">الهاتف</th>
              <th className="text-right p-3">العنوان</th>
              <th className="text-right p-3">الطلبات</th>
              <th className="text-right p-3">الإيرادات</th>
              <th className="text-right p-3">متوسط الطلب</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c: ReportData, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone || '-'}</td>
                <td className="p-3 max-w-xs truncate">{c.address || '-'}</td>
                <td className="p-3">{c.total_orders}</td>
                <td className="p-3">{formatCurrency(c.total_revenue)}</td>
                <td className="p-3">{formatCurrency(c.avg_order_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesBySellerReport({ data }: { data: ReportData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-right p-3">البائع</th>
            <th className="text-right p-3">إجمالي الطلبات</th>
            <th className="text-right p-3">المسلمة</th>
            <th className="text-right p-3">الملغاة</th>
            <th className="text-right p-3">الإيرادات</th>
            <th className="text-right p-3">متوسط الطلب</th>
          </tr>
        </thead>
        <tbody>
          {data.data?.map((s: ReportData, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium">{s.name}</td>
              <td className="p-3">{s.total_orders}</td>
              <td className="p-3 text-green-600">{s.delivered_orders}</td>
              <td className="p-3 text-red-600">{s.cancelled_orders}</td>
              <td className="p-3">{formatCurrency(s.total_revenue)}</td>
              <td className="p-3">{formatCurrency(s.avg_order_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ Delivery Reports ============

function DeliverySummaryReport({ data }: { data: ReportData }) {
  const { summary, by_day } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="إجمالي الرحلات" value={summary?.total_deliveries || 0} />
        <StatCard title="المكتملة" value={summary?.completed_deliveries || 0} color="green" />
        <StatCard title="إجمالي الطلبات" value={summary?.total_orders || 0} />
        <StatCard title="المسلمة" value={summary?.delivered_orders || 0} color="green" />
        <StatCard title="نسبة النجاح" value={`${summary?.success_rate || 0}%`} color="blue" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="المبلغ المستحق" value={formatCurrency(summary?.total_amount)} color="orange" />
        <StatCard title="المبلغ المحصل" value={formatCurrency(summary?.collected_amount)} color="green" />
      </div>

      <div>
        <h3 className="font-semibold mb-3">التوصيل حسب اليوم</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الرحلات</th>
              <th className="text-right p-2">المسلمة</th>
              <th className="text-right p-2">الفاشلة</th>
              <th className="text-right p-2">المحصل</th>
            </tr>
          </thead>
          <tbody>
            {by_day?.map((d: ReportData, i: number) => (
              <tr key={i} className="border-b">
                <td className="p-2">{d.date}</td>
                <td className="p-2">{d.deliveries}</td>
                <td className="p-2 text-green-600">{d.delivered}</td>
                <td className="p-2 text-red-600">{d.failed}</td>
                <td className="p-2">{formatCurrency(d.collected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeliveryByLivreurReport({ data }: { data: ReportData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-right p-3">السائق</th>
            <th className="text-right p-3">الرحلات</th>
            <th className="text-right p-3">الطلبات</th>
            <th className="text-right p-3">المسلمة</th>
            <th className="text-right p-3">الفاشلة</th>
            <th className="text-right p-3">نسبة النجاح</th>
            <th className="text-right p-3">المحصل</th>
          </tr>
        </thead>
        <tbody>
          {data.data?.map((l: ReportData, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium">{l.name}</td>
              <td className="p-3">{l.total_deliveries}</td>
              <td className="p-3">{l.total_orders}</td>
              <td className="p-3 text-green-600">{l.delivered_orders}</td>
              <td className="p-3 text-red-600">{l.failed_orders}</td>
              <td className="p-3">
                <span className={`px-2 py-1 rounded text-xs ${
                  (l.success_rate || 0) >= 80 ? 'bg-green-100 text-green-800' :
                  (l.success_rate || 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {l.success_rate || 0}%
                </span>
              </td>
              <td className="p-3">{formatCurrency(l.collected_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryDetailsReport({ data }: { data: ReportData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-right p-3">المرجع</th>
            <th className="text-right p-3">التاريخ</th>
            <th className="text-right p-3">السائق</th>
            <th className="text-right p-3">الحالة</th>
            <th className="text-right p-3">الطلبات</th>
            <th className="text-right p-3">المسلمة</th>
            <th className="text-right p-3">نسبة النجاح</th>
            <th className="text-right p-3">المحصل</th>
          </tr>
        </thead>
        <tbody>
          {data.data?.map((d: ReportData, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs">{d.reference}</td>
              <td className="p-3">{d.date}</td>
              <td className="p-3">{d.livreur_name}</td>
              <td className="p-3">
                <StatusBadge status={d.status} />
              </td>
              <td className="p-3">{d.total_orders}</td>
              <td className="p-3">{d.delivered_count}</td>
              <td className="p-3">{d.success_rate}%</td>
              <td className="p-3">{formatCurrency(d.collected_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ Stock Reports ============

function StockSummaryReport({ data }: { data: ReportData }) {
  const { data: stocks, totals } = data;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="عدد المنتجات" value={totals?.total_products || 0} />
        <StatCard title="إجمالي الكمية" value={totals?.total_quantity || 0} color="blue" />
        <StatCard title="قيمة المخزون" value={formatCurrency(totals?.total_value)} color="green" />
        <StatCard title="نقص المخزون" value={totals?.low_stock_count || 0} color="red" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-3">المنتج</th>
              <th className="text-right p-3">الفئة</th>
              <th className="text-right p-3">المستودع</th>
              <th className="text-right p-3">الكمية</th>
              <th className="text-right p-3">الحد الأدنى</th>
              <th className="text-right p-3">القيمة</th>
              <th className="text-right p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {stocks?.map((s: ReportData, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.barcode}</div>
                </td>
                <td className="p-3">{s.category_name || '-'}</td>
                <td className="p-3">{s.warehouse_name}</td>
                <td className="p-3">{s.quantity}</td>
                <td className="p-3">{s.min_stock}</td>
                <td className="p-3">{formatCurrency(s.stock_value)}</td>
                <td className="p-3">
                  {s.is_low_stock ? (
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">نقص</span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">جيد</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Movement type labels in Arabic
const movementTypeLabels: Record<string, string> = {
  purchase: 'شراء',
  sale: 'بيع',
  adjustment_add: 'تعديل إضافة',
  adjustment_sub: 'تعديل نقص',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  delivery_out: 'خروج للتوصيل',
  delivery_return: 'مرتجع من التوصيل',
  initial: 'رصيد افتتاحي',
};

function StockMovementsReport({ data }: { data: ReportData }) {
  const getMovementColor = (type: string): string => {
    if (type === 'purchase' || type === 'adjustment_add' || type === 'transfer_in' || type === 'delivery_return') {
      return 'green';
    }
    if (type === 'sale' || type === 'adjustment_sub' || type === 'transfer_out' || type === 'delivery_out') {
      return 'red';
    }
    return 'gray';
  };

  return (
    <div>
      {/* Loss Summary */}
      {data.losses && data.losses.count > 0 && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <h3 className="font-semibold mb-3 text-red-800">ملخص الخسائر</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-red-600">عدد الخسائر</div>
              <div className="text-xl font-bold text-red-700">{data.losses.count}</div>
            </div>
            <div>
              <div className="text-sm text-red-600">إجمالي الكمية</div>
              <div className="text-xl font-bold text-red-700">{data.losses.total_quantity}</div>
            </div>
            <div>
              <div className="text-sm text-red-600">قيمة الخسائر</div>
              <div className="text-xl font-bold text-red-700">{formatCurrency(data.losses.total_value)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Summary by type */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {data.summary?.map((s: ReportData, i: number) => (
          <StatCard
            key={i}
            title={movementTypeLabels[s.type] || s.type}
            value={`${s.total_quantity} (${s.count})`}
            color={getMovementColor(s.type)}
          />
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-3">التاريخ</th>
              <th className="text-right p-3">المنتج</th>
              <th className="text-right p-3">المستودع</th>
              <th className="text-right p-3">النوع</th>
              <th className="text-right p-3">الكمية</th>
              <th className="text-right p-3">قبل</th>
              <th className="text-right p-3">بعد</th>
              <th className="text-right p-3">المرجع</th>
            </tr>
          </thead>
          <tbody>
            {data.data?.map((m: ReportData, i: number) => {
              const isIncoming = ['purchase', 'adjustment_add', 'transfer_in', 'delivery_return', 'initial'].includes(m.type) || m.quantity > 0;
              const isLoss = m.is_loss || (m.reference && m.reference.startsWith('LOSS-'));
              const badgeColor = isLoss ? 'bg-red-200 text-red-900 font-bold' : isIncoming ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
              return (
                <tr key={i} className={`border-b hover:bg-gray-50 ${isLoss ? 'bg-red-50' : ''}`}>
                  <td className="p-3 text-xs">{m.date}</td>
                  <td className="p-3">{m.product_name}</td>
                  <td className="p-3">{m.warehouse_name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${badgeColor}`}>
                      {m.type_label || movementTypeLabels[m.type] || m.type}
                    </span>
                  </td>
                  <td className={`p-3 font-medium ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncoming ? '+' : ''}{m.quantity}
                  </td>
                  <td className="p-3 text-gray-500">{m.before_quantity}</td>
                  <td className="p-3">{m.after_quantity}</td>
                  <td className="p-3 text-xs font-mono">{m.reference}</td>
                  {isLoss && m.loss_value && (
                    <td className="p-3 text-red-600 font-bold">{formatCurrency(m.loss_value)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LowStockReport({ data }: { data: ReportData }) {
  return (
    <div>
      <div className="mb-4 p-4 bg-red-50 rounded-lg">
        <span className="text-red-800 font-medium">
          {data.total_alerts} منتج يحتاج إلى إعادة تعبئة
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-3">المنتج</th>
              <th className="text-right p-3">الفئة</th>
              <th className="text-right p-3">المستودع</th>
              <th className="text-right p-3">المخزون الحالي</th>
              <th className="text-right p-3">الحد الأدنى</th>
              <th className="text-right p-3">النقص</th>
            </tr>
          </thead>
          <tbody>
            {data.data?.map((s: ReportData, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.barcode}</div>
                </td>
                <td className="p-3">{s.category_name || '-'}</td>
                <td className="p-3">{s.warehouse_name}</td>
                <td className="p-3 text-red-600 font-medium">{s.current_stock}</td>
                <td className="p-3">{s.min_stock}</td>
                <td className="p-3">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-medium">
                    -{s.shortage}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ Financial Reports ============

const expenseCategories: Record<string, string> = {
  salary: 'راتب',
  advance: 'سلفة',
  transport: 'نقل',
  maintenance: 'صيانة',
  supplies: 'مستلزمات',
  utilities: 'فواتير',
  rent: 'إيجار',
  other: 'أخرى',
};

function FinancialSummaryReport({ data }: { data: ReportData }) {
  const { summary, stock_losses_detail, expenses_by_category, outstanding } = data;

  return (
    <div className="space-y-6">
      {/* Revenue & Costs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="إيرادات المبيعات" value={formatCurrency(summary?.sales_revenue)} color="green" />
        <StatCard title="تكلفة المشتريات" value={formatCurrency(summary?.purchase_costs)} color="orange" />
        <StatCard title="إجمالي المصروفات" value={formatCurrency(summary?.total_expenses)} color="red" />
        <StatCard title="خسائر المخزون" value={formatCurrency(summary?.stock_losses)} color="red" />
        <StatCard title="الربح الإجمالي" value={formatCurrency(summary?.gross_profit)} color="blue" />
      </div>

      {/* Stock Losses Detail */}
      {stock_losses_detail && stock_losses_detail.count > 0 && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <h3 className="font-semibold mb-2 text-red-800">تفاصيل خسائر المخزون</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-red-600">عدد الخسائر</div>
              <div className="text-xl font-bold text-red-700">{stock_losses_detail.count}</div>
            </div>
            <div>
              <div className="text-sm text-red-600">إجمالي الكمية</div>
              <div className="text-xl font-bold text-red-700">{stock_losses_detail.total_quantity}</div>
            </div>
            <div>
              <div className="text-sm text-red-600">القيمة الإجمالية</div>
              <div className="text-xl font-bold text-red-700">{formatCurrency(stock_losses_detail.total_value)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Net Profit */}
      <div className={`p-4 rounded-lg ${(summary?.net_profit || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
        <h3 className="font-semibold mb-2">صافي الربح (بعد المصروفات والخسائر)</h3>
        <div className={`text-2xl font-bold ${(summary?.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(summary?.net_profit)}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          المبيعات ({formatCurrency(summary?.sales_revenue)}) - المشتريات ({formatCurrency(summary?.purchase_costs)}) - المصروفات ({formatCurrency(summary?.total_expenses)}) - الخسائر ({formatCurrency(summary?.stock_losses)})
        </p>
      </div>

      {/* Expenses by Category */}
      {expenses_by_category && expenses_by_category.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-3">المصروفات حسب الفئة</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {expenses_by_category.map((item: ReportData, index: number) => (
              <div key={index} className="bg-white p-3 rounded-lg border">
                <div className="text-sm text-gray-600">{expenseCategories[item.category] || item.category}</div>
                <div className="text-lg font-bold text-red-600">{formatCurrency(item.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Flow */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="التحصيلات" value={formatCurrency(summary?.collections)} color="green" />
        <StatCard title="المدفوعات المستلمة" value={formatCurrency(summary?.payments_received)} color="green" />
        <StatCard title="المدفوعات للموردين" value={formatCurrency(summary?.payments_made)} color="orange" />
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">صافي التدفق النقدي</h3>
        <div className={`text-2xl font-bold ${(summary?.net_cash_flow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(summary?.net_cash_flow)}
        </div>
      </div>

      {/* Outstanding */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 rounded-lg">
          <h3 className="text-green-800 font-semibold mb-1">مستحقات من العملاء</h3>
          <div className="text-xl font-bold text-green-600">
            {formatCurrency(outstanding?.clients_receivable)}
          </div>
        </div>
        <div className="p-4 bg-red-50 rounded-lg">
          <h3 className="text-red-800 font-semibold mb-1">مستحقات للموردين</h3>
          <div className="text-xl font-bold text-red-600">
            {formatCurrency(outstanding?.suppliers_payable)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientBalancesReport({ data }: { data: ReportData }) {
  const { data: clients, totals } = data;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="عدد العملاء" value={totals?.total_clients || 0} />
        <StatCard title="إجمالي الأرصدة" value={formatCurrency(totals?.total_balance)} color="blue" />
        <StatCard title="تجاوز الحد" value={totals?.over_limit_count || 0} color="red" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-3">العميل</th>
              <th className="text-right p-3">الهاتف</th>
              <th className="text-right p-3">العنوان</th>
              <th className="text-right p-3">الرصيد</th>
              <th className="text-right p-3">حد الائتمان</th>
              <th className="text-right p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c: ReportData, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone || '-'}</td>
                <td className="p-3 max-w-xs truncate">{c.address || '-'}</td>
                <td className="p-3 font-medium">{formatCurrency(c.balance)}</td>
                <td className="p-3">{formatCurrency(c.credit_limit)}</td>
                <td className="p-3">
                  {c.over_limit ? (
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">تجاوز الحد</span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">عادي</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CollectionsReport({ data }: { data: ReportData }) {
  const { collections, by_livreur, totals } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="المستحق" value={formatCurrency(totals?.expected)} color="orange" />
        <StatCard title="المحصل" value={formatCurrency(totals?.collected)} color="green" />
        <StatCard title="المتبقي" value={formatCurrency(totals?.pending)} color="red" />
      </div>

      <div>
        <h3 className="font-semibold mb-3">حسب السائق</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-2">السائق</th>
              <th className="text-right p-2">المستحق</th>
              <th className="text-right p-2">المحصل</th>
              <th className="text-right p-2">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {by_livreur?.map((l: ReportData, i: number) => (
              <tr key={i} className="border-b">
                <td className="p-2 font-medium">{l.name}</td>
                <td className="p-2">{formatCurrency(l.expected)}</td>
                <td className="p-2 text-green-600">{formatCurrency(l.collected)}</td>
                <td className="p-2 text-red-600">{formatCurrency(l.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-semibold mb-3">التفاصيل</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">المرجع</th>
              <th className="text-right p-2">السائق</th>
              <th className="text-right p-2">المستحق</th>
              <th className="text-right p-2">المحصل</th>
            </tr>
          </thead>
          <tbody>
            {collections?.map((c: ReportData, i: number) => (
              <tr key={i} className="border-b">
                <td className="p-2">{c.date}</td>
                <td className="p-2 font-mono text-xs">{c.reference}</td>
                <td className="p-2">{c.livreur}</td>
                <td className="p-2">{formatCurrency(c.expected)}</td>
                <td className="p-2 text-green-600">{formatCurrency(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ Debt Reports ============

function DebtSummaryReport({ data }: { data: ReportData }) {
  const { summary, aging, top_debtors } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="إجمالي الديون" value={formatCurrency(summary?.total_debt)} color="red" />
        <StatCard title="عدد المدينين" value={summary?.clients_with_debt || 0} color="orange" />
        <StatCard title="متوسط الدين" value={formatCurrency(summary?.average_debt)} color="blue" />
        <StatCard title="تجاوز الحد" value={summary?.over_limit_clients || 0} color="red" />
      </div>

      {/* Aging Summary */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-4">تقادم الديون</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-3 rounded-lg border border-green-200">
            <div className="text-sm text-gray-600">0-7 أيام</div>
            <div className="text-lg font-bold text-green-600">{formatCurrency(aging?.days_0_7)}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-yellow-200">
            <div className="text-sm text-gray-600">8-30 يوم</div>
            <div className="text-lg font-bold text-yellow-600">{formatCurrency(aging?.days_8_30)}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-orange-200">
            <div className="text-sm text-gray-600">31-60 يوم</div>
            <div className="text-lg font-bold text-orange-600">{formatCurrency(aging?.days_31_60)}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-red-200">
            <div className="text-sm text-gray-600">أكثر من 60 يوم</div>
            <div className="text-lg font-bold text-red-600">{formatCurrency(aging?.days_over_60)}</div>
          </div>
        </div>
      </div>

      {/* Top Debtors */}
      <div>
        <h3 className="font-semibold mb-3">أكبر المدينين</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-right p-3">العميل</th>
                <th className="text-right p-3">الهاتف</th>
                <th className="text-right p-3">العنوان</th>
                <th className="text-right p-3">الرصيد</th>
                <th className="text-right p-3">حد الائتمان</th>
                <th className="text-right p-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {top_debtors?.map((c: ReportData, i: number) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.phone || '-'}</td>
                  <td className="p-3 max-w-xs truncate">{c.address || '-'}</td>
                  <td className="p-3 font-bold text-red-600">{formatCurrency(c.balance)}</td>
                  <td className="p-3">{formatCurrency(c.credit_limit)}</td>
                  <td className="p-3">
                    {c.balance > c.credit_limit ? (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">تجاوز الحد</span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">مدين</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DebtDetailsReport({ data }: { data: ReportData }) {
  const { data: clients, totals } = data;

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="عدد المدينين" value={totals?.total_clients || 0} />
        <StatCard title="إجمالي الديون" value={formatCurrency(totals?.total_debt)} color="red" />
        <StatCard title="عدد الطلبات غير المسددة" value={totals?.total_unpaid_orders || 0} color="orange" />
      </div>

      {/* Clients with Debt Details */}
      <div className="space-y-4">
        {clients?.map((client: ReportData, index: number) => {
          // Check for data consistency
          const hasDiscrepancy = client.calculated_debt !== undefined &&
            Math.abs(client.total_debt - client.calculated_debt) > 0.01;

          return (
            <div key={index} className="border rounded-lg overflow-hidden">
              {/* Client Header */}
              <div className="bg-gray-50 p-4 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-lg">{client.name}</div>
                  <div className="text-sm text-gray-600">
                    {client.phone && <span className="ml-4">{client.phone}</span>}
                    {client.address && <span>{client.address}</span>}
                  </div>
                  {hasDiscrepancy && (
                    <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>فرق في الحساب: الرصيد {formatCurrency(client.total_debt)} ≠ مجموع الطلبات {formatCurrency(client.calculated_debt)}</span>
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(client.total_debt)}</div>
                  <div className="text-xs text-gray-500">حد الائتمان: {formatCurrency(client.credit_limit)}</div>
                </div>
              </div>

              {/* Unpaid Orders */}
              {client.unpaid_orders && client.unpaid_orders.length > 0 && (
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-600">
                        <th className="text-right p-2">المرجع</th>
                        <th className="text-right p-2">تاريخ التسليم</th>
                        <th className="text-right p-2">المبلغ المستحق</th>
                        <th className="text-right p-2">المدفوع</th>
                        <th className="text-right p-2">المتبقي</th>
                        <th className="text-right p-2">العمر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.unpaid_orders.map((order: ReportData, i: number) => {
                        const daysOld = order.days_old ?? 0;
                        return (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-mono text-xs">{order.reference}</td>
                            <td className="p-2">{order.delivered_at || '-'}</td>
                            <td className="p-2">{formatCurrency(order.amount_due)}</td>
                            <td className="p-2 text-green-600">{formatCurrency(order.amount_collected)}</td>
                            <td className="p-2 font-medium text-red-600">{formatCurrency(order.remaining)}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                daysOld <= 7 ? 'bg-green-100 text-green-800' :
                                daysOld <= 30 ? 'bg-yellow-100 text-yellow-800' :
                                daysOld <= 60 ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {daysOld} يوم
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(!clients || clients.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          لا يوجد عملاء مدينين
        </div>
      )}
    </div>
  );
}

function DebtAgingReport({ data }: { data: ReportData }) {
  const { data: clients, totals } = data;

  return (
    <div>
      {/* Totals by Age */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-700">0-7 أيام</div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(totals?.current)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-700">8-30 يوم</div>
          <div className="text-xl font-bold text-yellow-600">{formatCurrency(totals?.days_30)}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-orange-700">31-60 يوم</div>
          <div className="text-xl font-bold text-orange-600">{formatCurrency(totals?.days_60)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-700">أكثر من 60 يوم</div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(totals?.over_60)}</div>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="text-sm text-gray-700">الإجمالي</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(totals?.total)}</div>
        </div>
      </div>

      {/* Aging Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-3">العميل</th>
              <th className="text-right p-3">الهاتف</th>
              <th className="text-right p-3 bg-green-50">0-7 أيام</th>
              <th className="text-right p-3 bg-yellow-50">8-30 يوم</th>
              <th className="text-right p-3 bg-orange-50">31-60 يوم</th>
              <th className="text-right p-3 bg-red-50">+60 يوم</th>
              <th className="text-right p-3">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c: ReportData, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-gray-600">{c.phone || '-'}</td>
                <td className="p-3 bg-green-50/50">
                  {c.current > 0 ? <span className="text-green-700">{formatCurrency(c.current)}</span> : '-'}
                </td>
                <td className="p-3 bg-yellow-50/50">
                  {c.days_30 > 0 ? <span className="text-yellow-700">{formatCurrency(c.days_30)}</span> : '-'}
                </td>
                <td className="p-3 bg-orange-50/50">
                  {c.days_60 > 0 ? <span className="text-orange-700">{formatCurrency(c.days_60)}</span> : '-'}
                </td>
                <td className="p-3 bg-red-50/50">
                  {c.over_60 > 0 ? <span className="text-red-700 font-medium">{formatCurrency(c.over_60)}</span> : '-'}
                </td>
                <td className="p-3 font-bold">{formatCurrency(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(!clients || clients.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          لا يوجد عملاء مدينين
        </div>
      )}
    </div>
  );
}

// ============ Helper Components ============

function StatCard({ title, value, color = 'gray' }: { title: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-800',
    blue: 'bg-blue-50 text-blue-800',
    green: 'bg-green-50 text-green-800',
    red: 'bg-red-50 text-red-800',
    orange: 'bg-orange-50 text-orange-800',
  };

  return (
    <div className={`p-4 rounded-lg ${colors[color]}`}>
      <div className="text-sm opacity-75">{title}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    preparing: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const labels: Record<string, string> = {
    completed: 'مكتمل',
    in_progress: 'قيد التنفيذ',
    preparing: 'قيد التحضير',
    cancelled: 'ملغي',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs ${styles[status] || 'bg-gray-100'}`}>
      {labels[status] || status}
    </span>
  );
}

// ============ Helper Functions ============

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0 د.ج';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${num.toLocaleString('ar-DZ')} د.ج`;
}

function formatValue(value: unknown, key: string): string {
  if (value === null || value === undefined) return '-';

  // Currency fields
  if (key.includes('amount') || key.includes('revenue') || key.includes('cost') ||
      key.includes('profit') || key.includes('balance') || key.includes('price') ||
      key.includes('collected') || key.includes('total') || key.includes('value')) {
    return formatCurrency(value as number);
  }

  // Percentage fields
  if (key.includes('rate')) {
    return `${value}%`;
  }

  return String(value);
}

function getColumnLabels(tab: string, subTab: string): Record<string, string> {
  // Common labels
  const labels: Record<string, string> = {
    id: 'المعرف',
    name: 'الاسم',
    phone: 'الهاتف',
    address: 'العنوان',
    date: 'التاريخ',
    status: 'الحالة',
    reference: 'المرجع',
    barcode: 'الباركود',
    quantity: 'الكمية',
    total_quantity: 'إجمالي الكمية',
    total_orders: 'إجمالي الطلبات',
    total_revenue: 'إجمالي الإيرادات',
    total_cost: 'إجمالي التكلفة',
    profit: 'الربح',
    category_name: 'الفئة',
    warehouse_name: 'المستودع',
    livreur_name: 'السائق',
    success_rate: 'نسبة النجاح',
    delivered_orders: 'الطلبات المسلمة',
    failed_orders: 'الطلبات الفاشلة',
    collected_amount: 'المبلغ المحصل',
    total_amount: 'المبلغ الإجمالي',
    balance: 'الرصيد',
    credit_limit: 'حد الائتمان',
    min_stock: 'الحد الأدنى',
    current_stock: 'المخزون الحالي',
    shortage: 'النقص',
    stock_value: 'قيمة المخزون',
  };

  return labels;
}

function getSummaryLabel(key: string): string {
  const labels: Record<string, string> = {
    total_orders: 'إجمالي الطلبات',
    delivered_orders: 'الطلبات المسلمة',
    cancelled_orders: 'الطلبات الملغاة',
    pending_orders: 'الطلبات المعلقة',
    total_revenue: 'إجمالي الإيرادات',
    total_value: 'القيمة الإجمالية',
    total_quantity: 'إجمالي الكمية',
    total_cost: 'إجمالي التكلفة',
    total_profit: 'إجمالي الربح',
    total_clients: 'عدد العملاء',
    total_products: 'عدد المنتجات',
    total_deliveries: 'إجمالي الرحلات',
    completed_deliveries: 'الرحلات المكتملة',
    success_rate: 'نسبة النجاح',
    sales_revenue: 'إيرادات المبيعات',
    purchase_costs: 'تكلفة المشتريات',
    gross_profit: 'إجمالي الربح',
    total_expenses: 'إجمالي المصروفات',
    net_profit: 'صافي الربح',
    collections: 'التحصيلات',
    net_cash_flow: 'صافي التدفق النقدي',
    low_stock_count: 'عدد المنتجات بنقص',
    total_balance: 'إجمالي الأرصدة',
    over_limit_count: 'تجاوز الحد',
  };

  return labels[key] || key;
}
