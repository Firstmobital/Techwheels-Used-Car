// @ts-nocheck
import { useState, useEffect } from "react";
import { CarEvaluation, CarListing, ScrapeLog, ConditionCheck } from "../api/entities";
import { scrapeListings } from "../api/backendFunctions";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { calculateFairValue, getMarketStats, getDecision } from "../utils/calculate";
import { COLORS, YEARS, LEAD_STATUSES } from "../utils/carConstants";
import { BrandCombobox, ModelCombobox } from "../components/BrandModelCombobox";
import ConditionManager from "../components/ConditionManager";
import SourcesPage from "../components/SourcesPage";
import ExShowroomPriceManager from "../components/ExShowroomPriceManager";
import DepreciationManager from "../components/DepreciationManager";


// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(amount) {
  if (!amount && amount !== 0) return "—";
  if (amount >= 10000000) return `₹${(amount/10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount/100000).toFixed(2)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

const decisionMeta = {
  "Good Deal":  { bg:"bg-green-50", border:"border-green-200", text:"text-green-800", badge:"bg-green-100 text-green-800", dot:"bg-green-500" },
  "Fair Deal":  { bg:"bg-amber-50",  border:"border-amber-200",  text:"text-amber-800",  badge:"bg-amber-100 text-amber-800",  dot:"bg-amber-500" },
  "Overpriced": { bg:"bg-red-50",   border:"border-red-200",   text:"text-red-800",   badge:"bg-red-100 text-red-800",   dot:"bg-red-500" },
  "Pending":    { bg:"bg-gray-50",  border:"border-gray-200",  text:"text-gray-600",  badge:"bg-gray-100 text-gray-600",  dot:"bg-gray-400" },
};
const leadMeta = {
  "Pending":   "bg-amber-100 text-amber-800",
  "Deal Done": "bg-green-100 text-green-800",
  "Cancelled": "bg-red-100 text-red-800",
  "No Deal":   "bg-gray-100 text-gray-600",
};

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
function Badge({ label, className="" }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}

// Label + field wrapper — taller on mobile
function Field({ label, required = false, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// Input — 44px on mobile, 34px on desktop
const inp = "w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900";
const sel = "w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900";

// ─── Accordion shell ──────────────────────────────────────────────────────────
function AccordionItem({ number, title, summary, state, onToggle, children }) {
  const open = state === "open";
  const done = state === "done";
  return (
    <div className={`border rounded-xl overflow-hidden mb-3 transition-all ${done ? "border-green-200" : open ? "border-orange-200" : "border-gray-100"} bg-white`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 lg:py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${done ? "bg-green-100 text-green-700" : open ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500"}`}>
            {done ? "✓" : number}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{title}</p>
            {summary && <p className="text-xs text-gray-400 mt-0.5">{summary}</p>}
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" },
  { id:"evaluate", label:"Evaluate car", icon:"M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" },
  { id:"history",  label:"History",     icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id:"settings", label:"Settings",    icon:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

function NavIcon({ path }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path}/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const { signOut } = useAuth();
  const [nav, setNav] = useState("dashboard");
  const [stats, setStats] = useState({ total:0, goodDeals:0, overpriced:0, listings:0 });
  const [recentEvals, setRecentEvals] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState(null);

  useEffect(() => {
    Promise.all([CarEvaluation.list(), CarListing.list(), ScrapeLog.list()])
      .then(([evals, listings, logs]) => {
        setStats({
          total: evals.length,
          goodDeals: evals.filter(e=>e.decision==="Good Deal").length,
          overpriced: evals.filter(e=>e.decision==="Overpriced").length,
          listings: listings.length,
        });
        setRecentEvals(
          evals
            .sort(
              (a, b) =>
                new Date(b.eval_date || b.created_date).getTime() -
                new Date(a.eval_date || a.created_date).getTime()
            )
            .slice(0, 5)
        );
        if (logs.length>0) {
          const sorted = logs.sort(
            (a, b) =>
              new Date(b.scrape_date).getTime() - new Date(a.scrape_date).getTime()
          );
          setLastSync(sorted[0]);
        }
      }).catch(()=>{});
  }, [nav]);

  useEffect(() => {
    if (!NAV.some(n => n.id===nav)) {
      setNav("dashboard");
    }
  }, [nav]);

  const handleScrape = async () => {
    setScraping(true); setScrapeMsg(null);
    try {
      const res = await scrapeListings({ action:"scrape" });
      setScrapeMsg(res);
      setLastSync({ scrape_date: new Date().toISOString(), listings_saved: res.saved_to_db, status: res.saved_to_db>0?"Success":"Partial" });
    } catch(e) { setScrapeMsg({ error: e.message }); }
    setScraping(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await signOut();
    } catch (error) {
      setScrapeMsg({ error: error.message || "Unable to logout. Please try again." });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-100 shrink-0 h-screen sticky top-0">
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">TW</div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">Techwheels</p>
              <p className="text-xs text-gray-400">Car Evaluation</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Main</p>
          {NAV.filter(n=>n.id!=="settings").map(n=>(
            <button key={n.id} onClick={()=>setNav(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${nav===n.id ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
              <NavIcon path={n.icon}/>
              {n.label}
            </button>
          ))}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-4 mb-2">Configure</p>
          <button onClick={()=>setNav("settings")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${nav==="settings" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
            <NavIcon path={NAV.find(n=>n.id==="settings")?.icon}/>
            Settings
          </button>
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <button onClick={handleScrape} disabled={scraping}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-orange-200 text-orange-600 text-xs font-medium hover:bg-orange-50 disabled:opacity-60 transition-colors">
            <span className={`w-2 h-2 rounded-full ${lastSync?.status==="Success" ? "bg-green-400" : "bg-gray-300"}`}/>
            {scraping ? "Syncing…" : "Sync market data"}
          </button>
          {lastSync && <p className="text-xs text-gray-400 text-center mt-1">{new Date(lastSync.scrape_date).toLocaleDateString("en-IN")}</p>}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">
        {/* Mobile topbar */}
        <header className="lg:hidden bg-orange-500 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div>
            <p className="font-semibold text-base">{NAV.find(n=>n.id===nav)?.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleScrape} disabled={scraping}
              className="text-xs bg-white/20 text-white px-3 py-1.5 rounded-lg font-medium">
              {scraping ? "Syncing…" : "Sync"}
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs bg-white/20 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
            >
              {loggingOut ? "Logging out…" : "Logout"}
            </button>
          </div>
        </header>

        {/* Desktop topbar */}
        <header className="hidden lg:flex items-center justify-between bg-white border-b border-gray-100 px-6 h-12 shrink-0">
          <h1 className="text-sm font-semibold text-gray-900">{NAV.find(n=>n.id===nav)?.label}</h1>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {lastSync && <span>Last sync: {new Date(lastSync.scrape_date).toLocaleDateString("en-IN")}</span>}
            <span className="bg-gray-100 px-2 py-1 rounded-md">Jaipur branch</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md font-medium hover:bg-gray-50 disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </header>

        {/* Scrape message */}
        {scrapeMsg && (
          <div className={`mx-4 mt-3 px-4 py-3 rounded-xl text-sm font-medium border ${scrapeMsg.error ? "bg-red-50 text-red-700 border-red-200" : scrapeMsg.saved_to_db>0 ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
            {scrapeMsg.error ? `Error: ${scrapeMsg.error}` : scrapeMsg.message}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {nav==="dashboard" && <DashboardPage stats={stats} recentEvals={recentEvals} lastSync={lastSync}/>}
          {nav==="evaluate"  && <EvaluatePage/>}
          {nav==="history"   && <HistoryPage/>}
          {nav==="settings"  && <SettingsPage/>}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50">
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setNav(n.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${nav===n.id ? "text-orange-500" : "text-gray-400"}`}>
              <NavIcon path={n.icon}/>
              <span className="text-xs font-medium">{n.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardPage({ stats, recentEvals, lastSync }) {
  const metrics = [
    { label:"Total evaluations", value:stats.total,     color:"text-gray-900" },
    { label:"Good deals",        value:stats.goodDeals,  color:"text-green-600" },
    { label:"Overpriced",        value:stats.overpriced, color:"text-red-600" },
    { label:"Market listings",   value:stats.listings,   color:"text-gray-900" },
  ];
  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map(m=>(
          <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <p className={`text-3xl font-semibold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Market sync status */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-sm font-medium text-gray-900 mb-2">Market data status</p>
        {lastSync ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`w-2 h-2 rounded-full ${lastSync.status==="Success" ? "bg-green-400" : "bg-amber-400"}`}/>
            <span className="text-gray-600">Last synced: <strong>{new Date(lastSync.scrape_date).toLocaleString("en-IN")}</strong></span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">{lastSync.listings_saved} listings saved</span>
            <Badge label={lastSync.status} className={lastSync.status==="Success" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}/>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No market data yet. Tap <strong>Sync</strong> to fetch live listings.</p>
        )}
      </div>

      {/* Recent evaluations */}
      {recentEvals.length>0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">Recent evaluations</p>
          </div>
          <div className="divide-y divide-gray-50">
            {recentEvals.map(ev=>{
              const dm = decisionMeta[ev.decision] || decisionMeta["Pending"];
              return (
                <div key={ev.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ev.make} {ev.model} {ev.variant} ({ev.year})</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ev.fuel_type} · {ev.transmission} · {(ev.km_driven/1000).toFixed(0)}k km</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-semibold text-green-700">{formatINR(ev.suggested_purchase_price)}</p>
                    <Badge label={ev.decision||"Pending"} className={`mt-0.5 ${dm.badge}`}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EVALUATE — Accordion form + sticky result panel
// ═══════════════════════════════════════════════════════════════════════════════
function EvaluatePage() {
  const emptyForm = {
    make:"Maruti", model:"Swift", variant:"", year:2020,
    km_driven:50000, fuel_type:"Petrol", transmission:"Manual",
    colour:"White", num_owners:1, insurance_type:"Comprehensive",
    customer_name:"", car_reg_no:"", customer_mobile:"",
    offered_price:"", seller_asking_price:"", notes:"",
    branch:"", ca_name:"", evaluator_name:"",
  };

  const [form, setForm] = useState(emptyForm);
  const [conditions, setConditions] = useState([]);
  const [condChecks, setCondChecks] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [sellerSaving, setSellerSaving] = useState(false);
  const [savedEvalId, setSavedEvalId] = useState(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [sellerSaved, setSellerSaved] = useState(false);
  const [autoSaveMsg, setAutoSaveMsg] = useState("");
  const [fetchingMarket, setFetchingMarket] = useState(false);
  const [fetchingEx, setFetchingEx] = useState(false);
  const [exData, setExData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [caNames, setCaNames] = useState([]);
  const [evaluatorNames, setEvaluatorNames] = useState([]);
  const [marketSavedMsg, setMarketSavedMsg] = useState(null);

  const [sections, setSections] = useState({ s1:"open", s2:"idle", s3:"idle", s4:"idle", s5:"idle" });

  const toggleSection = (key) => {
    setSections(prev => {
      const isOpen = prev[key]==="open";
      return { ...prev, [key]: isOpen ? (key==="s1" ? "done" : "idle") : "open" };
    });
  };

  const completeSection = (key, next) => {
    setSections(prev => ({ ...prev, [key]:"done", [next]:"open" }));
  };

  useEffect(() => {
    ConditionCheck.filter({ is_active:true }).then(data => {
      setConditions(data);
      const defaults = {};
      data.forEach(c => { defaults[c.id] = !c.is_negative; });
      setCondChecks(defaults);
    });
    supabase.from("locations").select("name").then(({ data }) => {
      if (data) setBranches(data.map(r=>r.name));
    });
    supabase.from("employees").select("first_name,last_name").eq("employee_status","active").then(({ data }) => {
      if (data) {
        const names = data.map(e=>`${e.first_name} ${e.last_name}`.trim()).filter(Boolean);
        setCaNames(names);
        setEvaluatorNames(names);
      }
    });
  }, []);

  const set = (field, value) => {
    setForm(f => {
      const u = { ...f, [field]:value };
      if (field==="make") { u.model = ""; }
      return u;
    });

    const evalFields = [
      "make","model","variant","year","km_driven","fuel_type","transmission",
      "colour","num_owners","insurance_type","customer_name","car_reg_no",
      "customer_mobile","branch","ca_name","evaluator_name",
    ];
    if (evalFields.includes(field)) {
      setResult(null);
      setAutoSaved(false);
      setSellerSaved(false);
      setAutoSaveMsg("");
    }

    if (["seller_asking_price","offered_price","notes"].includes(field)) {
      setSellerSaved(false);
    }

    if (["make","model","variant","fuel_type","transmission"].includes(field)) setExData(null);
  };

  const setConditionCheck = (id, checked) => {
    setCondChecks(prev=>({ ...prev, [id]:checked }));
    setResult(null);
    setAutoSaved(false);
    setSellerSaved(false);
    setAutoSaveMsg("");
  };

  const customerReady = form.customer_mobile.length>=10 && form.car_reg_no.length>=9;

  const s1Summary = customerReady
    ? `${form.branch||"—"} · ${form.ca_name||"—"} · ${form.customer_name||"—"} · ${form.car_reg_no}`
    : "Fill mobile number and reg no. to continue";

  const s2Summary = form.model
    ? `${form.make} ${form.model}${form.variant?" "+form.variant:""} · ${form.year} · ${form.fuel_type} · ${(+form.km_driven/1000).toFixed(0)}k km`
    : "Tap to fill car details";

  const s3Summary = `${conditions.filter(c=> condChecks[c.id] !== undefined && !(c.is_negative ? condChecks[c.id] : !condChecks[c.id])).length}/${conditions.length} conditions OK`;

  const fetchEx = async () => {
    setFetchingEx(true);
    try {
      const res = await scrapeListings({ action:"fetchExShowroomPrice", params:{ make:form.make, model:form.model, variant:form.variant, fuel_type:form.fuel_type, transmission:form.transmission } });
      const data = res.data||res;
      setExData(data.ex_showroom_price ? data : { error: data.error||"Not found" });
    } catch(e) {
      setExData({ error:e.message });
    }
    setFetchingEx(false);
  };

  const evaluate = async () => {
    setLoading(true);
    setResult(null);
    setAutoSaved(false);
    setSellerSaved(false);
    setAutoSaveMsg("");

    try {
      const params = {
        ...form,
        year: +form.year,
        km_driven: +form.km_driven,
        num_owners: +form.num_owners,
        seller_asking_price: form.seller_asking_price ? +form.seller_asking_price : null,
        custom_conditions: conditions.map(c=>({ id:c.id, name:c.name, is_negative:c.is_negative, depreciation_percent:c.depreciation_percent, checked:!!condChecks[c.id] })),
      };

      const { fairValue, basePrice, age } = await calculateFairValue(supabase, params);
      const suggestedPurchasePrice = Math.round(fairValue/1.10);
      const marketStats = await getMarketStats(supabase, params.make, params.model, params.year);
      const decision = getDecision(params.seller_asking_price, suggestedPurchasePrice);
      const nextResult = {
        fair_value:fairValue,
        suggested_purchase_price:suggestedPurchasePrice,
        decision,
        breakdown:{ base_price_used:basePrice, age_years:age },
        market_stats:marketStats,
      };
      setResult(nextResult);

      const payload = {
        eval_date: new Date().toISOString(),
        ...form,
        year:+form.year,
        km_driven:+form.km_driven,
        num_owners:+form.num_owners,
        customer_name: form.customer_name||"",
        car_reg_no: form.car_reg_no||"",
        offered_price: form.offered_price ? +form.offered_price : null,
        seller_asking_price: form.seller_asking_price ? +form.seller_asking_price : null,
        calculated_fair_value: nextResult.fair_value,
        suggested_purchase_price: nextResult.suggested_purchase_price,
        market_avg_price: nextResult.market_stats?.avg||null,
        market_min_price: nextResult.market_stats?.min||null,
        market_max_price: nextResult.market_stats?.max||null,
        decision: nextResult.decision,
      };

      setAutoSaving(true);
      if (savedEvalId) {
        await CarEvaluation.update(savedEvalId, payload);
        setAutoSaveMsg("Evaluation re-calculated and updated in history.");
      } else {
        const created = await CarEvaluation.create(payload);
        setSavedEvalId(created.id);
        setAutoSaveMsg("Evaluation saved to history. Continue to seller details.");
      }
      setAutoSaved(true);
      setSections(prev=>({ ...prev, s1:"done", s2:"done", s3:"done", s4:"done", s5:"open" }));
    } catch(e) {
      alert("Error: "+e.message);
    }

    setAutoSaving(false);
    setLoading(false);
  };

  const fetchMarket = async () => {
    setFetchingMarket(true);
    setMarketSavedMsg(null);
    try {
      const res = await scrapeListings({ action:"fetchTargetedMarketData", params:{ make:form.make, model:form.model, year:+form.year } });
      const data = res.data||res;
      if (data.market_stats) {
        setResult(prev=>prev ? { ...prev, market_stats:data.market_stats } : { market_stats:data.market_stats });
        setMarketSavedMsg(`${data.market_stats.count||0} listings for ${form.year} ${form.make} ${form.model} saved.`);
      }
    } catch(e) {
      alert("Error: "+e.message);
    }
    setFetchingMarket(false);
  };

  const saveSellerDetails = async () => {
    if (!savedEvalId || !result) return;
    setSellerSaving(true);
    try {
      const sellerAsking = form.seller_asking_price ? +form.seller_asking_price : null;
      const nextDecision = getDecision(sellerAsking, result.suggested_purchase_price);
      await CarEvaluation.update(savedEvalId, {
        offered_price: form.offered_price ? +form.offered_price : null,
        seller_asking_price: sellerAsking,
        notes: form.notes||"",
        decision: nextDecision,
      });
      setResult(prev=>prev ? { ...prev, decision: nextDecision } : prev);
      setSellerSaved(true);
      setSections(prev=>({ ...prev, s5:"done" }));
    } catch(e) {
      alert("Save error: "+e.message);
    }
    setSellerSaving(false);
  };

  const dm = decisionMeta[result?.decision]||decisionMeta["Pending"];

  return (
    <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
      <div>
        <AccordionItem number="1" title="Showroom & customer" summary={sections.s1==="done" ? s1Summary : "Branch, evaluator, customer details"} state={sections.s1} onToggle={()=>toggleSection("s1")}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Field label="Branch">
                <select className={sel} value={form.branch} onChange={e=>set("branch",e.target.value)}>
                  <option value="">Select branch</option>
                  {branches.map(b=><option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="CA name">
                <select className={sel} value={form.ca_name} onChange={e=>set("ca_name",e.target.value)}>
                  <option value="">Select CA</option>
                  {caNames.map(n=><option key={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Evaluator">
                <select className={sel} value={form.evaluator_name} onChange={e=>set("evaluator_name",e.target.value)}>
                  <option value="">Select evaluator</option>
                  {evaluatorNames.map(n=><option key={n}>{n}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Field label="Customer name">
                <input className={inp} value={form.customer_name} onChange={e=>set("customer_name",e.target.value)} placeholder="e.g. Ramesh Kumar"/>
              </Field>
              <Field label="Mobile number" required>
                <input className={`${inp} ${form.customer_mobile&&form.customer_mobile.length<10 ? "border-red-300" : form.customer_mobile.length>=10 ? "border-green-400" : ""}`}
                  type="tel" value={form.customer_mobile}
                  onChange={e=>set("customer_mobile",e.target.value.replace(/\D/g,"").slice(0,10))}
                  placeholder="10-digit number" inputMode="numeric"/>
              </Field>
              <Field label="Car reg. no." required>
                <input className={`${inp} ${!form.car_reg_no ? "border-red-300" : "border-green-400"}`}
                  value={form.car_reg_no}
                  onChange={e=>{ let v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""); if(v.length>4)v=v.slice(0,4)+"-"+v.slice(4); if(v.length>7)v=v.slice(0,7)+"-"+v.slice(7); if(v.length>12)v=v.slice(0,12); set("car_reg_no",v); }}
                  placeholder="RJ14-UB-3469" maxLength={12}/>
              </Field>
            </div>
            <button
              disabled={!customerReady}
              onClick={()=>completeSection("s1","s2")}
              className="w-full lg:w-auto px-6 py-3 lg:py-2 rounded-xl lg:rounded-lg bg-orange-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors">
              Continue to car details →
            </button>
          </div>
        </AccordionItem>

        <AccordionItem number="2" title="Car details" summary={s2Summary} state={sections.s2} onToggle={()=>toggleSection("s2")}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Make">
                <BrandCombobox value={form.make} onChange={v => set("make", v)} />
              </Field>
              <Field label="Model">
                <ModelCombobox brand={form.make} value={form.model} onChange={v => set("model", v)} />
              </Field>
              <Field label="Variant">
                <input className={inp} value={form.variant} onChange={e=>set("variant",e.target.value)} placeholder="e.g. ZXI+"/>
              </Field>
              <Field label="Year">
                <select className={sel} value={form.year} onChange={e=>set("year",+e.target.value)}>
                  {YEARS.map(y=><option key={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="KM driven">
                <input className={inp} type="number" value={form.km_driven} onChange={e=>set("km_driven",e.target.value)} inputMode="numeric"/>
              </Field>
              <Field label="Colour">
                <select className={sel} value={form.colour} onChange={e=>set("colour",e.target.value)}>
                  {COLORS.map(c=><option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Fuel type">
                <select className={sel} value={form.fuel_type} onChange={e=>set("fuel_type",e.target.value)}>
                  {["Petrol","Diesel","CNG","Electric","Hybrid"].map(f=><option key={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Transmission">
                <select className={sel} value={form.transmission} onChange={e=>set("transmission",e.target.value)}>
                  {["Manual","Automatic"].map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="No. of owners">
                <select className={sel} value={form.num_owners} onChange={e=>set("num_owners",+e.target.value)}>
                  <option value={1}>1st owner</option>
                  <option value={2}>2nd owner</option>
                  <option value={3}>3rd owner</option>
                  <option value={4}>4th owner+</option>
                </select>
              </Field>
              <Field label="Insurance">
                <select className={sel} value={form.insurance_type} onChange={e=>set("insurance_type",e.target.value)}>
                  {["Comprehensive","Third Party","Expired"].map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <button onClick={fetchEx} disabled={fetchingEx||!form.make||!form.model}
              className="w-full py-3 lg:py-2 rounded-xl lg:rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium disabled:opacity-40 hover:bg-blue-100 transition-colors">
              {fetchingEx ? "Fetching…" : `Fetch ex-showroom price (${form.fuel_type})`}
            </button>
            {exData && !exData.error && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <p className="text-xs text-blue-600 font-medium">Ex-showroom: <strong>{formatINR(exData.ex_showroom_price)}</strong></p>
                <p className="text-xs text-blue-400">{exData.price_source||"Web"} · Saved</p>
              </div>
            )}
            {exData?.error && <p className="text-xs text-red-500">{exData.error}</p>}

            <button onClick={()=>completeSection("s2","s3")}
              className="w-full lg:w-auto px-6 py-3 lg:py-2 rounded-xl lg:rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors">
              Continue to conditions →
            </button>
          </div>
        </AccordionItem>

        <AccordionItem number="3" title="Condition checks" summary={sections.s3==="done"||sections.s3==="open" ? s3Summary : "Toggle each condition"} state={sections.s3} onToggle={()=>toggleSection("s3")}>
          {conditions.length===0
            ? <p className="text-sm text-gray-500 bg-amber-50 border border-amber-100 rounded-lg p-3">No conditions configured. Go to Settings → Conditions to add checks.</p>
            : (
              <div className="space-y-0 -mx-1">
                {conditions.map(c=>{
                  const checked = !!condChecks[c.id];
                  const isProblem = c.is_negative ? checked : !checked;
                  return (
                    <label key={c.id} className="flex items-center justify-between py-3 px-1 border-b border-gray-50 last:border-0 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={checked}
                          onChange={e=>setConditionCheck(c.id, e.target.checked)}
                          className="w-5 h-5 lg:w-4 lg:h-4 rounded accent-orange-500"/>
                        <div>
                          <p className={`text-sm lg:text-xs font-medium ${isProblem ? "text-red-700" : "text-green-700"}`}>{c.name}</p>
                          {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {isProblem && c.depreciation_percent>0 && <span className="text-xs font-medium text-red-500">-{c.depreciation_percent}%</span>}
                        <span className="text-base">{isProblem ? "❌" : "✅"}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )
          }
          <button onClick={()=>completeSection("s3","s4")} className="w-full lg:w-auto mt-4 px-6 py-3 lg:py-2 rounded-xl lg:rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors">
            Continue to evaluate →
          </button>
        </AccordionItem>

        <AccordionItem number="4" title="Evaluate price" summary={autoSaved ? "Evaluation complete" : "Calculate and auto-save evaluation"} state={sections.s4} onToggle={()=>toggleSection("s4")}>
          <div className="space-y-3">
            <button onClick={evaluate} disabled={loading||autoSaving}
              className="w-full py-4 lg:py-3 rounded-xl lg:rounded-lg bg-orange-500 text-white text-base lg:text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors shadow-sm">
              {loading ? "Calculating…" : autoSaving ? "Saving evaluation…" : "Evaluate price"}
            </button>
            {autoSaved && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{autoSaveMsg}</p>}
            {!autoSaved && <p className="text-xs text-gray-500">This step creates the record in history immediately.</p>}
          </div>
        </AccordionItem>

        <AccordionItem number="5" title="Seller details & save" summary="Asking price, offer, notes" state={sections.s5} onToggle={()=>toggleSection("s5")}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Field label="Seller asking price (₹)">
                <input className={inp} type="number" value={form.seller_asking_price} onChange={e=>set("seller_asking_price",e.target.value)} placeholder="e.g. 550000" inputMode="numeric"/>
              </Field>
              <Field label="Our offered price (₹)">
                <input className={inp} type="number" value={form.offered_price} onChange={e=>set("offered_price",e.target.value)} placeholder="e.g. 480000" inputMode="numeric"/>
              </Field>
            </div>
            <Field label="Notes">
              <textarea className={`${inp} h-20 lg:h-16 py-2`} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any extra observations…"/>
            </Field>

            <button onClick={saveSellerDetails} disabled={!savedEvalId||sellerSaving}
              className={`w-full lg:w-auto px-6 py-3 lg:py-2 rounded-xl lg:rounded-lg text-sm font-semibold transition-colors ${savedEvalId ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}>
              {sellerSaving ? "Saving seller details…" : "Save seller details"}
            </button>
            {!savedEvalId && <p className="text-xs text-gray-500">Evaluate price first to create the row.</p>}
            {sellerSaved && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Seller details updated in history.</p>}
          </div>
        </AccordionItem>

        {marketSavedMsg && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">{marketSavedMsg}</p>}
      </div>

      <div className="lg:sticky lg:top-4">
        {result ? (
          <div className="space-y-3">
            <div className={`${dm.bg} border ${dm.border} rounded-xl p-4 text-center`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${dm.text} mb-1`}>Decision</p>
              <p className={`text-2xl font-semibold ${dm.text}`}>{result.decision}</p>
              {form.seller_asking_price && result.decision==="Overpriced" && (
                <p className="text-xs text-red-600 mt-1">Overpaying by {formatINR(+form.seller_asking_price - result.suggested_purchase_price)}</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700">Max purchase price</p>
                  <p className="text-xs text-green-600">10% margin baked in</p>
                </div>
                <p className="text-xl font-semibold text-green-800">{formatINR(result.suggested_purchase_price)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700">Fair value</p>
                  <p className="text-xs text-blue-600">What buyer pays</p>
                </div>
                <p className="text-xl font-semibold text-blue-800">{formatINR(result.fair_value)}</p>
              </div>
              {form.seller_asking_price && (
                <div className="flex items-center justify-between py-1.5 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Seller asking</p>
                  <p className="text-sm font-medium">{formatINR(+form.seller_asking_price)}</p>
                </div>
              )}
              <div className="space-y-1.5 pt-1 border-t border-gray-100">
                {[
                  ["Base price",formatINR(result.breakdown?.base_price_used),""],
                  ["Age",`${result.breakdown?.age_years} years`,""],
                  ["Fuel",form.fuel_type,""],
                  ["KM driven",`${(+form.km_driven/1000).toFixed(0)}k km`,""],
                ].map(([l,v])=>(
                  <div key={l} className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">{l}</p>
                    <p className="text-xs text-gray-700">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.market_stats ? (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-700 mb-3">Jaipur market ({result.market_stats.count} similar)</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[["Min",result.market_stats.min,"bg-green-50 text-green-800"],["Avg",result.market_stats.avg,"bg-blue-50 text-blue-800"],["Max",result.market_stats.max,"bg-amber-50 text-amber-800"]].map(([l,v,cls])=>(
                    <div key={l} className={`${cls} rounded-lg p-2 text-center`}>
                      <p className="text-xs opacity-70">{l}</p>
                      <p className="text-sm font-semibold">{formatINR(v)}</p>
                    </div>
                  ))}
                </div>
                {result.market_stats.listings?.map((l,i)=>(
                  <div key={i} className="flex items-center justify-between py-1.5 border-t border-gray-50 text-xs text-gray-500">
                    <span>{l.source} · {l.year} · {(l.km_driven/1000).toFixed(0)}k km</span>
                    <span className="font-medium text-gray-700">{formatINR(l.asking_price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <button onClick={fetchMarket} disabled={fetchingMarket}
                className="w-full py-3 lg:py-2 rounded-xl lg:rounded-lg border border-gray-200 bg-gray-50 text-gray-600 text-sm font-medium disabled:opacity-60 hover:bg-gray-100 transition-colors">
                {fetchingMarket ? "Fetching live market…" : "Fetch live market data"}
              </button>
            )}

            {savedEvalId && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
                Active evaluation ID: {savedEvalId}. Re-evaluate updates this same row.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">Result will appear here</p>
            <p className="text-xs text-gray-400 mt-1">Complete sections 1-4 to evaluate, then fill section 5 to save seller details.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryPage() {
  const emptyEditFields = {
    customer_name: "",
    customer_mobile: "",
    car_reg_no: "",
    seller_asking_price: "",
    offered_price: "",
    notes: "",
  };

  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState(emptyEditFields);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const loadEvals = () => {
    CarEvaluation.list().then(data => {
      setEvals(
        data.sort(
          (a, b) =>
            new Date(b.eval_date || b.created_date).getTime() -
            new Date(a.eval_date || a.created_date).getTime()
        )
      );
      setLoading(false);
    }).catch(()=>setLoading(false));
  };
  useEffect(()=>{ loadEvals(); },[]);

  const updateStatus = async (id, status) => {
    setSavingStatus(true);
    await CarEvaluation.update(id, { lead_status:status });
    setEvals(prev=>prev.map(e=>e.id===id?{...e,lead_status:status}:e));
    if (editModal?.id===id) setEditModal(prev=>({...prev,lead_status:status}));
    setSavingStatus(false);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    const updated = { ...editFields };
    const payload = {
      ...updated,
      seller_asking_price: updated.seller_asking_price ? +updated.seller_asking_price : updated.seller_asking_price,
      offered_price: updated.offered_price ? +updated.offered_price : updated.offered_price,
    };
    await CarEvaluation.update(editModal.id, payload);
    const newRec = { ...editModal, ...payload };
    setEvals(prev=>prev.map(e=>e.id===editModal.id?newRec:e));
    setEditModal(newRec);
    setEditMode(false);
    setSavingEdit(false);
  };

  const filtered = evals.filter(e=>
    (decisionFilter==="All"||e.decision===decisionFilter) &&
    (statusFilter==="All"||(e.lead_status||"Pending")===statusFilter) &&
    (!search||`${e.make} ${e.model} ${e.variant} ${e.customer_name||""} ${e.car_reg_no||""}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search car, customer, reg no…"
          className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 self-center">Deal:</span>
          {["All","Good Deal","Fair Deal","Overpriced"].map(f=>(
            <button key={f} onClick={()=>setDecisionFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${decisionFilter===f ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{f}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 self-center">Status:</span>
          {["All",...LEAD_STATUSES].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter===s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length===0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <p className="font-medium">No evaluations found</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="lg:hidden space-y-3">
            {filtered.map(ev=>{
              const dm = decisionMeta[ev.decision]||decisionMeta["Pending"];
              const ls = ev.lead_status||"Pending";
              const expanded = expandedRow===ev.id;
              return (
                <div key={ev.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <button className="w-full text-left p-4" onClick={()=>setExpandedRow(expanded?null:ev.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{ev.make} {ev.model} {ev.variant&&`(${ev.variant})`}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{ev.car_reg_no||"—"} · {ev.customer_name||"—"}</p>
                        <p className="text-xs text-gray-400">{(ev.km_driven/1000).toFixed(0)}k km · {new Date(ev.eval_date||ev.created_date).toLocaleDateString("en-IN")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-semibold text-green-700">{formatINR(ev.suggested_purchase_price)}</p>
                        <Badge label={ls} className={`mt-0.5 ${leadMeta[ls]}`}/>
                      </div>
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-400">Seller price</span><p className="font-medium">{formatINR(ev.seller_asking_price)}</p></div>
                        <div><span className="text-gray-400">Fair value</span><p className="font-medium">{formatINR(ev.calculated_fair_value)}</p></div>
                        <div><span className="text-gray-400">Offered</span><p className="font-medium">{formatINR(ev.offered_price)||"—"}</p></div>
                        <div><span className="text-gray-400">Fuel</span><p className="font-medium">{ev.fuel_type}</p></div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">Deal quality</p>
                        <div className="mb-2">
                          <Badge label={ev.decision||"Pending"} className={dm.badge}/>
                        </div>
                        <p className="text-xs text-gray-400 mb-1.5">Update lead status</p>
                        <div className="flex flex-wrap gap-1.5">
                          {LEAD_STATUSES.map(s=>(
                            <button key={s} onClick={()=>updateStatus(ev.id,s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${(ev.lead_status||"Pending")===s ? leadMeta[s]+" border-transparent" : "bg-white text-gray-500 border-gray-200"}`}>{s}</button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={()=>{
                          setEditModal(ev);
                          setEditFields({
                            customer_name: ev.customer_name||"",
                            customer_mobile: ev.customer_mobile||"",
                            car_reg_no: ev.car_reg_no||"",
                            seller_asking_price: ev.seller_asking_price||"",
                            offered_price: ev.offered_price||"",
                            notes: ev.notes||"",
                          });
                          setEditMode(true);
                        }}
                        className="w-full py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Edit details
                      </button>
                      {ev.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{ev.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Car","Reg No.","Customer","Date","KM","Buy at","Deal","Status","Actions"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(ev=>{
                    const dm = decisionMeta[ev.decision]||decisionMeta["Pending"];
                    const ls = ev.lead_status||"Pending";
                    return (
                      <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{ev.make} {ev.model} {ev.variant&&`(${ev.variant})`}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{ev.car_reg_no||"—"}</td>
                        <td className="px-4 py-3 text-gray-600">{ev.customer_name||"—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(ev.eval_date||ev.created_date).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 text-gray-600">{(ev.km_driven/1000).toFixed(0)}k</td>
                        <td className="px-4 py-3 font-semibold text-green-700">{formatINR(ev.suggested_purchase_price)}</td>
                        <td className="px-4 py-3"><Badge label={ev.decision||"Pending"} className={dm.badge}/></td>
                        <td className="px-4 py-3">
                          <select value={ls} onChange={e=>updateStatus(ev.id,e.target.value)}
                            className={`text-xs font-medium px-2 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400 ${leadMeta[ls]}`}>
                            {LEAD_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={()=>{ setEditModal(ev); setEditMode(false); setEditFields(emptyEditFields); }}
                            className="text-xs text-blue-500 hover:text-blue-700 font-medium">Details</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detail modal (desktop) */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>{setEditModal(null);setEditMode(false);}}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{editModal.make} {editModal.model} {editModal.variant} ({editModal.year})</h3>
                <p className="text-xs text-gray-400 mt-0.5">{editModal.car_reg_no} · {editModal.customer_name} · {editModal.customer_mobile}</p>
              </div>
              <button onClick={()=>{setEditModal(null);setEditMode(false);}} className="text-gray-400 hover:text-gray-600 ml-4">✕</button>
            </div>
            <div className="flex gap-2 mb-4">
              <select value={editModal.lead_status||"Pending"} onChange={e=>updateStatus(editModal.id,e.target.value)} disabled={savingStatus}
                className={`text-sm font-medium px-3 py-2 rounded-lg border-0 cursor-pointer focus:outline-none ${leadMeta[editModal.lead_status||"Pending"]}`}>
                {LEAD_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <Badge label={editModal.decision||"Pending"} className={(decisionMeta[editModal.decision]||decisionMeta["Pending"]).badge}/>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[["Seller price",editModal.seller_asking_price,""],["Fair value",editModal.calculated_fair_value,"text-blue-700"],["Buy at",editModal.suggested_purchase_price,"text-green-700"]].map(([l,v,cls])=>(
                <div key={l} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">{l}</p>
                  <p className={`font-semibold text-sm ${cls}`}>{formatINR(v)}</p>
                </div>
              ))}
            </div>
            {editMode ? (
              <div className="space-y-3 border border-orange-100 rounded-xl p-4 bg-orange-50 mb-4">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Edit details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[["Customer name","customer_name","text"],["Mobile","customer_mobile","text"],["Reg. no.","car_reg_no","text"],["Seller price","seller_asking_price","number"],["Offered price","offered_price","number"]].map(([label,field,type])=>(
                    <div key={field} className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">{label}</label>
                      <input type={type} value={editFields[field]||""} onChange={e=>setEditFields(f=>({...f,[field]:e.target.value}))}
                        className="h-9 border border-gray-200 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                    </div>
                  ))}
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Notes</label>
                    <textarea value={editFields.notes||""} onChange={e=>setEditFields(f=>({...f,notes:e.target.value}))} rows={2}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setEditMode(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">Cancel</button>
                  <button onClick={saveEdit} disabled={savingEdit} className="flex-2 px-6 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50">{savingEdit?"Saving…":"Save"}</button>
                </div>
              </div>
            ) : (
              <button onClick={()=>{ setEditFields({ customer_name:editModal.customer_name||"", customer_mobile:editModal.customer_mobile||"", car_reg_no:editModal.car_reg_no||"", seller_asking_price:editModal.seller_asking_price||"", offered_price:editModal.offered_price||"", notes:editModal.notes||"", }); setEditMode(true); }}
                className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 mb-3">Edit details</button>
            )}
            <button onClick={()=>{setEditModal(null);setEditMode(false);}} className="w-full py-2 rounded-xl bg-gray-100 text-sm text-gray-600 hover:bg-gray-200">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsPage() {
  const [activeTab, setActiveTab] = useState("sources");
  const tabs = [
    { id:"sources",     label:"Data sources" },
    { id:"conditions",  label:"Conditions" },
    { id:"exshowroom",  label:"Base prices" },
    { id:"depreciation",label:"Depreciation" },
  ];
  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-gray-100 flex overflow-x-auto">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-1 lg:flex-none ${activeTab===t.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4 lg:p-6">
        {activeTab==="sources"      && <SourcesPage onSyncDone={()=>{}}/>}
        {activeTab==="conditions"   && <ConditionManager/>}
        {activeTab==="exshowroom"   && <ExShowroomPriceManager/>}
        {activeTab==="depreciation" && <DepreciationManager/>}
      </div>
    </div>
  );
}