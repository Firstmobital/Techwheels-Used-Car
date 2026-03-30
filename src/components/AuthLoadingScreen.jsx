export default function AuthLoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600 shadow-sm">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-orange-500"
          aria-hidden="true"
        />
        Checking session...
      </div>
    </div>
  );
}