import { useState, useEffect } from "react";
import { ScrapeSource } from "@/api/entities";
import { scrapeListings } from "@/api/backendFunctions";

const PRESET_SOURCES = [
  { name: "Cars24 Jaipur", url: "https://www.cars24.com/buy-used-cars-jaipur/" },
  { name: "CarDekho Jaipur", url: "https://www.cardekho.com/used-cars+in+jaipur" },
  { name: "OLX Autos Jaipur", url: "https://www.olx.in/jaipur_g4058424/q-used-cars" },
  { name: "Spinny Jaipur", url: "https://www.spinny.com/used-cars/jaipur/" },
  { name: "Droom Jaipur", url: "https://droom.in/used-cars/jaipur" },
  { name: "CarWale Jaipur", url: "https://www.carwale.com/used/cars-in-jaipur/" },
];

export default function SourcesPage({ onSyncDone }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapingId, setScrapingId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadSources(); }, []);

  const loadSources = () => {
    setLoading(true);
    ScrapeSource.list().then(data => {
      setSources(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const addSource = async (name, url) => {
    if (!name.trim() || !url.trim()) return;
    setAdding(true);
    await ScrapeSource.create({ name: name.trim(), url: url.trim(), is_active: true });
    setNewName(""); setNewUrl("");
    setAdding(false);
    loadSources();
  };

  const addPreset = async (preset) => {
    const exists = sources.find(s => s.url === preset.url);
    if (exists) { setMsg({ type: "warn", text: `${preset.name} already added.` }); return; }
    await ScrapeSource.create({ name: preset.name, url: preset.url, is_active: true });
    loadSources();
  };

  const toggleSource = async (source) => {
    await ScrapeSource.update(source.id, { is_active: !source.is_active });
    setSources(prev => prev.map(s => s.id === source.id ? { ...s, is_active: !s.is_active } : s));
  };

  const deleteSource = async (id) => {
    await ScrapeSource.delete(id);
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const scrapeOne = async (source) => {
    setScrapingId(source.id);
    setMsg(null);
    const res = await scrapeListings({ action: "scrape", sourceIds: [source.id] });
    setMsg({ type: "success", text: res.data?.message || "Done" });
    setScrapingId(null);
    loadSources();
    onSyncDone && onSyncDone();
  };

  const scrapeAll = async () => {
    setScraping(true);
    setMsg(null);
    const res = await scrapeListings({ action: "scrape" });
    setMsg({ type: "success", text: res.data?.message || "Done" });
    setScraping(false);
    loadSources();
    onSyncDone && onSyncDone();
  };

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">🌐 Scrape Sources</h2>
          <p className="text-xs text-gray-400 mt-0.5">Add competitor websites and scrape live car listings into your database</p>
        </div>
        {sources.filter(s => s.is_active).length > 0 && (
          <button onClick={scrapeAll} disabled={scraping}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow">
            {scraping ? "⏳ Scraping all..." : `🔄 Scrape All (${sources.filter(s => s.is_active).length})`}
          </button>
        )}
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msg.type === "success" ? "bg-green-100 text-green-700 border border-green-300" : "bg-yellow-100 text-yellow-700 border border-yellow-300"}`}>
          {msg.type === "success" ? "✅" : "⚠️"} {msg.text}
        </div>
      )}

      {/* Add new source */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-700 text-sm">➕ Add a Custom Source</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Source name (e.g. OLX Autos)" className={inp} />
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Website URL (e.g. https://...)" className={`${inp} sm:col-span-1`} />
          <button onClick={() => addSource(newName, newUrl)} disabled={adding || !newName || !newUrl}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all">
            {adding ? "Adding..." : "Add Source"}
          </button>
        </div>

        {/* Presets */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Or add a preset:</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_SOURCES.map(p => (
              <button key={p.url} onClick={() => addPreset(p)}
                className="text-xs bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 px-3 py-1.5 rounded-full font-medium transition-colors">
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Source list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : sources.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400 border border-gray-100">
          <div className="text-4xl mb-3">🌐</div>
          <p className="font-medium">No sources added yet</p>
          <p className="text-sm mt-1">Add websites above or click a preset to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => (
            <div key={source.id} className={`bg-white rounded-2xl shadow-sm border p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all ${source.is_active ? "border-gray-100" : "border-dashed border-gray-200 opacity-60"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 text-sm">{source.name}</span>
                  {source.is_active ? (
                    <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Active</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">Paused</span>
                  )}
                </div>
                <a href={source.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline truncate block mt-0.5">{source.url}</a>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  {source.last_scraped && <span>Last scraped: {new Date(source.last_scraped).toLocaleString("en-IN")}</span>}
                  {source.listings_count > 0 && <span>• {source.listings_count} listings fetched</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => scrapeOne(source)} disabled={scrapingId === source.id || !source.is_active}
                  className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold px-3 py-1.5 rounded-lg transition-all">
                  {scrapingId === source.id ? "⏳ Scraping..." : "🔄 Scrape"}
                </button>
                <button onClick={() => toggleSource(source)}
                  className="text-xs border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium px-3 py-1.5 rounded-lg transition-all">
                  {source.is_active ? "Pause" : "Resume"}
                </button>
                <button onClick={() => deleteSource(source.id)}
                  className="text-xs border border-red-200 hover:bg-red-50 text-red-500 font-medium px-3 py-1.5 rounded-lg transition-all">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}