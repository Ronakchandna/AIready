import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * Catches a crash in one page so the rest of the app (sidebar, navigation) keeps working.
 * Give it a `key` that changes on navigation (the path) so it resets when the user moves on.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Page crashed:', error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-6 font-sans">
                <div className="max-w-md text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-soft p-8">
                    <AlertTriangle className="mx-auto text-amber-500 mb-3" size={40} />
                    <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">Something went wrong on this page</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Your saved data is safe. Try again, or go back to the dashboard.</p>
                    <div className="flex gap-3 justify-center mt-6">
                        <button onClick={() => this.setState({ error: null })}
                            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold flex items-center gap-2">
                            <RotateCcw size={16} /> Try again
                        </button>
                        <a href="/" className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold flex items-center gap-2 hover:border-brand-400">
                            <Home size={16} /> Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
