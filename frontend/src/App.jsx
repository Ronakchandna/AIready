import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ResumeProvider } from './context/ResumeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LayoutDashboard, FileText, CheckSquare, MessageSquare, Activity, PenTool, LogOut, Sun, Moon, TrendingUp, Menu, X, User, Sparkles } from 'lucide-react';
import PageTransition from './components/PageTransition';


import ResumeBuilder from './pages/ResumeBuilder';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import MockInterview from './pages/MockInterview';
import Dashboard from './pages/Dashboard';
import CoverLetter from './pages/CoverLetter';
import CareerCoach from './pages/CareerCoach';
import JobTracker from './pages/JobTracker';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import PublicProfile from './pages/PublicProfile';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">Loading...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return children;
};


const Brand = ({ size }) => (
    <Link to="/" className="flex items-center gap-2.5">
        <img src={`${process.env.PUBLIC_URL}/logo.svg`} alt="" className="w-8 h-8 rounded-lg shadow-sm" />
        <h2 className={`${size} font-black text-brand-600 dark:text-brand-400 tracking-tight`}>AI<span className="text-slate-900 dark:text-white">Ready</span></h2>
    </Link>
);

const SidebarItem = ({ to, icon: Icon, label }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
        <Link
            to={to}
            className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${isActive ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 shadow-sm' : 'text-slate-600 hover:bg-brand-50/70 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
        >
            {/* UI ENHANCEMENT — active indicator bar */}
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-200 ${isActive ? 'h-6 bg-brand-600 dark:bg-brand-400' : 'h-0 bg-transparent'}`} />
            <Icon size={20} className={`transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
            <span>{label}</span>
        </Link>
    );
};

const Sidebar = () => {
    const { logout, user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    return (
        <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200/80 dark:border-slate-800 h-screen hidden md:flex flex-col">
            <div className="p-6">
                <Brand size="text-2xl" />
            </div>
            <nav className="flex-1 px-4 space-y-2 mt-4">
                <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
                <SidebarItem to="/builder" icon={FileText} label="Resume Builder" />
                <SidebarItem to="/analyzer" icon={Activity} label="Resume Analyzer" />
                <SidebarItem to="/cover-letter" icon={PenTool} label="Cover Letter" />
                <SidebarItem to="/interview" icon={MessageSquare} label="Mock Interview" />
                <SidebarItem to="/coach" icon={Sparkles} label="AI Career Coach" />
                <SidebarItem to="/leaderboard" icon={TrendingUp} label="Leaderboard" />
                <SidebarItem to="/jobs" icon={CheckSquare} label="Job Tracker" />
            </nav>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-brand-400 rounded-lg transition-colors cursor-pointer" title="Toggle Theme">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <Link to="/profile" className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors group cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm overflow-hidden border border-brand-200 dark:border-brand-800">
                        {user?.profilePhoto ? (
                            <img src={user.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            user?.name?.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[80px] group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{user?.name}</div>
                </Link>
                <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer" title="Sign Out">
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
};

/* ─── Mobile Top Header (visible only below md) ─── */
const MobileTopBar = () => {
    const { user } = useAuth();
    return (
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40">
            <Brand size="text-xl" />
            <Link to="/profile" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm overflow-hidden border border-brand-200 dark:border-brand-800">
                    {user?.profilePhoto ? (
                        <img src={user.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        user?.name?.charAt(0).toUpperCase()
                    )}
                </div>
            </Link>
        </div>
    );
};

/* ─── Mobile Bottom Navigation (visible only below md) ─── */
const MobileBottomNav = () => {
    const location = useLocation();
    const [showMore, setShowMore] = useState(false);
    const { logout } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const primaryTabs = [
        { to: '/', icon: LayoutDashboard, label: 'Home' },
        { to: '/builder', icon: FileText, label: 'Builder' },
        { to: '/analyzer', icon: Activity, label: 'Analyze' },
        { to: '/interview', icon: MessageSquare, label: 'Interview' },
    ];

    const moreTabs = [
        { to: '/coach', icon: Sparkles, label: 'AI Career Coach' },
        { to: '/cover-letter', icon: PenTool, label: 'Cover Letter' },
        { to: '/leaderboard', icon: TrendingUp, label: 'Leaderboard' },
        { to: '/jobs', icon: CheckSquare, label: 'Job Tracker' },
        { to: '/profile', icon: User, label: 'Profile' },
    ];

    return (
        <>
            {/* More Menu Sheet */}
            <AnimatePresence>
                {showMore && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden"
                            onClick={() => setShowMore(false)}
                        />
                        {/* Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-slate-950 rounded-t-3xl shadow-2xl border-t border-slate-100 dark:border-slate-800 safe-bottom"
                        >
                            {/* Handle bar */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                            </div>

                            <div className="px-4 pt-2 pb-2 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">More</h3>
                                <button onClick={() => setShowMore(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            <nav className="px-4 pb-3 space-y-1">
                                {moreTabs.map(({ to, icon: Icon, label }) => {
                                    const isActive = location.pathname === to;
                                    return (
                                        <Link
                                            key={to}
                                            to={to}
                                            onClick={() => setShowMore(false)}
                                            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors font-medium ${isActive
                                                ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
                                                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            <Icon size={20} />
                                            <span>{label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <button
                                    onClick={() => { toggleTheme(); setShowMore(false); }}
                                    className="flex items-center gap-2 px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                                >
                                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                                </button>
                                <button
                                    onClick={() => { logout(); setShowMore(false); }}
                                    className="flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium"
                                >
                                    <LogOut size={18} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bottom Tab Bar */}
            {/* UI ENHANCEMENT — bottom nav with press animation and improved indicator */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 safe-bottom">
                <div className="flex items-center justify-around px-2 py-1">
                    {primaryTabs.map(({ to, icon: Icon, label }) => {
                        const isActive = location.pathname === to;
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px] active:scale-90 ${isActive
                                    ? 'text-brand-600 dark:text-brand-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                    }`}
                            >
                                <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-brand-50 dark:bg-brand-900/30 shadow-sm' : ''}`}>
                                    <Icon size={20} />
                                </div>
                                <span className="text-[10px] font-bold leading-none">{label}</span>
                            </Link>
                        );
                    })}

                    {/* UI ENHANCEMENT — More button with matching press animation */}
                    <button
                        onClick={() => setShowMore(true)}
                        className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px] active:scale-90 ${showMore
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-slate-400 dark:text-slate-500'
                            }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all duration-200 ${showMore ? 'bg-brand-50 dark:bg-brand-900/30 shadow-sm' : ''}`}>
                            <Menu size={20} />
                        </div>
                        <span className="text-[10px] font-bold leading-none">More</span>
                    </button>
                </div>
            </nav>
        </>
    );
};

const InternalLayout = ({ children }) => (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 font-sans transition-colors duration-200">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
            <MobileTopBar />
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
                {children}
            </main>
            <MobileBottomNav />
        </div>
    </div>
);

const AnimatedRoutes = () => {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/u/:id" element={<PublicProfile />} />

                {/* Protected Routes */}
                <Route path="/*" element={
                    <ProtectedRoute>
                        <InternalLayout>
                            <AnimatePresence mode="wait">
                                <Routes location={location} key={location.pathname}>
                                    <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
                                    <Route path="/builder" element={<PageTransition><ResumeBuilder /></PageTransition>} />
                                    <Route path="/analyzer" element={<PageTransition><ResumeAnalyzer /></PageTransition>} />
                                    <Route path="/cover-letter" element={<PageTransition><CoverLetter /></PageTransition>} />
                                    <Route path="/coach" element={<PageTransition><CareerCoach /></PageTransition>} />
                                    <Route path="/interview" element={<PageTransition><MockInterview /></PageTransition>} />
                                    <Route path="/leaderboard" element={<PageTransition><Leaderboard /></PageTransition>} />
                                    <Route path="/jobs" element={<PageTransition><JobTracker /></PageTransition>} />
                                    <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
                                </Routes>
                            </AnimatePresence>
                        </InternalLayout>
                    </ProtectedRoute>
                } />
            </Routes>
        </AnimatePresence>
    );
};

const AppContent = () => {
    const { user } = useAuth();
    return (
        <ResumeProvider key={user?._id || 'guest'}>
            <Router>
                <AnimatedRoutes />
            </Router>
        </ResumeProvider>
    );
};

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
