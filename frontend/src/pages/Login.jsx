import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, X, KeyRound, CheckCircle2, ArrowLeft, ShieldCheck, PlayCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';

/* ─────────────────────────────────────────────────
   Forgot Password Modal (3-step OTP flow)
   ───────────────────────────────────────────────── */
const ForgotPasswordModal = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1); // 1=email, 2=otp+password, 3=success
    const [fpEmail, setFpEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [fpError, setFpError] = useState('');
    const [fpLoading, setFpLoading] = useState(false);

    const resetModal = () => {
        setStep(1);
        setFpEmail('');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setShowNewPassword(false);
        setFpError('');
        setFpLoading(false);
    };

    const handleClose = () => {
        resetModal();
        onClose();
    };

    // Step 1: Request OTP
    const handleSendOtp = async (e) => {
        e.preventDefault();
        setFpError('');
        setFpLoading(true);
        try {
            await axios.post(`${API_URL}/auth/forgot-password`, { email: fpEmail });
            setStep(2);
        } catch (err) {
            setFpError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
        } finally {
            setFpLoading(false);
        }
    };

    // Step 2: Verify OTP & Reset
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setFpError('');

        if (newPassword !== confirmPassword) {
            setFpError('Passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
            setFpError('Password must be at least 6 characters.');
            return;
        }

        setFpLoading(true);
        try {
            await axios.post(`${API_URL}/auth/reset-password`, {
                email: fpEmail,
                otp,
                newPassword,
            });
            setStep(3);
        } catch (err) {
            setFpError(err.response?.data?.message || 'Failed to reset password. Please try again.');
        } finally {
            setFpLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-brand-900/20 border border-white/60 w-full max-w-md p-0 animate-scaleIn overflow-hidden">
                {/* Gradient header strip */}
                <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 via-indigo-500 to-blue-500" />

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all z-10"
                >
                    <X size={18} />
                </button>

                <div className="px-8 py-8">
                    {/* ── Step 1: Email ── */}
                    {step === 1 && (
                        <form onSubmit={handleSendOtp} className="animate-fadeIn">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                                    <KeyRound className="text-brand-600" size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">Reset Password</h3>
                            </div>
                            <p className="text-sm text-slate-500 mb-6">
                                Enter your email address and we'll send you a 6-digit code to reset your password.
                            </p>

                            {fpError && (
                                <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 text-sm font-bold text-center shadow-sm mb-4">
                                    {fpError}
                                </div>
                            )}

                            <div className="mb-5">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                                <div className="relative rounded-xl shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-bold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-medium"
                                        placeholder="you@example.com"
                                        value={fpEmail}
                                        onChange={(e) => setFpEmail(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={fpLoading}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-glow text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed items-center gap-2"
                            >
                                {fpLoading ? <Loader2 className="animate-spin" size={18} /> : 'Send Reset Code'}
                                {!fpLoading && <ArrowRight size={18} />}
                            </button>
                        </form>
                    )}

                    {/* ── Step 2: OTP + New Password ── */}
                    {step === 2 && (
                        <form onSubmit={handleResetPassword} className="animate-fadeIn">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <ShieldCheck className="text-indigo-600" size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">Verify & Reset</h3>
                            </div>
                            <p className="text-sm text-slate-500 mb-1">
                                We sent a 6-digit code to <span className="font-bold text-slate-700">{fpEmail}</span>
                            </p>
                            <button
                                type="button"
                                onClick={() => { setStep(1); setFpError(''); }}
                                className="text-xs font-bold text-brand-600 hover:text-brand-500 mb-5 flex items-center gap-1"
                            >
                                <ArrowLeft size={12} /> Change email
                            </button>

                            {fpError && (
                                <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 text-sm font-bold text-center shadow-sm mb-4">
                                    {fpError}
                                </div>
                            )}

                            {/* OTP Input */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Verification Code</label>
                                <div className="relative rounded-xl shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <ShieldCheck className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        pattern="[0-9]{6}"
                                        inputMode="numeric"
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-bold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-medium tracking-[0.3em]"
                                        placeholder="000000"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* New Password */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">New Password</label>
                                <div className="relative rounded-xl shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        required
                                        minLength={6}
                                        className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-bold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-medium"
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="mb-5">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Confirm Password</label>
                                <div className="relative rounded-xl shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        required
                                        minLength={6}
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-bold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-medium"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={fpLoading}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-glow text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed items-center gap-2"
                            >
                                {fpLoading ? <Loader2 className="animate-spin" size={18} /> : 'Reset Password'}
                                {!fpLoading && <ArrowRight size={18} />}
                            </button>
                        </form>
                    )}

                    {/* ── Step 3: Success ── */}
                    {step === 3 && (
                        <div className="text-center animate-fadeIn py-4">
                            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="text-green-500" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Password Reset!</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Your password has been updated successfully. You can now sign in with your new password.
                            </p>
                            <button
                                onClick={handleClose}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-glow text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all active:scale-[0.98] items-center gap-2"
                            >
                                Back to Login
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Inline animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95) translateY(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
                .animate-scaleIn { animation: scaleIn 0.25s ease-out; }
            `}</style>
        </div>
    );
};

/* ─────────────────────────────────────────────────
   Login Page (existing — only added modal trigger)
   ───────────────────────────────────────────────── */
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    const { login, demoLogin } = useAuth();
    const navigate = useNavigate();
    const [isDemoLoading, setIsDemoLoading] = useState(false);

    const handleDemo = async () => {
        setError('');
        setIsDemoLoading(true);
        try {
            if (await demoLogin()) navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Could not start the demo. Please try again.');
        } finally {
            setIsDemoLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            const success = await login(email, password);
            if (success) {
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to login. Please check your credentials.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        /* UI ENHANCEMENT — dark mode support for login page */
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
            <div className="absolute inset-0 bg-brand-50 dark:bg-slate-900 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 dark:opacity-10 z-0 pointer-events-none"></div>

            {/* UI ENHANCEMENT — dark mode blob colors */}
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-brand-300 dark:bg-brand-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-20 animate-blob"></div>
            <div className="absolute top-40 -right-20 w-72 h-72 bg-blue-300 dark:bg-blue-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-32 left-40 w-72 h-72 bg-indigo-300 dark:bg-indigo-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-20 animate-blob animation-delay-4000"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
                {/* UI ENHANCEMENT — dark mode brand text */}
                <h2 className="text-4xl font-black text-brand-600 dark:text-brand-400 tracking-tight mb-2">AI<span className="text-slate-900 dark:text-white">Ready</span></h2>
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">Welcome back to your workspace</h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                {/* UI ENHANCEMENT — dark mode form card */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl py-8 px-4 shadow-2xl shadow-brand-900/10 dark:shadow-black/30 sm:rounded-2xl sm:px-10 border border-white/50 dark:border-slate-700/50">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 text-sm font-bold text-center shadow-sm">
                                {error}
                            </div>
                        )}
                        <div>
                            {/* UI ENHANCEMENT — dark mode labels */}
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                {/* UI ENHANCEMENT — dark mode input */}
                                <input
                                    type="email"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-bold text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-medium"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="block w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-bold text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-medium"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* UI ENHANCEMENT — dark mode remember me and forgot password */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded accent-brand-600" />
                                <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-600 dark:text-slate-400">Remember me</label>
                            </div>
                            <div className="text-sm">
                                <button type="button" onClick={() => setShowForgotModal(true)} className="font-bold text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors">Forgot password?</button>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-glow text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Sign in to workspace'}
                                {!isSubmitting && <ArrowRight size={18} />}
                            </button>
                        </div>
                    </form>

                    <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>or<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
                    </div>
                    <button
                        type="button"
                        onClick={handleDemo}
                        disabled={isDemoLoading || isSubmitting}
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold border-2 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 bg-brand-50/60 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-all active:scale-[0.98] disabled:opacity-70"
                    >
                        {isDemoLoading ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
                        {isDemoLoading ? 'Preparing demo… (first load can take up to a minute)' : 'Try the demo - no sign-up'}
                    </button>

                    {/* UI ENHANCEMENT — dark mode sign-up link */}
                    <div className="mt-6 text-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Don't have an account? </span>
                        <Link to="/register" className="font-bold text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors">Create one for free</Link>
                    </div>
                </div>
            </div>

            {/* Forgot Password Modal */}
            <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
        </div>
    );
};

export default Login;
