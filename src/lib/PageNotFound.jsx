export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-7xl font-light text-slate-300">404</h1>
        <h2 className="text-2xl font-medium text-slate-800">Page Not Found</h2>
        <p className="text-slate-600 leading-relaxed">
          The page you are looking for does not exist.
        </p>
        <div className="pt-2">
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}