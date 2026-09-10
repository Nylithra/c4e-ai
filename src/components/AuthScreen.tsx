import React, { useState } from 'react';
import {
  Github,
  Shield,
  Sparkles,
  Code2,
  GitFork,
  MessageSquare,
  Zap,
  User,
  Mail,
  Lock,
  KeyRound,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertCircle,
  Settings,
  X
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  signInWithGitHubSupabase,
  signInWithEmailSupabase,
  signUpWithEmailSupabase,
  signInWithUsernameOrProfile,
  saveStoredProfile,
  DEFAULT_USER,
  getActiveSupabaseCredentials,
  saveCustomSupabaseCredentials,
  isValidSupabaseConfig
} from '../services/supabaseClient';

interface AuthScreenProps {
  language: 'tr' | 'en';
  onChangeLanguage?: (lang: 'tr' | 'en') => void;
  isClosedBetaActive?: boolean;
}

type AuthMode = 'quick_user' | 'github' | 'email_login' | 'email_signup' | 'guest';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  language,
  onChangeLanguage,
  isClosedBetaActive = false
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('quick_user');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Form states
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [betaCodeInput, setBetaCodeInput] = useState('');

  // Supabase Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const currentConfig = getActiveSupabaseCredentials();
  const [configUrl, setConfigUrl] = useState(currentConfig.url);
  const [configKey, setConfigKey] = useState(currentConfig.anonKey);
  const [configSuccess, setConfigSuccess] = useState(false);

  // 1. GitHub OAuth
  const handleGitHubOAuth = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithGitHubSupabase();
    } catch (err: any) {
      console.warn('Supabase GitHub OAuth attempt:', err);
      setAuthError(
        err?.message ||
          (language === 'tr'
            ? 'GitHub ile giriş sırasında bir hata oluştu. Kullanıcı Adı ile hızlı giriş yapabilirsiniz.'
            : 'Error during GitHub login. You can log in using your Username.')
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Direct Username Login
  const handleUsernameLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setAuthError(
        language === 'tr' ? 'Lütfen bir kullanıcı adı girin.' : 'Please enter a username.'
      );
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const profile = await signInWithUsernameOrProfile(cleanUsername);
      setAuthSuccess(
        language === 'tr'
          ? `Giriş başarılı! Hoş geldin @${profile.username}.`
          : `Login successful! Welcome @${profile.username}.`
      );
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (err: any) {
      setAuthError(err?.message || 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Email & Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) {
      setAuthError(
        language === 'tr'
          ? 'Lütfen e-posta ve şifrenizi girin.'
          : 'Please enter your email and password.'
      );
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const profile = await signInWithEmailSupabase(emailInput.trim(), passwordInput);
      setAuthSuccess(
        language === 'tr'
          ? `Giriş yapıldı! Hoş geldin @${profile.username}.`
          : `Logged in! Welcome @${profile.username}.`
      );
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (err: any) {
      setAuthError(err?.message || 'E-posta ile giriş başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Email Sign Up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput || !usernameInput.trim()) {
      setAuthError(
        language === 'tr'
          ? 'Lütfen e-posta, kullanıcı adı ve şifre alanlarını doldurun.'
          : 'Please enter email, username, and password.'
      );
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const profile = await signUpWithEmailSupabase(
        emailInput.trim(),
        passwordInput,
        usernameInput.trim(),
        displayNameInput.trim() || usernameInput.trim()
      );
      setAuthSuccess(
        language === 'tr'
          ? `Hesap oluşturuldu! Hoş geldin @${profile.username}.`
          : `Account created! Welcome @${profile.username}.`
      );
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (err: any) {
      setAuthError(err?.message || 'Kayıt işlemi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Guest or Beta Code Login
  const handleGuestOrBetaLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = betaCodeInput.trim().toUpperCase();

    if (isClosedBetaActive) {
      const validCodes = ['BETA2026', 'C4E-BETA', 'NYLITHRA', 'DEV2026', 'CODE4EVER'];
      if (!cleanCode || (!validCodes.includes(cleanCode) && cleanCode !== 'ADMIN')) {
        setAuthError(
          language === 'tr'
            ? 'Kapalı beta aktif. Giriş yapmak için lütfen geçerli bir davet kodu girin (ör: BETA2026).'
            : 'Closed beta is active. Please enter a valid invite code (e.g. BETA2026).'
        );
        return;
      }
    }

    setLoading(true);
    setAuthError(null);
    setTimeout(() => {
      const demoUser: UserProfile = {
        ...DEFAULT_USER,
        id: `usr_${Date.now()}`,
        username: 'c4e_developer',
        display_name: 'C4E Developer',
        avatar_url:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio:
          language === 'tr'
            ? 'Code4Ever topluluk üyesi ve geliştirici.'
            : 'Code4Ever community member and developer.',
        role: language === 'tr' ? 'Geliştirici' : 'Developer',
        verified: false,
        betaStatus: 'approved',
        custom_fields: {
          github: 'github.com/code4ever',
          location: 'Türkiye'
        }
      };
      saveStoredProfile(demoUser);
      window.location.reload();
    }, 300);
  };

  // Save Custom Supabase Credentials
  const handleSaveCredentials = (e: React.FormEvent) => {
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
      }, 1000);
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
              {language === 'tr' ? 'Yerel Mod' : 'Local Mode'}
            </span>
          )}
          <Settings className="w-3 h-3 text-zinc-500 ml-1" />
        </button>

        {onChangeLanguage && (
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => onChangeLanguage('tr')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                language === 'tr' ? 'bg-zinc-100 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              TR
            </button>
            <button
              onClick={() => onChangeLanguage('en')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                language === 'en' ? 'bg-zinc-100 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-lg space-y-6 relative z-10 my-auto pt-10 pb-6">
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
                {language === 'tr' ? 'Gist & Depo Entegrasyonu' : 'Gist & Repo Sync'}
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
                {language === 'tr' ? 'Geliştiricilerle Tanış' : 'Connect with Devs'}
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
                {language === 'tr' ? 'Özel İlgi Kanalları' : 'Specialized Hubs'}
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
                {language === 'tr' ? 'Gerçek Zamanlı Paylaşım' : 'Realtime Pulse'}
              </p>
            </div>
          </div>
        </div>

        {/* Main Solid Auth Card */}
        <div className="bg-[#121215] border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          {/* Auth Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-950 border border-zinc-800/80 rounded-2xl">
            <button
              onClick={() => {
                setAuthMode('quick_user');
                setAuthError(null);
              }}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'quick_user'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="truncate">{language === 'tr' ? 'Kullanıcı Adı' : 'Username'}</span>
            </button>

            <button
              onClick={() => {
                setAuthMode('github');
                setAuthError(null);
              }}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'github'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </button>

            <button
              onClick={() => {
                setAuthMode(authMode === 'email_signup' ? 'email_signup' : 'email_login');
                setAuthError(null);
              }}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'email_login' || authMode === 'email_signup'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>E-posta</span>
            </button>
          </div>

          {/* Feedback Messages */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="leading-relaxed font-medium">{authError}</p>
                {authMode === 'github' && (
                  <button
                    onClick={() => {
                      setAuthMode('quick_user');
                      setAuthError(null);
                    }}
                    className="mt-2 text-xs font-bold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{language === 'tr' ? 'Kullanıcı adı ile devam et →' : 'Continue with username →'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {authSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* TAB 1: QUICK USERNAME LOGIN */}
          {authMode === 'quick_user' && (
            <form onSubmit={handleUsernameLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                  <span>{language === 'tr' ? 'Kullanıcı Adı veya Takma Ad' : 'Username or Handle'}</span>
                  <span className="text-[11px] text-zinc-500 font-normal">
                    {language === 'tr' ? 'örn: nylithra, ahmet_dev' : 'e.g. nylithra, john_doe'}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">
                    @
                  </span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="kullanici_adi"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-8 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Profile Shortcuts */}
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-400">
                <span className="text-zinc-500">{language === 'tr' ? 'Hızlı Seçim:' : 'Quick Select:'}</span>
                <button
                  type="button"
                  onClick={() => setUsernameInput('nylithra')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-blue-400 font-mono font-bold cursor-pointer transition-colors"
                >
                  @nylithra (Admin)
                </button>
                <button
                  type="button"
                  onClick={() => setUsernameInput('c4e_developer')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono cursor-pointer transition-colors"
                >
                  @c4e_developer
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <span>
                  {loading
                    ? (language === 'tr' ? 'Giriş Yapılıyor...' : 'Signing in...')
                    : (language === 'tr' ? 'Kullanıcı Adı ile Giriş Yap' : 'Sign in with Username')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 2: GITHUB OAUTH */}
          {authMode === 'github' && (
            <div className="space-y-4">
              <button
                onClick={handleGitHubOAuth}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Github className="w-4 h-4" />
                <span>
                  {loading
                    ? (language === 'tr' ? 'GitHub Yönlendiriliyor...' : 'Redirecting to GitHub...')
                    : (language === 'tr' ? 'GitHub ile Yetkilendir ve Giriş Yap' : 'Authorize with GitHub')}
                </span>
              </button>

              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-bold">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'tr' ? 'Otomatik Profil Senkronizasyonu' : 'Automatic Profile Sync'}</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {language === 'tr'
                    ? 'Giriş yaptığınızda GitHub profil resminiz, biyografiniz ve kamuya açık depolarınız hesabınıza eklenir.'
                    : 'Your avatar, bio, and public repositories are automatically linked upon authentication.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: EMAIL & PASSWORD */}
          {(authMode === 'email_login' || authMode === 'email_signup') && (
            <div className="space-y-4">
              {/* Sub-mode toggle */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-zinc-300">
                  {authMode === 'email_login'
                    ? (language === 'tr' ? 'E-posta ile Giriş Yap' : 'Sign in with Email')
                    : (language === 'tr' ? 'Yeni Hesap Oluştur' : 'Create New Account')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'email_login' ? 'email_signup' : 'email_login');
                    setAuthError(null);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                >
                  {authMode === 'email_login'
                    ? (language === 'tr' ? 'Hesabın yok mu? Kayıt Ol' : "No account? Sign up")
                    : (language === 'tr' ? 'Zaten hesabın var mı? Giriş Yap' : 'Have an account? Log in')}
                </button>
              </div>

              <form
                onSubmit={authMode === 'email_login' ? handleEmailLogin : handleEmailSignUp}
                className="space-y-3"
              >
                {authMode === 'email_signup' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-400 font-mono">
                        {language === 'tr' ? 'Kullanıcı Adı *' : 'Username *'}
                      </label>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="ahmet_dev"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-400 font-mono">
                        {language === 'tr' ? 'Görünen İsim' : 'Display Name'}
                      </label>
                      <input
                        type="text"
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        placeholder="Ahmet Yılmaz"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 font-mono">
                    {language === 'tr' ? 'E-posta Adresi *' : 'Email Address *'}
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="ornek@alanadi.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 font-mono">
                    {language === 'tr' ? 'Şifre *' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {loading
                      ? (language === 'tr' ? 'İşleniyor...' : 'Processing...')
                      : authMode === 'email_login'
                      ? (language === 'tr' ? 'E-posta ile Giriş Yap' : 'Log in with Email')
                      : (language === 'tr' ? 'Hesap Oluştur ve Giriş Yap' : 'Create Account & Log in')}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* Guest / Beta Access Footer Button */}
          <div className="pt-3 border-t border-zinc-800/70">
            {isClosedBetaActive ? (
              <form onSubmit={handleGuestOrBetaLogin} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-amber-400 font-mono">
                  <span className="flex items-center gap-1.5 font-bold">
                    <KeyRound className="w-3.5 h-3.5" />
                    {language === 'tr' ? 'Kapalı Beta Davet Kodu:' : 'Closed Beta Code:'}
                  </span>
                  <span className="text-[10px] text-zinc-500">ör: BETA2026</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={betaCodeInput}
                    onChange={(e) => setBetaCodeInput(e.target.value)}
                    placeholder="BETA2026"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white uppercase placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 font-extrabold text-xs transition-all cursor-pointer"
                  >
                    {language === 'tr' ? 'Katıl' : 'Join'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => handleGuestOrBetaLogin()}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>{language === 'tr' ? 'Misafir Hesabı ile Devam Et' : 'Continue as Guest'}</span>
              </button>
            )}
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
                ? 'Code4Ever veritabanı ve kimlik doğrulama ayarlarınızı buradan yapılandırabilir veya test edebilirsiniz.'
                : 'Configure or test your Code4Ever database and authentication credentials here.'}
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
