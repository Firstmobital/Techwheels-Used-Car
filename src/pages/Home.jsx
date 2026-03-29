import { useState, useEffect } from "react";
import { CarEvaluation, CarListing, ScrapeLog, ConditionCheck } from "../api/entities";
import { scrapeListings } from "../api/backendFunctions";
import { supabase } from "../api/supabaseClient";
import { calculateFairValue, getMarketStats, getDecision } from "../utils/calculate";
import ConditionManager from "../components/ConditionManager";
import SourcesPage from "../components/SourcesPage";
import ExShowroomPriceManager from "../components/ExShowroomPriceManager";
import DepreciationManager from "../components/DepreciationManager";

const MAKES = ["Maruti", "Hyundai", "Tata", "Honda", "Kia", "Toyota", "Renault", "Nissan", "MG", "Skoda", "Volkswagen", "Ford", "Chevrolet", "Mahindra", "Other"];
const MODELS_BY_MAKE = {
  Maruti: ["Swift", "Alto", "Baleno", "Dzire", "Vitara Brezza", "Ertiga", "WagonR", "Celerio", "Ignis", "S-Cross", "XL6"],
  Hyundai: ["i20", "Creta", "Verna", "Grand i10", "Venue", "Tucson", "Santro", "Aura", "Alcazar", "i10"],
  Tata: ["Nexon", "Altroz", "Harrier", "Safari", "Tiago", "Tigor", "Punch", "Indica"],
  Honda: ["City", "Amaze", "Jazz", "WR-V", "BR-V", "Civic", "CR-V"],
  Kia: ["Seltos", "Sonet", "Carnival", "Carens"],
  Toyota: ["Innova", "Fortuner", "Glanza", "Urban Cruiser", "Camry", "Corolla"],
  Renault: ["Kwid", "Triber", "Duster", "Kiger"],
  Nissan: ["Magnite", "Kicks", "Micra", "Terrano"],
  MG: ["Hector", "Astor", "ZS EV", "Gloster"],
  Skoda: ["Rapid", "Kushaq", "Slavia", "Octavia", "Superb"],
  Volkswagen: ["Polo", "Vento", "Taigun", "Virtus", "Tiguan"],
  Ford: ["Figo", "Aspire", "EcoSport", "Endeavour", "Freestyle"],
  Chevrolet: ["Beat", "Cruze", "Spark", "Enjoy"],
  Mahindra: ["XUV300", "XUV500", "XUV700", "Scorpio", "Bolero", "Thar", "KUV100"],
  Other: [],
};
const COLORS = ["White", "Silver", "Grey", "Black", "Red", "Blue", "Brown", "Beige", "Orange", "Other"];
const YEARS = Array.from({ length: 22 }, (_, i) => new Date().getFullYear() - i);

function formatINR(amount) {
  if (!amount && amount !== 0) return "—";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function Badge({ label, color }) {
  const map = {
    green: "bg-green-100 text-green-800 border border-green-300",
    yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    red: "bg-red-100 text-red-800 border border-red-300",
    blue: "bg-blue-100 text-blue-800 border border-blue-300",
    gray: "bg-gray-200 text-gray-700 border border-gray-300",
    orange: "bg-orange-100 text-orange-800 border border-orange-300",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[color] || map.gray}`}>{label}</span>;
}

const decisionMeta = {
  "Good Deal": { color: "green", icon: "🎯", bg: "bg-green-500" },
  "Fair Deal": { color: "yellow", icon: "👍", bg: "bg-yellow-500" },
  "Overpriced": { color: "red", icon: "⚠️", bg: "bg-red-500" },
  "Pending": { color: "gray", icon: "⏳", bg: "bg-gray-500" },
};

const SEL = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent";

export default function Home() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [stats, setStats] = useState({ total: 0, goodDeals: 0, overpriced: 0, listings: 0 });
  const [recentEvals, setRecentEvals] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState(null);

  useEffect(() => {
    Promise.all([CarEvaluation.list(), CarListing.list(), ScrapeLog.list()])
      .then(([evals, listings, logs]) => {
        setStats({
          total: evals.length,
          goodDeals: evals.filter(e => e.decision === "Good Deal").length,
          overpriced: evals.filter(e => e.decision === "Overpriced").length,
          listings: listings.length,
        });
        setRecentEvals(evals.sort((a, b) => new Date(b.eval_date || b.created_date) - new Date(a.eval_date || a.created_date)).slice(0, 5));
        if (logs.length > 0) {
          const sorted = logs.sort((a, b) => new Date(b.scrape_date) - new Date(a.scrape_date));
          setLastSync(sorted[0]);
        }
      }).catch(() => {});
  }, [activeNav]);

  const handleScrape = async () => {
    setScraping(true); setScrapeMsg(null);
    try {
      const res = await scrapeListings({ action: "scrape" });
      setScrapeMsg(res);
      setLastSync({ scrape_date: new Date().toISOString(), listings_saved: res.saved_to_db, status: res.saved_to_db > 0 ? "Success" : "Partial" });
    } catch (e) { setScrapeMsg({ error: e.message }); }
    setScraping(false);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "evaluate", label: "Evaluate Car", icon: "🔍" },
    { id: "history", label: "History", icon: "📋" },
    { id: "market", label: "Market Listings", icon: "🏪" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center text-2xl">🚗</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Techwheels Used Car Evaluation</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastSync && <span className="text-orange-100 text-xs hidden sm:block">Last sync: {new Date(lastSync.scrape_date).toLocaleDateString("en-IN")}</span>}
            <button onClick={handleScrape} disabled={scraping}
              className="flex items-center gap-2 bg-white text-orange-600 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-orange-50 disabled:opacity-60 transition-all shadow">
              {scraping ? "⏳ Syncing..." : "🔄 Sync Market"}
            </button>
          </div>
        </div>
      </header>

      {scrapeMsg && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-xl text-sm font-medium border ${scrapeMsg.error ? "bg-red-100 text-red-700 border-red-300" : scrapeMsg.saved_to_db > 0 ? "bg-green-100 text-green-700 border-green-300" : "bg-yellow-100 text-yellow-700 border-yellow-300"}`}>
          {scrapeMsg.error ? `❌ ${scrapeMsg.error}` : scrapeMsg.saved_to_db > 0 ? `✅ ${scrapeMsg.message}` : `⚠️ ${scrapeMsg.message}`}
        </div>
      )}

      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setActiveNav(n.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeNav === n.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {activeNav === "dashboard" && <DashboardPage stats={stats} recentEvals={recentEvals} lastSync={lastSync} onNavigate={setActiveNav} />}
        {activeNav === "evaluate" && <EvaluatePage />}
        {activeNav === "history" && <HistoryPage />}
        {activeNav === "market" && <MarketPage />}
        {activeNav === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardPage({ stats, recentEvals, lastSync, onNavigate }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Evaluations", value: stats.total, icon: "🔍", card: "border-l-4 border-l-blue-500 bg-white", icon_cls: "bg-blue-100 text-blue-600" },
          { label: "Good Deals Found", value: stats.goodDeals, icon: "🎯", card: "border-l-4 border-l-green-500 bg-white", icon_cls: "bg-green-100 text-green-600" },
          { label: "Overpriced Cars", value: stats.overpriced, icon: "⚠️", card: "border-l-4 border-l-red-500 bg-white", icon_cls: "bg-red-100 text-red-600" },
          { label: "Market Listings", value: stats.listings, icon: "🏪", card: "border-l-4 border-l-orange-500 bg-white", icon_cls: "bg-orange-100 text-orange-600" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-5 shadow-sm ${s.card}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${s.icon_cls}`}>{s.icon}</span>
              <span className="text-3xl font-black text-gray-800">{s.value}</span>
            </div>
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
        <h2 className="font-bold text-gray-800 mb-3">🏪 Market Data Status</h2>
        {lastSync ? (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className={`w-3 h-3 rounded-full ${lastSync.status === "Success" ? "bg-green-500" : "bg-yellow-500"}`}></div>
            <span className="text-gray-600">Last synced: <strong>{new Date(lastSync.scrape_date).toLocaleString("en-IN")}</strong></span>
            <span className="text-gray-600">{lastSync.listings_saved} listings saved</span>
            <Badge label={lastSync.status} color={lastSync.status === "Success" ? "green" : "yellow"} />
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No market data yet. Click <strong>Sync Market</strong> to fetch live listings from Cars24 & CarDekho.</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Evaluate a Car", desc: "Check fair value & best purchase price", icon: "🔍", nav: "evaluate" },
          { label: "View History", desc: "All past car evaluations", icon: "📋", nav: "history" },
          { label: "Browse Market", desc: "See competitor listings in Jaipur", icon: "🏪", nav: "market" },
        ].map(a => (
          <button key={a.nav} onClick={() => onNavigate(a.nav)}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group">
            <div className="text-3xl mb-3">{a.icon}</div>
            <p className="font-bold text-gray-800 group-hover:text-orange-600 transition-colors">{a.label}</p>
            <p className="text-xs text-gray-400 mt-1">{a.desc}</p>
          </button>
        ))}
      </div>

      {recentEvals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4">🕐 Recent Evaluations</h2>
          <div className="space-y-3">
            {recentEvals.map(ev => (
              <div key={ev.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{ev.make} {ev.model} {ev.variant} ({ev.year})</p>
                  <p className="text-xs text-gray-400">{ev.fuel_type} • {ev.transmission} • {(ev.km_driven / 1000).toFixed(0)}k km</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600 text-sm">{formatINR(ev.suggested_purchase_price)}</p>
                  <Badge label={ev.decision || "Pending"} color={decisionMeta[ev.decision]?.color || "gray"} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate("history")} className="mt-3 text-xs text-orange-500 hover:underline">View all →</button>
        </div>
      )}
    </div>
  );
}


// ─── EVALUATE ────────────────────────────────────────────────────────────────
function EvaluatePage() {
  const [form, setForm] = useState({
    make: "Maruti", model: "Swift", variant: "", year: 2020,
    km_driven: 50000, fuel_type: "Petrol", transmission: "Manual",
    colour: "White", num_owners: 1,
    insurance_type: "Comprehensive",
    customer_name: "", car_reg_no: "", customer_mobile: "",
    offered_price: "", seller_asking_price: "", notes: "",
    branch: "", ca_name: "", evaluator_name: "",
  });

  const [manualModel, setManualModel] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [condChecks, setCondChecks] = useState({}); // { condId: boolean }
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fetchingMarket, setFetchingMarket] = useState(false);
  const [fetchingExShowroom, setFetchingExShowroom] = useState(false);
  const [exShowroomData, setExShowroomData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [caNames, setCaNames] = useState([]);
  const [evaluatorNames, setEvaluatorNames] = useState([]);

  useEffect(() => {
    ConditionCheck.filter({ is_active: true }).then(data => {
      setConditions(data);
      const defaults = {};
      data.forEach(c => { defaults[c.id] = !c.is_negative; });
      setCondChecks(defaults);
    });

    // Load branches from locations table
    supabase.from('locations').select('name').then(({ data }) => {
      if (data) setBranches(data.map(r => r.name));
    });

    // Load CAs and evaluators from employees table
    supabase.from('employees').select('first_name, last_name').eq('employee_status', 'active').then(({ data }) => {
      if (data) {
        const names = data.map(e => `${e.first_name} ${e.last_name}`.trim()).filter(Boolean);
        setCaNames(names);
        setEvaluatorNames(names);
      }
    });
  }, []);

  const set = (field, value) => {
    setForm(f => {
      const u = { ...f, [field]: value };
      if (field === "make") { u.model = MODELS_BY_MAKE[value]?.[0] || ""; setManualModel(false); }
      return u;
    });
    setResult(null); setSaved(false);
    if (["make", "model", "variant", "fuel_type", "transmission"].includes(field)) setExShowroomData(null);
  };

  const fetchExShowroomPrice = async () => {
    setFetchingExShowroom(true);
    try {
      const res = await scrapeListings({
        action: "fetchExShowroomPrice",
        params: { make: form.make, model: form.model, variant: form.variant, fuel_type: form.fuel_type, transmission: form.transmission },
      });
      const data = res.data || res;
      if (data.ex_showroom_price) {
        setExShowroomData(data);
      } else {
        setExShowroomData({ error: data.error || "Price not found" });
      }
    } catch (e) { setExShowroomData({ error: e.message }); }
    setFetchingExShowroom(false);
  };

  const evaluate = async () => {
    setLoading(true); setResult(null); setSaved(false);
    try {
      const params = {
        ...form,
        year: Number(form.year),
        km_driven: Number(form.km_driven),
        num_owners: Number(form.num_owners),
        seller_asking_price: form.seller_asking_price ? Number(form.seller_asking_price) : null,
        custom_conditions: conditions.map(c => ({
          id: c.id, name: c.name, is_negative: c.is_negative,
          depreciation_percent: c.depreciation_percent,
          checked: !!condChecks[c.id],
        })),
      };
      const { fairValue, basePrice, age } = await calculateFairValue(supabase, params);
      const suggestedPurchasePrice = Math.round(fairValue / 1.10);
      const marketStats = await getMarketStats(supabase, params.make, params.model, params.year);
      const decision = getDecision(params.seller_asking_price, suggestedPurchasePrice);
      setResult({
        fair_value: fairValue,
        suggested_purchase_price: suggestedPurchasePrice,
        decision,
        breakdown: { base_price_used: basePrice, age_years: age },
        market_stats: marketStats,
      });
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  const [marketSavedMsg, setMarketSavedMsg] = useState(null);

  const fetchMarketInsights = async () => {
    setFetchingMarket(true);
    setMarketSavedMsg(null);
    try {
      const res = await scrapeListings({
        action: "fetchTargetedMarketData",
        params: { make: form.make, model: form.model, year: Number(form.year) },
      });
      const data = res.data || res;
      if (data.market_stats) {
        setResult(prev => prev ? { ...prev, market_stats: data.market_stats } : { market_stats: data.market_stats });
        const count = data.market_stats.count || 0;
        setMarketSavedMsg(`✅ ${count} listings for ${form.year} ${form.make} ${form.model} saved to Market Listings.`);
      }
    } catch (e) { alert("Error fetching market data: " + e.message); }
    setFetchingMarket(false);
  };

  const saveEval = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await CarEvaluation.create({
        eval_date: new Date().toISOString(),
        ...form,
        year: Number(form.year),
        km_driven: Number(form.km_driven),
        num_owners: Number(form.num_owners),
        customer_name: form.customer_name || "",
        car_reg_no: form.car_reg_no || "",
        offered_price: form.offered_price ? Number(form.offered_price) : null,
        seller_asking_price: form.seller_asking_price ? Number(form.seller_asking_price) : null,
        calculated_fair_value: result.fair_value,
        suggested_purchase_price: result.suggested_purchase_price,
        market_avg_price: result.market_stats?.avg || null,
        market_min_price: result.market_stats?.min || null,
        market_max_price: result.market_stats?.max || null,
        decision: result.decision,
      });
      setSaved(true);
    } catch (e) { alert("Save error: " + e.message); }
    setSaving(false);
  };

  const dm = decisionMeta[result?.decision] || {};
  const customerReady = form.customer_mobile.length >= 10 && form.car_reg_no.length >= 9;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ── FORM ── */}
      <div className="lg:col-span-3 space-y-4">

        {/* Showroom Details Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3">🏢 Showroom Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Branch</label>
              <select value={form.branch} onChange={e => set("branch", e.target.value)} className={SEL}>
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">CA Name</label>
              <select value={form.ca_name} onChange={e => set("ca_name", e.target.value)} className={SEL}>
                <option value="">Select CA</option>
                {caNames.map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Evaluator Name</label>
              <select value={form.evaluator_name} onChange={e => set("evaluator_name", e.target.value)} className={SEL}>
                <option value="">Select Evaluator</option>
                {evaluatorNames.map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Customer Information Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3">👤 Customer Information</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Customer Name</label>
              <input value={form.customer_name} onChange={e => set("customer_name", e.target.value)}
                placeholder="e.g. Ramesh Kumar" className={SEL} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Mobile No. <span className="text-red-500">*</span></label>
              <input type="tel" value={form.customer_mobile}
                onChange={e => set("customer_mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number" className={`${SEL} ${!form.customer_mobile || form.customer_mobile.length < 10 ? "border-red-300" : "border-green-400"}`} />
              {form.customer_mobile && form.customer_mobile.length < 10 && <p className="text-xs text-red-400 mt-1">Enter 10-digit number</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Car Reg. No. <span className="text-red-500">*</span></label>
              <input value={form.car_reg_no}
                onChange={e => {
                  let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                  if (val.length > 4) val = val.slice(0, 4) + "-" + val.slice(4);
                  if (val.length > 7) val = val.slice(0, 7) + "-" + val.slice(7);
                  if (val.length > 12) val = val.slice(0, 12);
                  set("car_reg_no", val);
                }}
                placeholder="e.g. RJ14-UB-3469" className={`${SEL} ${!form.car_reg_no ? "border-red-300" : "border-green-400"}`} maxLength={12} />
              {!form.car_reg_no && <p className="text-xs text-red-400 mt-1">Required to evaluate</p>}
            </div>
          </div>
          {!customerReady && (
            <p className="mt-3 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              ⚠️ Fill Mobile No. and Car Reg. No. to unlock car details form
            </p>
          )}
        </div>

        {/* Main Evaluation Form — locked until customer info is filled */}
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6 transition-all ${!customerReady ? "opacity-50 pointer-events-none select-none" : ""}`}>
          <h2 className="text-lg font-bold text-gray-800">🔍 Car Evaluation Form {!customerReady && <span className="text-xs font-normal text-gray-400 ml-2">🔒 Locked</span>}</h2>

        {/* Basic Info */}
        <section>
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3">Basic Information</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Make</label>
              <select value={form.make} onChange={e => set("make", e.target.value)} className={SEL}>
                {MAKES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500">Model</label>
                {MODELS_BY_MAKE[form.make]?.length > 0 && (
                  <button type="button" onClick={() => { setManualModel(m => !m); set("model", ""); }}
                    className="text-xs text-orange-500 hover:underline">
                    {manualModel ? "← Pick from list" : "Type manually"}
                  </button>
                )}
              </div>
              {MODELS_BY_MAKE[form.make]?.length > 0 && !manualModel
                ? <select value={form.model} onChange={e => set("model", e.target.value)} className={SEL}>{MODELS_BY_MAKE[form.make].map(m => <option key={m}>{m}</option>)}</select>
                : <input value={form.model} onChange={e => set("model", e.target.value)} placeholder="Enter model name" className={SEL} />}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Variant</label>
              <input value={form.variant} onChange={e => set("variant", e.target.value)} placeholder="e.g. ZXI, VX, SX" className={SEL} />
              {exShowroomData && !exShowroomData.error && (
                <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-700 font-medium">
                  ✅ Ex-Showroom: <strong>{formatINR(exShowroomData.ex_showroom_price)}</strong>
                  {exShowroomData.price_source && <span className="text-blue-400 ml-1">({exShowroomData.price_source})</span>}
                  <span className="text-blue-400 ml-1">— Saved to Base Prices</span>
                </div>
              )}
              {exShowroomData?.error && (
                <div className="mt-1.5 text-xs text-red-500">❌ {exShowroomData.error}</div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Colour</label>
              <select value={form.colour} onChange={e => set("colour", e.target.value)} className={SEL}>
                {COLORS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Year</label>
              <select value={form.year} onChange={e => set("year", Number(e.target.value))} className={SEL}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">KM Driven</label>
              <input type="number" value={form.km_driven} onChange={e => set("km_driven", e.target.value)} className={SEL} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Fuel Type</label>
              <select value={form.fuel_type} onChange={e => set("fuel_type", e.target.value)} className={SEL}>
                {["Petrol", "Diesel", "CNG", "Electric", "Hybrid"].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Transmission</label>
              <select value={form.transmission} onChange={e => set("transmission", e.target.value)} className={SEL}>
                {["Manual", "Automatic"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">No. of Owners</label>
              <select value={form.num_owners} onChange={e => set("num_owners", Number(e.target.value))} className={SEL}>
                <option value={1}>1 (1st Owner)</option>
                <option value={2}>2 (2nd Owner)</option>
                <option value={3}>3 (3rd Owner)</option>
                <option value={4}>4+ (4th Owner)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Insurance Type</label>
              <select value={form.insurance_type} onChange={e => set("insurance_type", e.target.value)} className={SEL}>
                {["Comprehensive", "Third Party", "Expired"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Condition Checks - fully from DB */}
        <section>
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3">Condition Checks</p>
          {conditions.length === 0 ? (
            <p className="text-xs text-gray-400 bg-orange-50 border border-orange-200 rounded-lg p-3">
              No conditions configured. Go to the <strong>Conditions</strong> tab to add checks and their depreciation %.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {conditions.map(c => {
                const checked = !!condChecks[c.id];
                const isProblem = c.is_negative ? checked : !checked;
                return (
                  <label key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${isProblem ? "bg-red-50 border-red-300" : "bg-green-50 border-green-300"}`}>
                    <input type="checkbox" checked={checked}
                      onChange={e => setCondChecks(prev => ({ ...prev, [c.id]: e.target.checked }))}
                      className="w-4 h-4 accent-orange-500 cursor-pointer" />
                    <span className={`text-sm font-medium flex-1 ${isProblem ? "text-red-700" : "text-green-700"}`}>{c.name}</span>
                    {isProblem && c.depreciation_percent > 0 && (
                      <span className="text-xs text-red-400 font-semibold">-{c.depreciation_percent}%</span>
                    )}
                    <span className="text-base">{isProblem ? "❌" : "✅"}</span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* Seller Details */}
        <section>
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3">Seller Details</p>
          {exShowroomData && !exShowroomData.error && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-500 font-semibold">🏷️ Current Ex-Showroom Price ({form.make} {form.model}{form.variant ? " " + form.variant : ""})</p>
                <p className="text-xs text-blue-400">{exShowroomData.price_source || "Web Search"} • Saved to Base Prices</p>
              </div>
              <p className="text-lg font-black text-blue-700">{formatINR(exShowroomData.ex_showroom_price)}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Seller's Ask Price (₹)</label>
              <input type="number" value={form.seller_asking_price} onChange={e => set("seller_asking_price", e.target.value)}
                placeholder="Seller's asking price" className={SEL} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Our Offered Price (₹)</label>
              <input type="number" value={form.offered_price} onChange={e => set("offered_price", e.target.value)}
                placeholder="Price we offered" className={SEL} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Any extra observations..." rows={2} className={`${SEL} resize-none`} />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <button onClick={fetchExShowroomPrice} disabled={fetchingExShowroom || !form.make || !form.model}
            className="w-full bg-blue-100 hover:bg-blue-200 disabled:opacity-40 text-blue-700 py-2.5 rounded-xl font-semibold text-sm transition-colors border border-blue-300">
            {fetchingExShowroom ? "⏳ Fetching Ex-Price..." : `🌐 Fetch Ex-Showroom Price (${form.fuel_type})`}
          </button>
          <div className="flex gap-3">
            <button onClick={evaluate} disabled={loading || !customerReady}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold text-base transition-colors shadow-md">
              {loading ? "⏳ Calculating..." : "🔍 Evaluate Price"}
            </button>
          </div>
        </div>
        {marketSavedMsg && (
          <div className="bg-green-50 border border-green-300 text-green-700 text-xs font-medium px-4 py-2 rounded-xl">
            {marketSavedMsg}
          </div>
        )}
        </div>{/* end locked wrapper */}
      </div>{/* end left column */}
      {/* ── RESULT ── */}
      <div className="lg:col-span-2 space-y-4">
        {result ? (
          <>
            {/* Decision Banner */}
            <div className={`rounded-2xl p-5 text-white text-center shadow-lg ${
              result.decision === "Good Deal" ? "bg-green-500" :
              result.decision === "Fair Deal" ? "bg-yellow-500" :
              result.decision === "Overpriced" ? "bg-red-500" : "bg-gray-500"
            }`}>
              <div className="text-4xl mb-1">{dm.icon || "⏳"}</div>
              <div className="text-2xl font-black">{result.decision}</div>
              {form.seller_asking_price && (
                <div className="text-sm mt-1 opacity-90">
                  {result.decision === "Good Deal" && "Great — push for a better price!"}
                  {result.decision === "Fair Deal" && "Reasonable — standard negotiation"}
                  {result.decision === "Overpriced" && `Overpaying by ${formatINR(Number(form.seller_asking_price) - result.suggested_purchase_price)}`}
                </div>
              )}
            </div>

            {/* Price Cards */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <h3 className="font-bold text-gray-700 text-sm">💰 Price Analysis</h3>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-semibold">✅ Max Purchase Price</p>
                  <p className="text-xs text-green-500">Your max buy price (10% margin)</p>
                </div>
                <p className="text-xl font-black text-green-700">{formatINR(result.suggested_purchase_price)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-semibold">📊 Calculated Fair Value</p>
                  <p className="text-xs text-blue-500">What buyer will pay</p>
                </div>
                <p className="text-xl font-black text-blue-700">{formatINR(result.fair_value)}</p>
              </div>
              {form.seller_asking_price && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">💬 Seller Asking</p>
                    <p className="text-xs text-gray-400">Their listed price</p>
                  </div>
                  <p className="text-xl font-black text-gray-700">{formatINR(Number(form.seller_asking_price))}</p>
                </div>
              )}
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-700 text-sm mb-3">🔢 Calculation Basis</h3>
              <div className="text-xs space-y-1.5 text-gray-500">
                <div className="flex justify-between"><span>Ex-showroom base price</span><span className="font-medium text-gray-700">{formatINR(result.breakdown?.base_price_used)}</span></div>
                <div className="flex justify-between"><span>Car age</span><span className="font-medium text-gray-700">{result.breakdown?.age_years} years</span></div>
                <div className="flex justify-between"><span>Fuel type</span><span className="font-medium text-gray-700">{form.fuel_type}</span></div>
                <div className="flex justify-between"><span>KM driven</span><span className="font-medium text-gray-700">{Number(form.km_driven).toLocaleString("en-IN")} km</span></div>
                <div className="flex justify-between"><span>Target margin</span><span className="font-medium text-green-600">10%</span></div>
              </div>
            </div>

            {/* Market Comparison */}
            {result.market_stats ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold text-gray-700 text-sm mb-3">🏪 Jaipur Market ({result.market_stats.count} similar)</h3>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 rounded-xl bg-green-50 border border-green-200">
                    <p className="text-xs text-gray-400">Min</p>
                    <p className="font-bold text-green-600 text-sm">{formatINR(result.market_stats.min)}</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-xs text-gray-400">Avg</p>
                    <p className="font-bold text-blue-600 text-sm">{formatINR(result.market_stats.avg)}</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-orange-50 border border-orange-200">
                    <p className="text-xs text-gray-400">Max</p>
                    <p className="font-bold text-orange-600 text-sm">{formatINR(result.market_stats.max)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {result.market_stats.listings.map((l, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-500 py-1 border-b border-gray-50">
                      <span>{l.source} • {l.year} • {(l.km_driven / 1000).toFixed(0)}k km</span>
                      <span className="font-semibold text-gray-700">{formatINR(l.asking_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-4 text-center text-gray-400 border border-gray-200">
                <p className="text-sm">No market data for this model yet.</p>
                <p className="text-xs mt-1">Click "Sync Market" to fetch live listings.</p>
              </div>
            )}

            <button onClick={saveEval} disabled={saving || saved}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${saved ? "bg-green-100 text-green-700 border border-green-300" : "bg-slate-800 hover:bg-slate-700 text-white"}`}>
              {saved ? "✅ Saved to History" : saving ? "Saving..." : "💾 Save This Evaluation"}
            </button>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-semibold text-gray-500">Fill in car details</p>
            <p className="text-sm mt-1">Hit Evaluate to get the max purchase price with 10% margin</p>
          </div>
        )}
      </div>
    </div>
  );
}

const LEAD_STATUSES = ["Pending", "Deal Done", "Cancelled", "No Deal"];
const leadStatusMeta = {
  "Pending":    { color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  "Deal Done":  { color: "bg-green-100 text-green-800 border-green-300" },
  "Cancelled":  { color: "bg-red-100 text-red-800 border-red-300" },
  "No Deal":    { color: "bg-gray-200 text-gray-700 border-gray-300" },
};

// ─── HISTORY ─────────────────────────────────────────────────────────────────
function HistoryPage() {
  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [evaluatorFilter, setEvaluatorFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadEvals = () => {
    CarEvaluation.list()
      .then(data => {
        setEvals(data.sort((a, b) => new Date(b.eval_date || b.created_date) - new Date(a.eval_date || a.created_date)));
        setLoading(false);
      }).catch(() => setLoading(false));
  };

  useEffect(() => { loadEvals(); }, []);

  const updateLeadStatus = async (id, status) => {
    setSavingStatus(true);
    await CarEvaluation.update(id, { lead_status: status });
    setEvals(prev => prev.map(e => e.id === id ? { ...e, lead_status: status } : e));
    if (editModal?.id === id) setEditModal(prev => ({ ...prev, lead_status: status }));
    setSavingStatus(false);
  };

  const openEdit = (ev) => {
    setEditModal(ev);
    setEditMode(false);
    setEditFields({});
  };

  const startEditMode = () => {
    setEditFields({
      customer_name: editModal.customer_name || "",
      customer_mobile: editModal.customer_mobile || "",
      car_reg_no: editModal.car_reg_no || "",
      seller_asking_price: editModal.seller_asking_price || "",
      offered_price: editModal.offered_price || "",
      notes: editModal.notes || "",
      branch: editModal.branch || "",
      ca_name: editModal.ca_name || "",
      evaluator_name: editModal.evaluator_name || "",
    });
    setEditMode(true);
  };

  const saveEditFields = async () => {
    setSavingEdit(true);
    const updated = { ...editFields };
    if (updated.seller_asking_price) updated.seller_asking_price = Number(updated.seller_asking_price);
    if (updated.offered_price) updated.offered_price = Number(updated.offered_price);
    await CarEvaluation.update(editModal.id, updated);
    const newRec = { ...editModal, ...updated };
    setEvals(prev => prev.map(e => e.id === editModal.id ? newRec : e));
    setEditModal(newRec);
    setEditMode(false);
    setSavingEdit(false);
  };

  const evaluatorNames = ["All", ...new Set(evals.map(e => e.evaluator_name).filter(Boolean))];

  const filtered = evals.filter(e =>
    (decisionFilter === "All" || e.decision === decisionFilter) &&
    (statusFilter === "All" || (e.lead_status || "Pending") === statusFilter) &&
    (evaluatorFilter === "All" || e.evaluator_name === evaluatorFilter) &&
    (!search || `${e.make} ${e.model} ${e.variant} ${e.customer_name || ""} ${e.car_reg_no || ""}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 Search car, customer, reg no..."
          className="flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium">Deal:</span>
          {["All", "Good Deal", "Fair Deal", "Overpriced"].map(f => (
            <button key={f} onClick={() => setDecisionFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${decisionFilter === f ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium">Status:</span>
          {["All", ...LEAD_STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s ? "bg-slate-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s}
            </button>
          ))}
        </div>
        {evaluatorNames.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Evaluator:</span>
            <select value={evaluatorFilter} onChange={e => setEvaluatorFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400">
              {evaluatorNames.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-medium">No evaluations found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Car", "Reg No.", "Customer", "Eval Date", "KM", "Seller Price", "Buy At", "Deal", "Lead Status", "Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(ev => {
                  const ls = ev.lead_status || "Pending";
                  return (
                    <tr key={ev.id} className="hover:bg-orange-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{ev.make} {ev.model} {ev.variant && `(${ev.variant})`}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{ev.car_reg_no || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{ev.customer_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(ev.eval_date || ev.created_date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{(ev.km_driven / 1000).toFixed(0)}k</td>
                      <td className="px-4 py-3 text-gray-600">{formatINR(ev.seller_asking_price)}</td>
                      <td className="px-4 py-3 text-green-600 font-bold">{formatINR(ev.suggested_purchase_price)}</td>
                      <td className="px-4 py-3"><Badge label={ev.decision || "Pending"} color={decisionMeta[ev.decision]?.color || "gray"} /></td>
                      <td className="px-4 py-3">
                        <select value={ls} onChange={e => updateLeadStatus(ev.id, e.target.value)}
                          className={`text-xs font-semibold px-2 py-1.5 rounded-lg border cursor-pointer focus:outline-none ${leadStatusMeta[ls]?.color}`}>
                          {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(ev)}
                          className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          ✏️ Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setEditModal(null); setEditMode(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">{editModal.make} {editModal.model} {editModal.variant} ({editModal.year})</h3>
                <p className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                  {editModal.car_reg_no && <span>🔖 {editModal.car_reg_no}</span>}
                  {editModal.customer_name && <span>👤 {editModal.customer_name}</span>}
                  {editModal.customer_mobile && <span>📞 {editModal.customer_mobile}</span>}
                  <span>📅 {new Date(editModal.eval_date || editModal.created_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </p>
              </div>
              <button onClick={() => { setEditModal(null); setEditMode(false); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            {/* Lead Status */}
            <div className="mb-4 bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Lead Status</p>
                <p className="text-xs text-gray-400">Update the current stage of this lead</p>
              </div>
              <select value={editModal.lead_status || "Pending"} onChange={e => updateLeadStatus(editModal.id, e.target.value)}
                disabled={savingStatus}
                className={`text-sm font-bold px-4 py-2 rounded-xl border-2 cursor-pointer focus:outline-none transition-all ${leadStatusMeta[editModal.lead_status || "Pending"]?.color}`}>
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Price Summary */}
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">Seller Price</p>
                <p className="font-bold text-gray-700">{formatINR(editModal.seller_asking_price)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-500">Fair Value</p>
                <p className="font-bold text-blue-700">{formatINR(editModal.calculated_fair_value)}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-green-500">Buy At</p>
                <p className="font-bold text-green-700">{formatINR(editModal.suggested_purchase_price)}</p>
              </div>
            </div>
            {editModal.offered_price && (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3 flex justify-between items-center">
                <p className="text-xs text-orange-600 font-semibold">Our Offered Price</p>
                <p className="font-bold text-orange-700">{formatINR(editModal.offered_price)}</p>
              </div>
            )}

            {/* Car Details */}
            <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2">Car Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {[
                ["Fuel", editModal.fuel_type],
                ["Transmission", editModal.transmission],
                ["KM Driven", `${(editModal.km_driven / 1000).toFixed(0)}k km`],
                ["Owners", `${editModal.num_owners} owner(s)`],
                ["Colour", editModal.colour],
                ["Insurance", editModal.insurance_type],
                ["Service History", editModal.service_history ? "✅ Yes" : "❌ No"],
                ["Accident History", editModal.accident_history ? "⚠️ Yes" : "✅ No"],
                ["RC Clear", editModal.rc_clear ? "✅ Yes" : "❌ No"],
                ["Loan Clear", editModal.loan_clear ? "✅ Yes" : "❌ No"],
                ["Tyre Condition", editModal.tyre_condition || "—"],
                ["AC Working", editModal.ac_working ? "✅ Yes" : "❌ No"],
                ["Electricals", editModal.electricals_working ? "✅ Working" : "❌ Not Working"],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">{k}</p>
                  <p className="font-medium text-gray-700 text-xs mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {/* Showroom Info */}
            {(editModal.branch || editModal.ca_name || editModal.evaluator_name) && (
              <>
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2">Showroom Info</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[["Branch", editModal.branch], ["CA", editModal.ca_name], ["Evaluator", editModal.evaluator_name]].map(([k, v]) => v ? (
                    <div key={k} className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">{k}</p>
                      <p className="font-medium text-gray-700 text-xs mt-0.5">{v}</p>
                    </div>
                  ) : null)}
                </div>
              </>
            )}

            {/* Notes */}
            {editModal.notes && !editMode && (
              <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">📝 {editModal.notes}</p>
            )}

            {/* Edit Mode Fields */}
            {editMode && (
              <div className="border border-orange-200 rounded-xl p-4 mb-4 space-y-3 bg-orange-50">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">✏️ Edit Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Customer Name", "customer_name", "text"],
                    ["Mobile No.", "customer_mobile", "text"],
                    ["Car Reg. No.", "car_reg_no", "text"],
                    ["Branch", "branch", "text"],
                    ["CA Name", "ca_name", "text"],
                    ["Evaluator", "evaluator_name", "text"],
                    ["Seller Asking Price (₹)", "seller_asking_price", "number"],
                    ["Our Offered Price (₹)", "offered_price", "number"],
                  ].map(([label, field, type]) => (
                    <div key={field}>
                      <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
                      <input type={type} value={editFields[field]} onChange={e => setEditFields(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 font-medium block mb-1">Notes</label>
                    <textarea value={editFields.notes} onChange={e => setEditFields(f => ({ ...f, notes: e.target.value }))}
                      rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white resize-none" />
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
              <Badge label={editModal.decision || "Pending"} color={decisionMeta[editModal.decision]?.color || "gray"} />
              <div className="flex gap-2">
                {!editMode ? (
                  <>
                    <button onClick={startEditMode}
                      className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors">
                      ✏️ Edit
                    </button>
                    <button onClick={() => { setEditModal(null); setEditMode(false); }}
                      className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors">
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditMode(false)}
                      className="text-sm border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium px-4 py-2 rounded-lg transition-colors">
                      Cancel
                    </button>
                    <button onClick={saveEditFields} disabled={savingEdit}
                      className="text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg transition-colors">
                      {savingEdit ? "Saving..." : "💾 Save"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function SettingsPage() {
  const [activeTab, setActiveTab] = useState("sources");

  const tabs = [
    { id: "sources", label: "Data Sources", icon: "🌐" },
    { id: "conditions", label: "Conditions", icon: "⚙️" },
    { id: "exshowroom", label: "Base Prices", icon: "🏷️" },
    { id: "depreciation", label: "Depreciation", icon: "📊" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-orange-500 text-orange-600 bg-orange-50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {activeTab === "sources" && <SourcesPage onSyncDone={() => {}} />}
          {activeTab === "conditions" && <ConditionManager />}
          {activeTab === "exshowroom" && <ExShowroomPriceManager />}
          {activeTab === "depreciation" && <DepreciationManager />}
        </div>
      </div>
    </div>
  );
}

// ─── MARKET ──────────────────────────────────────────────────────────────────
function MarketPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [fuelFilter, setFuelFilter] = useState("All");
  const [sortBy, setSortBy] = useState("price_asc");

  useEffect(() => {
    CarListing.list().then(data => { setListings(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const sources = ["All", ...new Set(listings.map(l => l.source).filter(Boolean))];
  const fuels = ["All", ...new Set(listings.map(l => l.fuel_type).filter(Boolean))];

  const filtered = listings
    .filter(l => sourceFilter === "All" || l.source === sourceFilter)
    .filter(l => fuelFilter === "All" || l.fuel_type === fuelFilter)
    .filter(l => !search || `${l.make} ${l.model} ${l.variant}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "price_asc") return (a.asking_price || 0) - (b.asking_price || 0);
      if (sortBy === "price_desc") return (b.asking_price || 0) - (a.asking_price || 0);
      if (sortBy === "year_desc") return (b.year || 0) - (a.year || 0);
      if (sortBy === "km_asc") return (a.km_driven || 0) - (b.km_driven || 0);
      return 0;
    });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 Search make, model..."
          className="flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          {sources.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={fuelFilter} onChange={e => setFuelFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          {fuels.map(f => <option key={f}>{f}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="price_asc">Price: Low→High</option>
          <option value="price_desc">Price: High→Low</option>
          <option value="year_desc">Newest First</option>
          <option value="km_asc">Low KM First</option>
        </select>
        <span className="text-xs text-gray-400">{filtered.length} listings</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading market data...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🏪</div>
          <p className="font-medium">No market listings yet</p>
          <p className="text-sm mt-1">Click "Sync Market" at the top to fetch live listings from Cars24 & CarDekho</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(l => (
            <div key={l.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <Badge
                  label={l.source}
                  color={l.source === "Cars24" ? "orange" : l.source === "CarDekho" ? "blue" : "gray"}
                />
                <span className="text-xs text-gray-400">{l.year}</span>
              </div>
              <h3 className="font-bold text-gray-800">{l.make} {l.model}</h3>
              {l.variant && <p className="text-xs text-gray-500">{l.variant}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {l.fuel_type && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{l.fuel_type}</span>}
                {l.transmission && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{l.transmission}</span>}
                {l.km_driven > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{(l.km_driven / 1000).toFixed(0)}k km</span>}
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-lg font-black text-orange-600">{formatINR(l.asking_price)}</p>
                {l.listing_url && l.listing_url.startsWith("http") && (
                  <a href={l.listing_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">View →</a>
                )}
              </div>
              {l.scraped_date && <p className="text-xs text-gray-300 mt-1">Scraped: {new Date(l.scraped_date).toLocaleDateString("en-IN")}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}