import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

const NotFound = () => (
    <div className="min-h-[70vh] flex items-center justify-center p-6 font-sans">
        <div className="text-center max-w-md">
            <Compass className="mx-auto text-brand-500 mb-4" size={48} />
            <p className="text-6xl font-black text-slate-800 dark:text-slate-100">404</p>
            <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200 mt-2">Page not found</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">The link may be wrong or the page has moved.</p>
            <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold">
                Go to the dashboard
            </Link>
        </div>
    </div>
);

export default NotFound;
