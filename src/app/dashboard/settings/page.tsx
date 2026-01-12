'use client';

import { useState, useEffect, useRef } from 'react';
import { settingsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { SunIcon, MoonIcon, PhotoIcon, TrashIcon, LockClosedIcon, KeyIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [isCheckingPassword, setIsCheckingPassword] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [activeTab, setActiveTab] = useState('company');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState({
    // Company Info
    company_name: '',
    company_phone: '',
    company_email: '',
    company_address: '',
    company_rc: '',
    company_nif: '',
    company_ai: '',
    company_nis: '',
    company_rib: '',
    company_logo: '',
    // General
    currency: 'DZD',
    tax_rate: '19',
    low_stock_alert: '10',
    // Invoice
    invoice_prefix_sale: 'VNT-',
    invoice_prefix_purchase: 'ACH-',
    invoice_show_logo: 'true',
    invoice_show_company: 'true',
    // Theme
    theme: 'light',
  });

  const [darkMode, setDarkMode] = useState(false);

  // Password management state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  useEffect(() => {
    checkPasswordProtection();
    // Check localStorage for dark mode
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const checkPasswordProtection = async () => {
    try {
      const response = await settingsApi.hasPassword();
      const hasPass = response.data.has_password;
      setHasPassword(hasPass);
      if (!hasPass) {
        setIsUnlocked(true);
        fetchSettings();
      }
    } catch (error) {
      console.error('Error checking password:', error);
      // If error, assume no password and unlock
      setIsUnlocked(true);
      fetchSettings();
    } finally {
      setIsCheckingPassword(false);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await settingsApi.verifyPassword(passwordInput);
      if (response.data.verified) {
        setIsUnlocked(true);
        fetchSettings();
        toast.success('تم التحقق بنجاح');
      }
    } catch (error) {
      toast.error('كلمة المرور غير صحيحة');
    } finally {
      setIsVerifying(false);
      setPasswordInput('');
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await settingsApi.getAll();
      const data = response.data;
      setSettings(prev => ({
        ...prev,
        ...data,
      }));
      if (data.company_logo) {
        setLogoPreview(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${data.company_logo}`);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsApi.update(settings);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      toast.error('خطأ في حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const response = await settingsApi.uploadLogo(formData);
      setSettings(prev => ({ ...prev, company_logo: response.data.path }));
      toast.success('تم رفع الشعار بنجاح');
    } catch (error) {
      toast.error('خطأ في رفع الشعار');
      setLogoPreview(null);
    }
  };

  const handleDeleteLogo = async () => {
    try {
      await settingsApi.deleteLogo();
      setLogoPreview(null);
      setSettings(prev => ({ ...prev, company_logo: '' }));
      toast.success('تم حذف الشعار');
    } catch (error) {
      toast.error('خطأ في حذف الشعار');
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
    setSettings(prev => ({ ...prev, theme: newMode ? 'dark' : 'light' }));
    // Dispatch storage event for other components
    window.dispatchEvent(new StorageEvent('storage', { key: 'darkMode', newValue: newMode ? 'true' : 'false' }));
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('كلمة المرور غير متطابقة');
      return;
    }

    if (newPassword.length < 4) {
      toast.error('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      return;
    }

    setIsSettingPassword(true);
    try {
      await settingsApi.setPassword({
        current_password: hasPassword ? currentPassword : undefined,
        new_password: newPassword,
      });
      toast.success('تم تحديث كلمة المرور بنجاح');
      setHasPassword(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('خطأ في تحديث كلمة المرور');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleRemovePassword = async () => {
    if (!currentPassword) {
      toast.error('يرجى إدخال كلمة المرور الحالية');
      return;
    }

    if (!confirm('هل أنت متأكد من إزالة حماية كلمة المرور؟')) return;

    setIsSettingPassword(true);
    try {
      await settingsApi.removePassword(currentPassword);
      toast.success('تم إزالة كلمة المرور');
      setHasPassword(false);
      setCurrentPassword('');
    } catch (error) {
      toast.error('كلمة المرور غير صحيحة');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const tabs = [
    { id: 'company', name: 'الشركة', icon: '🏢' },
    { id: 'legal', name: 'المعلومات القانونية', icon: '📋' },
    { id: 'general', name: 'عام', icon: '⚙️' },
    { id: 'invoice', name: 'الفواتير', icon: '📄' },
    { id: 'appearance', name: 'المظهر', icon: '🎨' },
    { id: 'security', name: 'الأمان', icon: '🔒' },
  ];

  // Show loading while checking password
  if (isCheckingPassword) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  // Show password prompt if not unlocked
  if (!isUnlocked && hasPassword) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <LockClosedIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold dark:text-white">الإعدادات محمية</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">يرجى إدخال كلمة المرور للوصول إلى الإعدادات</p>
          </div>

          <form onSubmit={handleVerifyPassword}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                كلمة المرور
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="input"
                placeholder="أدخل كلمة المرور..."
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="btn btn-primary w-full"
            >
              {isVerifying ? (
                <>
                  <div className="spinner w-5 h-5"></div>
                  جاري التحقق...
                </>
              ) : (
                <>
                  <KeyIcon className="w-5 h-5" />
                  دخول
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-white">الإعدادات</h1>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700"
          title={darkMode ? 'الوضع الفاتح' : 'الوضع الداكن'}
        >
          {darkMode ? (
            <SunIcon className="w-6 h-6 text-yellow-500" />
          ) : (
            <MoonIcon className="w-6 h-6 text-gray-600" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tabs */}
        <div className="lg:col-span-1">
          <div className="card p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium">{tab.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card">
            {activeTab === 'company' && (
              <div>
                <h2 className="text-lg font-semibold mb-4 dark:text-white">معلومات الشركة</h2>

                {/* Logo Upload */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">شعار الشركة</label>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <PhotoIcon className="w-12 h-12 text-gray-400" />
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-secondary text-sm"
                      >
                        <PhotoIcon className="w-4 h-4" />
                        رفع شعار
                      </button>
                      {logoPreview && (
                        <button
                          onClick={handleDeleteLogo}
                          className="btn btn-danger text-sm"
                        >
                          <TrashIcon className="w-4 h-4" />
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">الحد الأقصى: 2 ميجابايت. PNG, JPG, GIF</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم الشركة</label>
                    <input
                      type="text"
                      value={settings.company_name}
                      onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                      className="input"
                      placeholder="RAFIK BISKRA"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الهاتف</label>
                      <input
                        type="tel"
                        value={settings.company_phone}
                        onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                        className="input"
                        dir="ltr"
                        placeholder="0555 123 456"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">البريد الإلكتروني</label>
                      <input
                        type="email"
                        value={settings.company_email}
                        onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                        className="input"
                        dir="ltr"
                        placeholder="info@company.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">العنوان</label>
                    <textarea
                      value={settings.company_address}
                      onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                      className="input"
                      rows={2}
                      placeholder="بسكرة، الجزائر"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'legal' && (
              <div>
                <h2 className="text-lg font-semibold mb-4 dark:text-white">المعلومات القانونية (للفواتير)</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">هذه المعلومات ستظهر على جميع الفواتير</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        RC (السجل التجاري)
                      </label>
                      <input
                        type="text"
                        value={settings.company_rc}
                        onChange={(e) => setSettings({ ...settings, company_rc: e.target.value })}
                        className="input"
                        dir="ltr"
                        placeholder="00/00-0000000B00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        NIF (الرقم الجبائي)
                      </label>
                      <input
                        type="text"
                        value={settings.company_nif}
                        onChange={(e) => setSettings({ ...settings, company_nif: e.target.value })}
                        className="input"
                        dir="ltr"
                        placeholder="000000000000000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        AI (رقم المادة)
                      </label>
                      <input
                        type="text"
                        value={settings.company_ai}
                        onChange={(e) => setSettings({ ...settings, company_ai: e.target.value })}
                        className="input"
                        dir="ltr"
                        placeholder="00000000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        NIS (رقم الإحصاء)
                      </label>
                      <input
                        type="text"
                        value={settings.company_nis}
                        onChange={(e) => setSettings({ ...settings, company_nis: e.target.value })}
                        className="input"
                        dir="ltr"
                        placeholder="000000000000000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      RIB (رقم الحساب البنكي)
                    </label>
                    <input
                      type="text"
                      value={settings.company_rib}
                      onChange={(e) => setSettings({ ...settings, company_rib: e.target.value })}
                      className="input"
                      dir="ltr"
                      placeholder="00000 00000 00000000000 00"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div>
                <h2 className="text-lg font-semibold mb-4 dark:text-white">الإعدادات العامة</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">العملة</label>
                    <select
                      value={settings.currency}
                      onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                      className="select"
                    >
                      <option value="DZD">دينار جزائري (DZD)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="EUR">يورو (EUR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نسبة الضريبة الافتراضية (%)</label>
                    <input
                      type="number"
                      value={settings.tax_rate}
                      onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">تنبيه نقص المخزون (الحد الأدنى)</label>
                    <input
                      type="number"
                      value={settings.low_stock_alert}
                      onChange={(e) => setSettings({ ...settings, low_stock_alert: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'invoice' && (
              <div>
                <h2 className="text-lg font-semibold mb-4 dark:text-white">إعدادات الفواتير</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">بادئة فواتير المبيعات</label>
                      <input
                        type="text"
                        value={settings.invoice_prefix_sale}
                        onChange={(e) => setSettings({ ...settings, invoice_prefix_sale: e.target.value })}
                        className="input"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">بادئة فواتير المشتريات</label>
                      <input
                        type="text"
                        value={settings.invoice_prefix_purchase}
                        onChange={(e) => setSettings({ ...settings, invoice_prefix_purchase: e.target.value })}
                        className="input"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.invoice_show_logo === 'true'}
                        onChange={(e) => setSettings({ ...settings, invoice_show_logo: e.target.checked ? 'true' : 'false' })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">طباعة الشعار على الفواتير</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.invoice_show_company === 'true'}
                        onChange={(e) => setSettings({ ...settings, invoice_show_company: e.target.checked ? 'true' : 'false' })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">إظهار معلومات الشركة على الفواتير</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div>
                <h2 className="text-lg font-semibold mb-4 dark:text-white">المظهر</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">اختر المظهر</label>
                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          setDarkMode(false);
                          document.documentElement.classList.remove('dark');
                          localStorage.setItem('darkMode', 'false');
                          window.dispatchEvent(new StorageEvent('storage', { key: 'darkMode', newValue: 'false' }));
                        }}
                        className={`flex-1 p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                          !darkMode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <SunIcon className="w-8 h-8 text-yellow-500" />
                        <span className="font-medium dark:text-white">الوضع الفاتح</span>
                      </button>
                      <button
                        onClick={() => {
                          setDarkMode(true);
                          document.documentElement.classList.add('dark');
                          localStorage.setItem('darkMode', 'true');
                          window.dispatchEvent(new StorageEvent('storage', { key: 'darkMode', newValue: 'true' }));
                        }}
                        className={`flex-1 p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                          darkMode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <MoonIcon className="w-8 h-8 text-gray-600 dark:text-gray-300" />
                        <span className="font-medium dark:text-white">الوضع الداكن</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div>
                <h2 className="text-lg font-semibold mb-4 dark:text-white">إعدادات الأمان</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  حماية صفحة الإعدادات بكلمة مرور. عند التفعيل، سيطلب إدخال كلمة المرور للوصول إلى الإعدادات.
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasPassword ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <LockClosedIcon className={`w-5 h-5 ${hasPassword ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <h3 className="font-medium dark:text-white">
                        {hasPassword ? 'الحماية مفعلة' : 'الحماية غير مفعلة'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {hasPassword ? 'صفحة الإعدادات محمية بكلمة مرور' : 'يمكن لأي مستخدم الوصول إلى الإعدادات'}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSetPassword} className="space-y-4">
                    {hasPassword && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          كلمة المرور الحالية
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="input"
                          placeholder="أدخل كلمة المرور الحالية"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {hasPassword ? 'كلمة المرور الجديدة' : 'كلمة المرور'}
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input"
                        placeholder="أدخل كلمة المرور"
                        minLength={4}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        تأكيد كلمة المرور
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input"
                        placeholder="أعد إدخال كلمة المرور"
                        minLength={4}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isSettingPassword || !newPassword || !confirmPassword}
                        className="btn btn-primary"
                      >
                        {isSettingPassword ? (
                          <>
                            <div className="spinner w-5 h-5"></div>
                            جاري الحفظ...
                          </>
                        ) : (
                          <>
                            <LockClosedIcon className="w-5 h-5" />
                            {hasPassword ? 'تحديث كلمة المرور' : 'تفعيل الحماية'}
                          </>
                        )}
                      </button>

                      {hasPassword && (
                        <button
                          type="button"
                          onClick={handleRemovePassword}
                          disabled={isSettingPassword || !currentPassword}
                          className="btn btn-danger"
                        >
                          <TrashIcon className="w-5 h-5" />
                          إزالة الحماية
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab !== 'security' && (
              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  {isSaving ? (
                    <>
                      <div className="spinner w-5 h-5"></div>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      حفظ الإعدادات
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
