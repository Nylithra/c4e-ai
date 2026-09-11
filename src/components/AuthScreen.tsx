import { useState } from 'react';
import type { FC } from 'react';
import {
  Github,
  Shield,
  Sparkles,
  Code2,
  GitFork,
  MessageSquare,
  Zap,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { signInWithGitHubSupabase } from '../services/supabaseClient';

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

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none relative font-sans">
      {/* Top Bar: Language Switcher Only */}
      {onChangeLanguage && (
        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex items-center z-20">
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
        </div>
      )}

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
    </div>
  );
};
