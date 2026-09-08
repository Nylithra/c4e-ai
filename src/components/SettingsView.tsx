import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  User,
  Globe,
  LogOut,
  CheckCircle2,
  Shield,
  Save,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Upload,
  Smartphone,
  BellRing,
  Bell,
  Users,
  Bot,
  Layers,
  Check,
  Palette,
  Download,
  FileCode,
  Sliders,
  Sun,
  Moon,
  Lock,
  RefreshCw,
  FolderDown
} from 'lucide-react';
import { validateFileSize, notifyFileSizeExceeded, isUserSpark } from '../utils/fileUploadHelper';
import { isPWARunningStandalone } from '../utils/pwaHelper';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendNativeNotification
} from '../utils/notificationSound';
import { IntegrationsSettings } from './IntegrationsSettings';
import { sanitizeUrl } from '../utils/securityHelper';
import {
  PRESET_THEMES,
  AppThemeConfig,
  GradientStop,
  getEffectiveTheme,
  applyThemeToDom,
  parseC4ETheme,
  downloadC4EThemeFile,
  serializeC4ETheme,
  buildGradientCss
} from '../utils/themeHelper';
import { CssGradientGenerator } from './CssGradientGenerator';

interface SettingsViewProps {
  user: UserProfile;
  language: 'tr' | 'en';
  onUpdateProfile: (updated: UserProfile) => void;
  onChangeLanguage: (lang: 'tr' | 'en') => void;
  onLogout: () => void;
  onOpenInstallPWA?: () => void;
}

type SettingsSection = 'overview' | 'profile' | 'appearance' | 'integrations' | 'notifications' | 'privacy' | 'preferences';

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  language,
  onUpdateProfile,
  onChangeLanguage,
  onLogout,
  onOpenInstallPWA
}) => {
  const getInitialFormData = (u: UserProfile): UserProfile => {
    const web = u.website || u.custom_fields?.website || '';
    const pinned = (u.pinned_repos && u.pinned_repos.length > 0)
      ? u.pinned_repos
      : (u.custom_fields?.pinned_repos && Array.isArray(u.custom_fields.pinned_repos))
      ? u.custom_fields.pinned_repos
      : [];
    return {
      ...u,
      website: web,
      pinned_repos: pinned,
      custom_fields: {
        ...(u.custom_fields || {}),
        website: web,
        pinned_repos: pinned
      }
    };
  };

  const [activeSection, setActiveSection] = useState<SettingsSection>('overview');
  const [formData, setFormData] = useState<UserProfile>(() => getInitialFormData(user));
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');

  const isSpark = isUserSpark(user) || (user.username || '').toLowerCase() === 'nylithra';
  const [currentTheme, setCurrentTheme] = useState<AppThemeConfig>(() => getEffectiveTheme(user));
  const [themeSaveSuccess, setThemeSaveSuccess] = useState(false);
  const themeFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsStandalone(isPWARunningStandalone());
    setNotifPermission(getNotificationPermission());
    setFormData(getInitialFormData(user));
    const eff = getEffectiveTheme(user);
    setCurrentTheme(eff);
  }, [user]);

  const handleSelectPresetTheme = (preset: AppThemeConfig) => {
    if (preset.isSparkExclusive && !isSpark) {
      alert(language === 'tr' ? 'Bu gradyant tema Spark Destekçilerine özeldir. Standart renkleri dilediğiniz gibi özelleştirebilirsiniz.' : 'This gradient theme is exclusive to Spark Supporters.');
      return;
    }
    const updated: AppThemeConfig = {
      ...preset,
      id: `theme_${Date.now()}`
    };
    setCurrentTheme(updated);
    applyThemeToDom(updated);
  };

  const handleThemeColorField = (field: 'text' | 'main' | 'buttons' | 'profile' | 'font', value: string) => {
    const updated: AppThemeConfig = {
      ...currentTheme,
      [field]: value
    };
    setCurrentTheme(updated);
    applyThemeToDom(updated);
  };

  const handleGradientChange = (data: {
    stops: GradientStop[];
    gradientType: 'linear' | 'radial';
    gradientAngle: number;
    radialShape: 'circle' | 'ellipse';
    css: string;
  }) => {
    const updated: AppThemeConfig = {
      ...currentTheme,
      isGradient: true,
      gradientType: data.gradientType,
      gradientAngle: data.gradientAngle,
      radialShape: data.radialShape,
      stops: data.stops,
      gradientCss: data.css
    };
    setCurrentTheme(updated);
    applyThemeToDom(updated);
  };

  const handleSaveTheme = () => {
    applyThemeToDom(currentTheme);
    const updatedUser: UserProfile = {
      ...user,
      ...formData,
      theme_color: currentTheme.main,
      accent_color: currentTheme.buttons,
      custom_fields: {
        ...(user.custom_fields || {}),
        ...(formData.custom_fields || {}),
        theme: currentTheme
      }
    };
    setFormData(updatedUser);
    onUpdateProfile(updatedUser);
    setThemeSaveSuccess(true);
    setTimeout(() => setThemeSaveSuccess(false), 3000);
  };

  const handleC4EFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSpark) {
      alert(language === 'tr' ? 'Özel .c4e tema dosyası yükleme Spark Destekçilerine özeldir!' : '.c4e theme upload is exclusive to Spark Supporters!');
      if (themeFileInputRef.current) themeFileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        try {
          const parsed = parseC4ETheme(content, file.name.replace(/\.c4e$/i, ''));
          setCurrentTheme(parsed);
          applyThemeToDom(parsed);
          const updatedUser: UserProfile = {
            ...user,
            ...formData,
            theme_color: parsed.main,
            accent_color: parsed.buttons,
            custom_fields: {
              ...(user.custom_fields || {}),
              ...(formData.custom_fields || {}),
              theme: parsed
            }
          };
          setFormData(updatedUser);
          onUpdateProfile(updatedUser);
          setThemeSaveSuccess(true);
          setTimeout(() => setThemeSaveSuccess(false), 3000);
        } catch (err) {
          console.error('Failed to parse .c4e theme file', err);
        }
      }
    };
    reader.readAsText(file);
    if (themeFileInputRef.current) themeFileInputRef.current.value = '';
  };

  const handleRequestNotif = async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      sendNativeNotification({
        title: 'Code4Ever Bildirimleri Aktif! 🔔',
        body:
          language === 'tr'
            ? 'Telefonunuza ve bilgisayarınıza gelen bildirimler artık anlık olarak iletilecektir.'
            : 'Notifications on your phone and PC are now active.',
        playSound: true
      });
    }
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateFileSize(file, user);
      if (!validation.isValid) {
        notifyFileSizeExceeded(validation);
        if (avatarInputRef.current) avatarInputRef.current.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setFormData((prev) => ({ ...prev, avatar_url: ev.target!.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateFileSize(file, user);
      if (!validation.isValid) {
        notifyFileSizeExceeded(validation);
        if (bannerInputRef.current) bannerInputRef.current.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setFormData((prev) => ({ ...prev, banner_url: ev.target!.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername =
      formData.username
        .replace(/^@/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '') || user.username;

    const rawWebsite = (formData.website || formData.custom_fields?.website || '').trim();
    let sanitizedWeb = '';
    if (rawWebsite) {
      const withProto = /^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`;
      sanitizedWeb = sanitizeUrl(withProto) || '';
    }

    const effectivePinned = (formData.pinned_repos && formData.pinned_repos.length > 0)
      ? formData.pinned_repos
      : (user.pinned_repos && user.pinned_repos.length > 0)
      ? user.pinned_repos
      : (user.custom_fields?.pinned_repos && Array.isArray(user.custom_fields.pinned_repos))
      ? user.custom_fields.pinned_repos
      : [];

    const updatedProfile: UserProfile = {
      ...user,
      ...formData,
      username: cleanUsername,
      website: sanitizedWeb || undefined,
      pinned_repos: effectivePinned,
      custom_fields: {
        ...(user.custom_fields || {}),
        ...(formData.custom_fields || {}),
        website: sanitizedWeb,
        pinned_repos: effectivePinned
      }
    };

    onUpdateProfile(updatedProfile);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const sectionTitles: Record<SettingsSection, string> = {
    overview: language === 'tr' ? 'Ayarlar' : 'Settings',
    profile: language === 'tr' ? 'Profil Bilgilerini Düzenle' : 'Edit Profile Information',
    appearance: language === 'tr' ? 'Görünüm, Temalar & Gradyan Editörü' : 'Appearance, Themes & Gradient Editor',
    integrations: language === 'tr' ? 'Webhook & Entegrasyonlar' : 'Webhook & Integrations',
    notifications: language === 'tr' ? 'Bildirimler & Ses' : 'Notifications & Sound',
    privacy: language === 'tr' ? 'Grup & Gizlilik Ayarları' : 'Group & Privacy Settings',
    preferences: language === 'tr' ? 'Dil & Tercihler' : 'Language & Preferences'
  };

  return (
    <div className="flex-1 min-w-0 w-full border-r border-zinc-800/60 min-h-screen pb-16 bg-[#09090b]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-[#09090b]/90 border-b border-zinc-800/40 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeSection !== 'overview' && (
            <button
              onClick={() => setActiveSection('overview')}
              className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>{sectionTitles[activeSection]}</span>
            <span className="w-2 h-2 rounded-full bg-zinc-400" />
          </h2>
        </div>
      </div>

      <div className="p-6 w-full max-w-4xl mx-auto space-y-6">
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* Quick Profile Overview Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <img
                  src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={user.display_name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{user.display_name}</span>
                    {user.isAdmin && (
                      <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[10px] font-bold">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">@{user.username}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSection('profile')}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-white transition-all cursor-pointer"
              >
                {language === 'tr' ? 'Profili Düzenle' : 'Edit Profile'}
              </button>
            </div>

            {/* Navigation Grid / List */}
            <div className="grid grid-cols-1 gap-2.5">
              {/* Appearance & Themes */}
              <button
                type="button"
                onClick={() => setActiveSection('appearance')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#0c0c0e] hover:bg-zinc-900/60 border border-purple-900/30 hover:border-purple-800/60 transition-all text-left group cursor-pointer shadow-lg shadow-purple-950/10"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-900/40 group-hover:scale-105 transition-transform">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white block group-hover:text-purple-400 transition-colors">
                        {language === 'tr' ? 'Görünüm, Temalar & CSS Gradyan Editörü' : 'Appearance, Themes & CSS Gradient Editor'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-mono font-bold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 fill-amber-400" />
                        <span>SPARK .C4E</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono block">
                      {language === 'tr'
                        ? 'Astra teması, açık/koyu mod, renk geçişleri ve .c4e tema yükleme'
                        : 'Astra theme, light/dark mode, color gradients and .c4e theme upload'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>

              {/* 1. Integrations */}
              <button
                type="button"
                onClick={() => setActiveSection('integrations')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#0c0c0e] hover:bg-zinc-900/60 border border-zinc-800/80 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-blue-950/60 text-blue-400 border border-blue-900/40 group-hover:scale-105 transition-transform">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block group-hover:text-blue-400 transition-colors">
                      {language === 'tr' ? 'Ekip İlanı Webhook & Entegrasyonlar' : 'Job Listing Webhook & Integrations'}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono block">
                      {language === 'tr'
                        ? 'Discord, Jubbio ve Telegram bot bildirimleri, şablon ayarları'
                        : 'Discord, Jubbio and Telegram bot dispatchers & templates'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>

              {/* 2. Notifications & Sound */}
              <button
                type="button"
                onClick={() => setActiveSection('notifications')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#0c0c0e] hover:bg-zinc-900/60 border border-zinc-800/80 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-900/40 group-hover:scale-105 transition-transform">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block group-hover:text-amber-400 transition-colors">
                      {language === 'tr' ? 'Bildirimler & Ses' : 'Notifications & Audio'}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono block">
                      {language === 'tr'
                        ? 'Masaüstü ve mobil bildirim izinleri, ses efektleri'
                        : 'Desktop/mobile push notification permissions and chime'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>

              {/* 4. Privacy & Group Invites */}
              <button
                type="button"
                onClick={() => setActiveSection('privacy')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#0c0c0e] hover:bg-zinc-900/60 border border-zinc-800/80 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-900/40 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block group-hover:text-purple-400 transition-colors">
                      {language === 'tr' ? 'Grup Davetleri & Gizlilik' : 'Group Invites & Privacy'}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono block">
                      {language === 'tr' ? 'Grup daveti alma izinleri ve gizlilik kontrolleri' : 'Group invite permissions and privacy filters'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>

              {/* 5. Language & Preferences */}
              <button
                type="button"
                onClick={() => setActiveSection('preferences')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#0c0c0e] hover:bg-zinc-900/60 border border-zinc-800/80 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-900/40 group-hover:scale-105 transition-transform">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block group-hover:text-cyan-400 transition-colors">
                      {language === 'tr' ? 'Dil Seçimi (TR / EN)' : 'Language (TR / EN)'}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono block">
                      {language === 'tr' ? 'Arayüz dili ayarları' : 'Interface language preferences'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Logout Action */}
            <div className="pt-3">
              <button
                onClick={onLogout}
                className="w-full py-3 rounded-2xl bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 text-red-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'tr' ? 'Oturumu Kapat' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Profile Edit Section */}
        {activeSection === 'profile' && (
          <form onSubmit={handleSubmit} className="bg-[#0c0c0e] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                <span>{language === 'tr' ? 'Profil Bilgileri' : 'Profile Information'}</span>
              </h3>
              {savedSuccess && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'tr' ? 'Kaydedildi' : 'Saved'}</span>
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-300 block mb-1 font-medium flex items-center justify-between">
                  <span>{language === 'tr' ? 'Kullanıcı Adı (@username)' : 'Username (@username)'}</span>
                  <span className="text-[10px] font-mono text-blue-400">@{formData.username}</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-zinc-500 font-mono">@</span>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        username: e.target.value.toLowerCase().replace(/\s+/g, '_')
                      })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-7 pr-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-300 block mb-1 font-medium">
                  {language === 'tr' ? 'Görünen Ad' : 'Display Name'}
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1 font-medium">
                  {language === 'tr' ? 'Profil Fotoğrafı' : 'Avatar Image'}
                </label>
                <div className="flex gap-2 items-center">
                  <img
                    src={formData.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                    alt="Avatar preview"
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-zinc-800 flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none font-mono text-xs"
                  />
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-mono text-xs flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    <span>{language === 'tr' ? 'Yükle' : 'Upload'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-zinc-300 block mb-1 font-medium">
                  {language === 'tr' ? 'Banner Görseli' : 'Banner Image'}
                </label>
                <div className="flex gap-2 items-center">
                  <img
                    src={formData.banner_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80'}
                    alt="Banner preview"
                    className="w-12 h-8 rounded-lg object-cover ring-1 ring-zinc-800 flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={formData.banner_url}
                    onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none font-mono text-xs"
                  />
                  <input
                    type="file"
                    ref={bannerInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerUpload}
                  />
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-mono text-xs flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    <span>{language === 'tr' ? 'Yükle' : 'Upload'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-zinc-300 block mb-1 font-medium">
                  {language === 'tr' ? 'Biyografi' : 'Bio'}
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1 font-medium">
                  {language === 'tr' ? 'Konum' : 'Location'}
                </label>
                <input
                  type="text"
                  value={formData.custom_fields?.location || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      custom_fields: { ...formData.custom_fields, location: e.target.value }
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1 font-medium">
                  {language === 'tr' ? 'Web Sitesi (URL)' : 'Website (URL)'}
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="text"
                    value={formData.website || formData.custom_fields?.website || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      website: e.target.value,
                      custom_fields: { ...(formData.custom_fields || {}), website: e.target.value }
                    })}
                    placeholder="https://myportfolio.dev"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{language === 'tr' ? 'Değişiklikleri Kaydet' : 'Save Changes'}</span>
            </button>
          </form>
        )}

        {/* Integrations Section */}
        {activeSection === 'integrations' && (
          <IntegrationsSettings language={language} />
        )}

        {/* Notifications & Sound Section */}
        {activeSection === 'notifications' && (
          <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-400" />
                <span>{language === 'tr' ? 'Bildirimler & Ses Ayarları' : 'Notifications & Sound Settings'}</span>
              </h3>
              {notifPermission === 'granted' && (
                <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'tr' ? 'İzin Verildi' : 'Granted'}</span>
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {language === 'tr'
                ? 'Uygulama arka plandayken veya telefonunuz kilitliyken bile anlık bildirim sesi ve masaüstü/telefon bildirimleri alırsınız.'
                : 'Receive notification chimes and system notifications on your phone and PC when the app is in the background.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              {notifPermission !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleRequestNotif}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-zinc-950 fill-zinc-950" />
                  <span>{language === 'tr' ? 'Sistem Bildirimlerine İzin Ver' : 'Enable System Notifications'}</span>
                </button>
              ) : (
                <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{language === 'tr' ? 'Sistem ve Sesli Bildirimler Etkin' : 'System and Sound Notifications Enabled'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appearance, Themes & Gradient Generator Section */}
        {activeSection === 'appearance' && (
          <div className="space-y-6">
            {/* Header / Intro Card */}
            <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-3xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-900/40">
                      <Palette className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {language === 'tr' ? 'Özel Temalar & CSS Renk Geçişleri' : 'Custom Themes & CSS Gradients'}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {language === 'tr'
                      ? 'Tema renklerini özelleştirin, CSS gradyanları oluşturun ve profilinizi renklendirin. Profilinizi ziyaret eden diğer kullanıcılar sizin seçtiğiniz temayı görecektir!'
                      : 'Customize theme colors, build CSS gradients, and style your profile. Other developers viewing your profile will see your chosen theme!'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isSpark ? (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <Sparkles className="w-4 h-4 fill-amber-400" />
                      <span>{language === 'tr' ? 'Spark Ayrıcalığı Aktif' : 'Spark Perks Active'}</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{language === 'tr' ? 'Standart Üye' : 'Standard Member'}</span>
                    </span>
                  )}
                </div>
              </div>

              {themeSaveSuccess && (
                <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-400 font-mono text-xs flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {language === 'tr'
                      ? 'Temanız başarıyla kaydedildi ve profilinize uygulandı! Diğer kullanıcılar profilinizi bu temayla görecektir.'
                      : 'Theme successfully saved and applied! Visitors will now see your profile in this style.'}
                  </span>
                </div>
              )}

              {/* Preset Themes */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
                    {language === 'tr' ? 'Hazır Temalar' : 'Preset Themes'}
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {language === 'tr' ? 'Seçmek için tıklayın' : 'Click to select'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PRESET_THEMES.map((preset) => {
                    const isSelected = currentTheme.name === preset.name;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetTheme(preset)}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                          isSelected
                            ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-950/20'
                            : 'border-zinc-800/80 bg-zinc-950 hover:border-zinc-700'
                        }`}
                      >
                        {/* Theme preview ribbon */}
                        <div
                          className="h-10 w-full rounded-xl mb-3 border border-white/10 shadow-inner flex items-center justify-center text-xs font-bold"
                          style={{
                            background: preset.isGradient ? preset.gradientCss : preset.main,
                            color: preset.text
                          }}
                        >
                          <span
                            className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono shadow-sm"
                            style={{ background: preset.buttons, color: '#ffffff' }}
                          >
                            Button
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                              {preset.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono">
                              {preset.isGradient ? 'Gradient / Renk Geçişli' : 'Solid / Düz'}
                            </p>
                          </div>

                          {preset.isSparkExclusive && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border border-amber-500/30">
                              <Sparkles className="w-2.5 h-2.5 fill-amber-400" />
                              <span>Spark</span>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Core Theme Colors (HTML Color Codes - Everyone can edit) */}
            <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <span>{language === 'tr' ? 'Tema Renkleri & Yazı Tipi' : 'Theme Colors & Font'}</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    {language === 'tr'
                      ? 'Herkes bu renkleri istediği gibi değiştirebilir (#HTML kodları).'
                      : 'Everyone can edit these colors as desired (#HTML color codes).'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Main Background Color */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-zinc-300">
                      main: # <span className="text-zinc-500 font-normal">({language === 'tr' ? 'Ana Arka Plan' : 'Main Background'})</span>
                    </label>
                    <div
                      className="w-5 h-5 rounded-full border border-zinc-700 shadow-sm"
                      style={{ backgroundColor: currentTheme.main }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.main.startsWith('#') ? currentTheme.main : '#09090b'}
                      onChange={(e) => handleThemeColorField('main', e.target.value)}
                      className="w-9 h-9 rounded-xl border border-zinc-700 bg-transparent cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={currentTheme.main}
                      onChange={(e) => handleThemeColorField('main', e.target.value)}
                      placeholder="#09090b"
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 2. Text Color */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-zinc-300">
                      text: # <span className="text-zinc-500 font-normal">({language === 'tr' ? 'Yazı Rengi' : 'Text Color'})</span>
                    </label>
                    <div
                      className="w-5 h-5 rounded-full border border-zinc-700 shadow-sm"
                      style={{ backgroundColor: currentTheme.text }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.text.startsWith('#') ? currentTheme.text : '#f8fafc'}
                      onChange={(e) => handleThemeColorField('text', e.target.value)}
                      className="w-9 h-9 rounded-xl border border-zinc-700 bg-transparent cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={currentTheme.text}
                      onChange={(e) => handleThemeColorField('text', e.target.value)}
                      placeholder="#f8fafc"
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 3. Buttons Color */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-zinc-300">
                      buttons: # <span className="text-zinc-500 font-normal">({language === 'tr' ? 'Buton & Vurgu' : 'Button & Accent'})</span>
                    </label>
                    <div
                      className="w-5 h-5 rounded-full border border-zinc-700 shadow-sm"
                      style={{ backgroundColor: currentTheme.buttons }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.buttons.startsWith('#') ? currentTheme.buttons : '#6366f1'}
                      onChange={(e) => handleThemeColorField('buttons', e.target.value)}
                      className="w-9 h-9 rounded-xl border border-zinc-700 bg-transparent cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={currentTheme.buttons}
                      onChange={(e) => handleThemeColorField('buttons', e.target.value)}
                      placeholder="#6366f1"
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 4. Profile Card Color */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-zinc-300">
                      profile: # <span className="text-zinc-500 font-normal">({language === 'tr' ? 'Profil Kartı' : 'Profile Card'})</span>
                    </label>
                    <div
                      className="w-5 h-5 rounded-full border border-zinc-700 shadow-sm"
                      style={{ backgroundColor: currentTheme.profile }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.profile.startsWith('#') ? currentTheme.profile : '#121118'}
                      onChange={(e) => handleThemeColorField('profile', e.target.value)}
                      className="w-9 h-9 rounded-xl border border-zinc-700 bg-transparent cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={currentTheme.profile}
                      onChange={(e) => handleThemeColorField('profile', e.target.value)}
                      placeholder="#121118"
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 5. Font Link */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <label className="text-xs font-mono font-bold text-zinc-300">
                    font: &lt;fontlinki&gt; <span className="text-zinc-500 font-normal">({language === 'tr' ? 'Google Fonts Linki veya Boş Bırakın' : 'Google Fonts Link or Leave Empty for Site Font'})</span>
                  </label>
                  <input
                    type="text"
                    value={currentTheme.font}
                    onChange={(e) => handleThemeColorField('font', e.target.value)}
                    placeholder="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-zinc-500">
                    {language === 'tr'
                      ? 'Boş bırakırsanız sitenin kendi yazı tipi kullanılır.'
                      : 'If left empty, the platform default typography will be used.'}
                  </p>
                </div>
              </div>
            </div>

            {/* CSS Gradient (Renk Geçişi) Oluşturucu Modülü */}
            <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-3xl p-6 space-y-4">
              <CssGradientGenerator
                stops={currentTheme.stops || [
                  { id: '1', color: '#3b0764', position: 0 },
                  { id: '2', color: '#1e1b4b', position: 50 },
                  { id: '3', color: '#09090b', position: 100 }
                ]}
                gradientAngle={currentTheme.gradientAngle ?? 135}
                gradientType={currentTheme.gradientType ?? 'linear'}
                radialShape={currentTheme.radialShape ?? 'circle'}
                isSpark={isSpark}
                language={language}
                onChange={handleGradientChange}
              />
            </div>

            {/* .c4e Theme File Upload & Export (Spark Supporter Exclusive) */}
            <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">
                      {language === 'tr' ? 'Tema Dosyası (.c4e) İşlemleri' : 'Theme File (.c4e) Actions'}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-mono font-bold">
                      SPARK ÖZEL
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {language === 'tr'
                      ? 'Spark Destekçileri [temaadı].c4e dosyasını sisteme yükleyebilir ve mevcut temalarını dışa aktarabilir.'
                      : 'Spark Supporters can upload [themename].c4e files and export their custom themes.'}
                  </p>
                </div>
              </div>

              {/* Format explanation box */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2 font-mono text-xs">
                <div className="text-zinc-400 text-[11px] font-bold">
                  {language === 'tr' ? '.c4e Dosya Yapısı Şablonu:' : '.c4e File Structure Template:'}
                </div>
                <div className="p-3 rounded-xl bg-black/60 border border-zinc-800 text-purple-300 select-all whitespace-pre text-[11px] leading-relaxed">
{`text: ${currentTheme.text}
main: ${currentTheme.main}
buttons: ${currentTheme.buttons}
profile: ${currentTheme.profile}
font: ${currentTheme.font || '<fontlinki>'}`}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <input
                  type="file"
                  ref={themeFileInputRef}
                  accept=".c4e,.txt"
                  onChange={handleC4EFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (!isSpark) {
                      alert(language === 'tr' ? 'Tema dosyası yükleme Spark Destekçilerine özeldir. Lütfen Spark Destekçisi olun!' : 'Uploading .c4e themes is exclusive to Spark Supporters.');
                      return;
                    }
                    themeFileInputRef.current?.click();
                  }}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isSpark
                      ? 'bg-amber-600 hover:bg-amber-500 text-zinc-950 border-amber-500 shadow-lg shadow-amber-600/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>{language === 'tr' ? 'Tema Dosyası Yükle (.c4e)' : 'Upload Theme File (.c4e)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadC4EThemeFile(currentTheme)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>{language === 'tr' ? 'Mevcut Temayı .c4e Olarak İndir' : 'Download Current as .c4e'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Save Bar */}
            <div className="p-4 rounded-3xl bg-zinc-950 border border-purple-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 shadow-2xl backdrop-blur-xl ring-1 ring-purple-500/20">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                  style={{ background: currentTheme.isGradient ? currentTheme.gradientCss : currentTheme.main }}
                />
                <div>
                  <span className="text-xs font-bold text-white block">
                    {currentTheme.name || 'Özel Tema'}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono block">
                    {language === 'tr' ? 'Profiliniz ve uygulamanız için geçerli tema' : 'Theme applied to your profile and app'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveTheme}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 active:scale-95 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{language === 'tr' ? 'Değişiklikleri Kaydet & Profilime Uygula' : 'Save & Apply to Profile'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Privacy & Group Invites Section */}
        {activeSection === 'privacy' && (
          <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800/60 pb-3">
              <Users className="w-4 h-4 text-purple-400" />
              <span>{language === 'tr' ? 'Grup Davetleri & Gizlilik' : 'Group Invites & Privacy'}</span>
            </h3>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {language === 'tr'
                ? 'Diğer geliştiricilerin sizi gruplara eklemesini veya davet göndermesini buradan kontrol edebilirsiniz.'
                : 'Control whether other developers can invite or add you to chat groups.'}
            </p>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">
                  {language === 'tr' ? 'Grup Davetlerine İzin Ver' : 'Allow Group Invites'}
                </p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  {formData.allow_group_invites !== false
                    ? language === 'tr'
                      ? 'Herkes grup daveti gönderebilir'
                      : 'Anyone can invite you'
                    : language === 'tr'
                    ? 'Hiç kimse gruba ekleyemez (Korumalı)'
                    : 'No one can invite you (Protected)'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const newVal = formData.allow_group_invites === false ? true : false;
                  const updated = { ...formData, allow_group_invites: newVal };
                  setFormData(updated);
                  onUpdateProfile(updated);
                }}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  formData.allow_group_invites !== false ? 'bg-purple-600' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    formData.allow_group_invites !== false ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Liked Posts Visibility Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">
                  {language === 'tr' ? 'Beğenilen Paylaşımların Görünürlüğü' : 'Liked Posts Visibility'}
                </p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  {formData.show_liked_posts !== false
                    ? language === 'tr'
                      ? 'Açık: Profilinizde beğendiğiniz gönderiler herkese görünür'
                      : 'Public: Your liked posts are visible on your profile'
                    : language === 'tr'
                    ? 'Kapalı: Beğendiğiniz gönderiler sizden başkasına gizlidir'
                    : 'Private: Only you can see your liked posts'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const newVal = formData.show_liked_posts === false ? true : false;
                  const updated = { ...formData, show_liked_posts: newVal };
                  setFormData(updated);
                  onUpdateProfile(updated);
                }}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  formData.show_liked_posts !== false ? 'bg-emerald-600' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    formData.show_liked_posts !== false ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Language & Preferences Section */}
        {activeSection === 'preferences' && (
          <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800/60 pb-3">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>{language === 'tr' ? 'Dil Tercihi' : 'Language Preference'}</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onChangeLanguage('tr')}
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  language === 'tr'
                    ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <span>Türkçe (TR)</span>
                {language === 'tr' && <Check className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => onChangeLanguage('en')}
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <span>English (US)</span>
                {language === 'en' && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
