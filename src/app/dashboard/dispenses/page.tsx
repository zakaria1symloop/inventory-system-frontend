'use client';

import { useState, useEffect } from 'react';
import { dispensesApi, employeesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Dispense {
  id: number;
  reference: string;
  employee_id?: number;
  user_id: number;
  date: string;
  category: string;
  amount: number;
  description?: string;
  notes?: string;
  employee?: { id: number; name: string };
  user?: { id: number; name: string };
}

interface Employee {
  id: number;
  name: string;
  position?: string;
}

interface Summary {
  total: number;
  by_category: { category: string; total: number }[];
  by_employee: { employee_id: number; total: number; employee?: { name: string } }[];
  monthly: { month: string; total: number }[];
}

const categories: Record<string, string> = {
  salary: 'راتب',
  advance: 'سلفة',
  transport: 'نقل',
  maintenance: 'صيانة',
  supplies: 'مستلزمات',
  utilities: 'فواتير',
  rent: 'إيجار',
  other: 'أخرى',
};

const initialFormData = {
  employee_id: '',
  date: new Date().toISOString().split('T')[0],
  category: 'other',
  amount: 0,
  description: '',
  notes: '',
};

export default function DispensesPage() {
  const [dispenses, setDispenses] = useState<Dispense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [categoryFilter, employeeFilter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert key or Alt+N: open add modal
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        setEditingId(null);
        setFormData(initialFormData);
        setShowModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchData = async () => {
    try {
      const [dispensesRes, employeesRes, summaryRes] = await Promise.all([
        dispensesApi.getAll({
          per_page: 100,
          category: categoryFilter || undefined,
          employee_id: employeeFilter || undefined,
        }),
        employeesApi.getActive(),
        dispensesApi.getSummary(),
      ]);
      setDispenses(dispensesRes.data.data || dispensesRes.data);
      setEmployees(employeesRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        ...formData,
        employee_id: formData.employee_id || null,
      };

      if (editingId) {
        await dispensesApi.update(editingId, data);
        toast.success('تم تحديث المصروف بنجاح');
      } else {
        await dispensesApi.create(data);
        toast.success('تم إضافة المصروف بنجاح');
      }
      setShowModal(false);
      setFormData(initialFormData);
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast.error('خطأ في حفظ البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (dispense: Dispense) => {
    setEditingId(dispense.id);
    setFormData({
      employee_id: dispense.employee_id?.toString() || '',
      date: dispense.date,
      category: dispense.category,
      amount: dispense.amount,
      description: dispense.description || '',
      notes: dispense.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      await dispensesApi.delete(id);
      toast.success('تم حذف المصروف');
      fetchData();
    } catch (error) {
      toast.error('خطأ في حذف المصروف');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-DZ');
  };

  const filteredDispenses = dispenses.filter(d =>
    d.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.employee?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div>
      {/* Shortcuts hint */}
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg mb-4 flex items-center gap-6 text-sm">
        <span className="font-medium">اختصارات:</span>
        <span><kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">Insert</kbd> إضافة جديد</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-white">المصروفات</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowSummary(!showSummary)} className="btn btn-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            ملخص
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData(initialFormData);
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة مصروف
            <kbd className="bg-blue-700 px-1.5 py-0.5 rounded text-xs mr-1">Insert</kbd>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {showSummary && summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card bg-red-50 dark:bg-red-900/20">
            <h3 className="text-sm text-red-600 dark:text-red-400 mb-1">إجمالي المصروفات</h3>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(summary.total)}</p>
          </div>
          <div className="card">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">حسب الفئة</h3>
            <div className="space-y-1">
              {summary.by_category.slice(0, 4).map((item) => (
                <div key={item.category} className="flex justify-between text-sm">
                  <span>{categories[item.category] || item.category}</span>
                  <span className="font-medium">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">حسب الموظف</h3>
            <div className="space-y-1">
              {summary.by_employee.slice(0, 4).map((item) => (
                <div key={item.employee_id} className="flex justify-between text-sm">
                  <span>{item.employee?.name || 'غير محدد'}</span>
                  <span className="font-medium">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap gap-4 mb-4">
          <input
            type="text"
            placeholder="بحث..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input max-w-xs"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="select max-w-xs"
          >
            <option value="">كل الفئات</option>
            {Object.entries(categories).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="select max-w-xs"
          >
            <option value="">كل الموظفين</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>المرجع</th>
                <th>التاريخ</th>
                <th>الفئة</th>
                <th>الموظف</th>
                <th>الوصف</th>
                <th>المبلغ</th>
                <th>بواسطة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispenses.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">لا توجد مصروفات</td></tr>
              ) : (
                filteredDispenses.map((disp) => (
                  <tr key={disp.id}>
                    <td className="font-medium">{disp.reference}</td>
                    <td>{formatDate(disp.date)}</td>
                    <td>
                      <span className="badge badge-secondary">{categories[disp.category] || disp.category}</span>
                    </td>
                    <td>{disp.employee?.name || '-'}</td>
                    <td>{disp.description || '-'}</td>
                    <td className="font-medium text-red-600">{formatCurrency(disp.amount)}</td>
                    <td className="text-gray-500">{disp.user?.name || '-'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(disp)} className="text-blue-600 hover:text-blue-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(disp.id)} className="text-red-600 hover:text-red-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              {editingId ? 'تعديل مصروف' : 'إضافة مصروف جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">التاريخ *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">الفئة *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="select"
                    required
                  >
                    {Object.entries(categories).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">الموظف</label>
                  <select
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="select"
                  >
                    <option value="">بدون موظف</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">المبلغ *</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="input"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">الوصف</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  placeholder="وصف مختصر للمصروف..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">ملاحظات</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={isSaving} className="btn btn-primary flex-1">
                  {isSaving ? 'جاري الحفظ...' : editingId ? 'تحديث' : 'إضافة'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
