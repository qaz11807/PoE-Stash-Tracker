import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setLeagues = useAuthStore((state) => state.setLeagues);

  useEffect(() => {
    // Listen for OAuth success
    const cleanupSuccess = window.poe.onOAuthSuccess(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      setLoading(false);
      setAuthenticated(true);

      // Fetch leagues after successful authentication
      window.poe.getLeagues()
        .then((leagues) => {
          setLeagues(leagues);
        })
        .catch((err) => {
          console.error('Failed to fetch leagues:', err);
        });
    });

    // Listen for OAuth errors
    const cleanupError = window.poe.onOAuthError((message) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      setLoading(false);
      setError(message);
    });

    return () => {
      cleanupSuccess();
      cleanupError();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [setAuthenticated, setLeagues, timeoutId]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    // Set a 5-minute timeout
    const timeout = setTimeout(() => {
      setLoading(false);
      setError('認證超時 (5分鐘)，請重試');
      setTimeoutId(null);
    }, 5 * 60 * 1000);
    setTimeoutId(timeout);

    try {
      await window.poe.authenticate();
    } catch (err) {
      clearTimeout(timeout);
      setTimeoutId(null);
      setLoading(false);
      setError(err instanceof Error ? err.message : '認證失敗');
    }
  };

  const handleCancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setLoading(false);
    setError('已取消認證');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-slate-800 bg-slate-900 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-500">PoE Stash Tracker</h1>
          <p className="mt-2 text-sm text-slate-400">連結您的 Path of Exile 帳號以開始使用</p>
        </div>

        {error && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full rounded bg-amber-500 px-4 py-3 font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '連接中...' : '連接 Path of Exile'}
          </button>

          {loading && (
            <button
              onClick={handleCancel}
              className="w-full rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              取消
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          此應用程式使用 OAuth 2.0 PKCE 進行安全認證
        </p>
      </div>
    </div>
  );
}
