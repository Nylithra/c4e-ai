import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import {
  Github,
  Shield,
  Sparkles,
  Code2,
  GitFork,
  MessageSquare,
  Zap,
  KeyRound,
  Database,
  CheckCircle2,
  AlertCircle,
  Settings,
  X
} from 'lucide-react';
import {
  signInWithGitHubSupabase,
  getActiveSupabaseCredentials,
  saveCustomSupabaseCredentials,
  isValidSupabaseConfig
} from '../services/supabaseClient';

interface AuthScreenProps {
  language: 'tr' | 'en';
  onChangeLanguage?: (lang: 'tr' | 'en') => void;
  isClosedBetaActive?: boolean;
}

export const AuthScreen: FC<AuthScreenProps> = ({
  language,
  onChangeLanguage,
  isClosedBetaActive = false
}) => {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [betaCodeInput, setBetaCodeInput] = useState('');

  // Supabase Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const currentConfig = getActiveSupabaseCredentials();
  const [configUrl, setConfigUrl] = useState(currentConfig.url);
  const [configKey, setConfigKey] = useState(currentConfig.anonKey);
  const [configSuccess, setConfigSuccess] = useState(false);

  // GitHub OAuth Action
  const handleGitHubOAuth = async () => {
    // If closed beta is active, verify code first
    if (isClosedBetaActive) {
      const cleanCode = betaCodeInput.trim().toUpperCase();
      const validCodes = ['BETA2026', 'C4E-BETA', 'NYLITHRA', 'DEV2026', 'CODE4EVER', 'ADMIN'];
      if (!cleanCode || !validCodes.includes(cleanCode)) {
        setAuthError(
          language === 'tr'
            ? 'Kapalı beta aktif. Giriş yapabilmek için lütfen geçerli bir davet kodu giriniz (ör: BETA2026).'
            : 'Closed beta is active. Please enter a valid beta invite code (e.g. BETA2026).'
        );
        return;
      }
    }

    setLoading(true);
    setAuthError(null);
    try {
      await signInWithGitHubSupabase();
    } catch (err: any) {
      console.warn('Supabase GitHub OAuth error:', err);
      setAuthError(
        err?.message ||
          (language === 'tr'
            ? 'GitHub ile yetkilendirme sırasında bir hata oluştu.'
            : 'An error occurred during GitHub authorization.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Save Custom Supabase Credentials
  const handleSaveCredentials = (e: FormEvent) => {
    e.preventDefault();
    if (configUrl && configKey && !isValidSupabaseConfig(configUrl, configKey)) {
      setAuthError(
        language === 'tr'
          ? 'Geçersiz Supabase URL veya Anon Key formatı.'
          : 'Invalid Supabase URL or Anon Key format.'
      );
      return;
    }
    const success = saveCustomSupabaseCredentials(configUrl, configKey);
    if (success) {
      setConfigSuccess(true);
      setTimeout(() => {
        setConfigSuccess(false);
        setShowConfigModal(false);
        window.location.reload();
      }, 800);
    }
  };

  const isConfigured = Boolean(currentConfig.url && currentConfig.anonKey);

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none relative font-sans">
      {/* Top Bar: Connection Badge & Language */}
      <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 flex items-center justify-between z-20">
        <button
          onClick={() => setShowConfigModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono transition-colors text-zinc-400 hover:text-white cursor-pointer"
        >
          <Database className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden sm:inline">Supabase:</span>
          {isConfigured ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {language === 'tr' ? 'Bağlı' : 'Connected'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-zinc-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              {language === 'tr' ? 'Demo Modu' : 'Demo Mode'}
            </span>
          )}
          <Settings className="w-3 h-3 text-zinc-500 ml-1" />
        </button>

        {onChangeLanguage && (
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => onChangeLanguage('tr')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                language === 'tr' ? 'bg-zinc-100 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              TR
            </button>
            <button
              onClick={() => onChangeLanguage('en')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                language === 'en' ? 'bg-zinc-100 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10 my-auto pt-10 pb-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>{language === 'tr' ? 'Geliştirici Ekosistemi' : 'Developer Ecosystem'}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Code4Ever</h1>

          <p className="text-xs sm:text-sm text-zinc-400 font-medium max-w-sm mx-auto leading-relaxed">
            {language === 'tr'
              ? 'Yazılımcılar için sosyal akış, kod paylaşımı ve geliştirici toplulukları'
              : 'Social feed, code sharing, and communities for developers'}
          </p>
        </div>

        {/* Feature badges (Compact Solid) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-[#121215] border border-zinc-800 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-900 text-blue-400 border border-zinc-800">
              <Code2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white leading-tight">
                {language === 'tr' ? 'Kod Paylaşımı' : 'Code Snippets'}
              </h4>
              <p className="text-[10px] text-zinc-500 font-mono">
                {language === 'tr' ? 'Gist & Depolar' : 'Gist & Repos'}
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#121215] border border-zinc-800 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-900 text-emerald-400 border border-zinc-800">
              <GitFork className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white leading-tight">
                {language === 'tr' ? 'Bağlantı' : 'Network'}
              </h4>
              <p className="text-[10px] text-zinc-500 font-mono">
                {language === 'tr' ? 'Geliştiriciler' : 'Dev Network'}
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#121215] border border-zinc-800 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-900 text-purple-400 border border-zinc-800">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white leading-tight">
                {language === 'tr' ? 'Topluluklar' : 'Communities'}
              </h4>
              <p className="text-[10px] text-zinc-500 font-mono">
                {language === 'tr' ? 'Özel Kanallar' : 'Hubs'}
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#121215] border border-zinc-800 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-900 text-amber-400 border border-zinc-800">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white leading-tight">
                {language === 'tr' ? 'Canlı Akış' : 'Live Feed'}
              </h4>
              <p className="text-[10px] text-zinc-500 font-mono">
                {language === 'tr' ? 'Gerçek Zamanlı' : 'Realtime'}
              </p>
            </div>
          </div>
        </div>

        {/* Main Card: ONLY GitHub Login */}
        <div className="bg-[#121215] border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          {/* Error Message */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="leading-relaxed font-medium">{authError}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {authSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Closed Beta Code field if active */}
          {isClosedBetaActive && (
            <div className="space-y-2 pb-2">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-mono">
                <KeyRound className="w-3.5 h-3.5" />
                <span>{language === 'tr' ? 'Kapalı Beta Davet Kodu' : 'Beta Invite Code'}</span>
              </label>
              <input
                type="text"
                value={betaCodeInput}
                onChange={(e) => setBetaCodeInput(e.target.value)}
                placeholder="BETA2026"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-white uppercase placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
              />
              <p className="text-[11px] text-zinc-500">
                {language === 'tr'
                  ? 'Giriş yapabilmek için davet kodu gereklidir (ör: BETA2026).'
                  : 'Invite code is required to sign in (e.g. BETA2026).'}
              </p>
            </div>
          )}

          {/* Dedicated GitHub Login Button */}
          <button
            onClick={handleGitHubOAuth}
            disabled={loading}
            className="w-full py-4 px-4 rounded-2xl bg-white hover:bg-zinc-200 text-black font-extrabold text-sm flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            <Github className="w-5 h-5 text-black" />
            <span>
              {loading
                ? (language === 'tr' ? 'GitHub Yönlendiriliyor...' : 'Redirecting to GitHub...')
                : (language === 'tr' ? 'GitHub ile Giriş Yap' : 'Sign in with GitHub')}
            </span>
          </button>

          {/* Security & Sync Info */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-bold">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'tr' ? 'Güvenli GitHub Yetkilendirmesi' : 'Secure GitHub OAuth'}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {language === 'tr'
                ? 'GitHub hesabınız ile tek tıkla giriş yapın. Profil resminiz, kullanıcı adınız ve kamuya açık depolarınız hesabınıza aktarılır.'
                : 'Sign in with a single click via GitHub. Your profile picture, username, and public repositories are automatically linked.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-zinc-500 font-mono">
            Lanux Software Systems &copy; 2026 &bull; Code4Ever Platform
          </p>
        </div>
      </div>

      {/* Supabase Connection Setup Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {language === 'tr' ? 'Supabase Bağlantı Ayarları' : 'Supabase Connection Setup'}
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {language === 'tr'
                ? 'Code4Ever veritabanı ve Supabase kimlik doğrulama ayarlarınızı buradan yapılandırabilir veya test edebilirsiniz.'
                : 'Configure or test your Code4Ever database and Supabase credentials here.'}
            </p>

            <form onSubmit={handleSaveCredentials} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 font-mono">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={configUrl}
                  onChange={(e) => setConfigUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 font-mono">
                  Supabase Anon Key (Public)
                </label>
                <input
                  type="password"
                  value={configKey}
                  onChange={(e) => setConfigKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {configSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{language === 'tr' ? 'Ayarlar kaydedildi! Yenileniyor...' : 'Settings saved! Reloading...'}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  {language === 'tr' ? 'İptal' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow cursor-pointer"
                >
                  {language === 'tr' ? 'Kaydet ve Bağlan' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
