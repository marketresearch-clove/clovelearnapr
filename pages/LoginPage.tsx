import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RoleSelector from '../components/RoleSelector';
import { supabase } from '../lib/supabaseClient';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, userRole, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotView, setIsForgotView] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  useEffect(() => {
    if (user && userRole) {
      if (userRole === 'student') {
        navigate('/dashboard');
      } else if (userRole === 'instructor' || userRole === 'admin') {
        if (!showRoleSelector) {
          setShowRoleSelector(true);
        }
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, userRole, navigate, showRoleSelector]);

  const handleRoleSelection = (selectedRole: 'student' | 'admin') => {
    setShowRoleSelector(false);
    if (selectedRole === 'student') {
      navigate('/dashboard');
    } else {
      navigate('/admin');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';

      if (errorMessage.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('Please confirm your email address before logging in. Check your inbox for the confirmation email.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for the password reset link.');
        setIsForgotView(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <RoleSelector isOpen={showRoleSelector} onSelect={handleRoleSelection} />
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
              <span className="material-symbols-rounded text-on-primary text-2xl">landscape</span>
            </div>
            <h2 className="text-2xl font-bold font-heading text-slate-900">
              {isForgotView ? 'Reset Password' : 'Welcome Back'}
            </h2>
            <p className="text-slate-500 mt-2">
              {isForgotView
                ? 'Enter your email to receive a reset link'
                : 'Enter your credentials to access your account'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{message}</p>
            </div>
          )}

          {isForgotView ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-on-primary py-3 rounded font-semibold shadow-lg shadow-primary/30 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
                <span className="material-symbols-rounded text-lg">send</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsForgotView(false);
                  setError('');
                  setMessage('');
                }}
                className="w-full text-slate-500 text-sm hover:text-slate-700 transition-colors"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    <span className="material-symbols-rounded text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotView(true);
                      setError('');
                      setMessage('');
                    }}
                    className="text-sm text-primary hover:opacity-80 font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-on-primary py-3 rounded font-semibold shadow-lg shadow-primary/30 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Sign In'}
                <span className="material-symbols-rounded text-lg">login</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default LoginPage;