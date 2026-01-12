'use client';

import { useState, useEffect } from 'react';
import { unitsApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Unit {
  id: number;
  name: string;
  short_name: string;
  base_unit_id?: number;
  base_unit?: Unit;
  operator?: '*' | '/';
  operation_value?: number;
  is_active: boolean;
  created_at: string;
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    base_unit_id: '',
    operator: '*' as '*' | '/',
    operation_value: '',
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUnits();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert or Alt+N: Open add modal
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        setEditingUnit(null);
        resetForm();
        setShowModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchUnits = async () => {
    try {
      const response = await unitsApi.getAll();
      setUnits(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل الوحدات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data = {
      name: formData.name,
      short_name: formData.short_name,
      is_active: formData.is_active,
      base_unit_id: formData.base_unit_id ? parseInt(formData.base_unit_id) : null,
      operator: formData.base_unit_id ? formData.operator : null,
      operation_value: formData.base_unit_id && formData.operation_value ? parseFloat(formData.operation_value) : null,
    };

    try {
      if (editingUnit) {
        await unitsApi.update(editingUnit.id, data);
        toast.success('تم تحديث الوحدة بنجاح');
      } else {
        await unitsApi.create(data);
        toast.success('تم إضافة الوحدة بنجاح');
      }
      setShowModal(false);
      setEditingUnit(null);
      resetForm();
      fetchUnits();
    } catch (error) {
      toast.error('خطأ في حفظ الوحدة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      short_name: '',
      base_unit_id: '',
      operator: '*',
      operation_value: '',
      is_active: true,
    });
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      short_name: unit.short_name,
      base_unit_id: unit.base_unit_id?.toString() || '',
      operator: unit.operator || '*',
      operation_value: unit.operation_value?.toString() || '',
      is_active: unit.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الوحدة؟')) return;

    try {
      await unitsApi.delete(id);
      toast.success('تم حذف الوحدة بنجاح');
      fetchUnits();
    } catch (error) {
      toast.error('خطأ في حذف الوحدة');
    }
  };

  const filteredUnits = units.filter(unit =>
    unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.short_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const baseUnits = units.filter(u => !u.base_unit_id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Shortcuts hint */}
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg mb-4 flex items-center gap-6 text-sm">
        <span className="font-medium">اختصارات:</span>
        <span><kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">Insert</kbd> إضافة جديد</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">الوحدات</h1>
        <button
          onClick={() => {
            setEditingUnit(null);
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          إضافة وحدة
          <kbd className="bg-blue-700 px-1.5 py-0.5 rounded text-xs mr-2">Insert</kbd>
        </button>
      </div>

      <div className="card">
        <div className="mb-4">
          <input
            type="text"
            placeholder="بحث..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input max-w-xs"
          />
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم</th>
              <th>الاختصار</th>
              <th>الوحدة الأساسية</th>
              <th>التحويل</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredUnits.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  لا توجد وحدات
                </td>
              </tr>
            ) : (
              filteredUnits.map((unit, index) => (
                <tr key={unit.id}>
                  <td>{index + 1}</td>
                  <td className="font-medium">{unit.name}</td>
                  <td>{unit.short_name}</td>
                  <td>{unit.base_unit?.name || '-'}</td>
                  <td>
                    {unit.base_unit_id && unit.operator && unit.operation_value
                      ? `1 ${unit.short_name} = ${unit.operation_value} ${unit.base_unit?.short_name}`
                      : '-'}
                  </td>
                  <td>
                    <span className={`badge ${unit.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {unit.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(unit)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id)}
                        className="text-red-600 hover:text-red-800"
                      >
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingUnit ? 'تعديل الوحدة' : 'إضافة وحدة'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الاسم <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input"
                      placeholder="مثال: كيلوغرام"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الاختصار <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.short_name}
                      onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                      className="input"
                      placeholder="مثال: كغ"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الوحدة الأساسية (للتحويل)
                  </label>
                  <select
                    value={formData.base_unit_id}
                    onChange={(e) => setFormData({ ...formData, base_unit_id: e.target.value })}
                    className="select"
                  >
                    <option value="">-- بدون وحدة أساسية --</option>
                    {baseUnits.filter(u => u.id !== editingUnit?.id).map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.short_name})
                      </option>
                    ))}
                  </select>
                </div>

                {formData.base_unit_id && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        العملية
                      </label>
                      <select
                        value={formData.operator}
                        onChange={(e) => setFormData({ ...formData, operator: e.target.value as '*' | '/' })}
                        className="select"
                      >
                        <option value="*">ضرب (×)</option>
                        <option value="/">قسمة (÷)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        قيمة التحويل
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.operation_value}
                        onChange={(e) => setFormData({ ...formData, operation_value: e.target.value })}
                        className="input"
                        placeholder="مثال: 1000"
                      />
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">نشط</span>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-secondary flex-1"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
