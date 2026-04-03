// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CarEvaluation, CarListing, ScrapeLog, ConditionCheck } from "../api/entities";
import { scrapeListings } from "../api/backendFunctions";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { calculateFairValue, getMarketStats, getDecision } from "../utils/calculate";
import { COLORS, YEARS, LEAD_STATUSES, fuzzyMatchMake, normalizeFuel, normalizeColor } from "../utils/carConstants";
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

function Badge({ label, className="" }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}

function Field({ label, required=false, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inp = "w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900";
const sel = "w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900";
const inpGreen = "w-full h-11 lg:h-9 border border-green-400 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-green-50 text-green-900";
const inpBlue = "w-full h-11 lg:h-9 border border-blue-400 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50 text-blue-900";

// ─── Accordion ────────────────────────────────────────────────────────────────
function AccordionItem({ number, title, summary, state, onToggle, children }) {
  const open = state === "open";
  const done = state === "done";
  return (
    <div className={`border rounded-xl overflow-hidden mb-3 transition-all ${done ? "border-green-200" : open ? "border-orange-200" : "border-gray-100"} bg-white`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-4 lg:py-3 text-left hover:bg-gray-50 transition-colors">
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

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV_FULL = [
  { id:"dashboard", label:"Dashboard",           icon:"M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" },
  { id:"evaluate",  label:"Evaluate car",         icon:"M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" },
  { id:"exchange",  label:"Exchange enquiries",   icon:"M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
  { id:"history",   label:"History",              icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id:"settings",  label:"Settings",             icon:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];
const NAV_LIMITED = [
  { id:"evaluate",  label:"Evaluate car",  icon:"M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" },
];

function NavIcon({ path }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path}/>
    </svg>
  );
}

// ─── WhatsApp message builder ─────────────────────────────────────────────────
function buildWhatsAppMessage(ev, conditions) {
  const date = new Date(ev.eval_date || ev.created_date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
  const goodConds = [], badConds = [];
  (conditions || []).forEach(c => {
    const checked = ev[`cond_${c.id}`] !== undefined ? ev[`cond_${c.id}`] : true;
    const isBad = c.is_negative ? checked : !checked;
    if (isBad) badConds.push(c.name);
    else goodConds.push(c.name);
  });

  const goodLine = goodConds.length > 0 ? `✅ ${goodConds.join(", ")}` : "✅ -";
  const badLine = badConds.length > 0 ? `❌ ${badConds.join(", ")}` : "❌ -";
  const offered = ev.offered_price || ev.suggested_purchase_price;
  const offeredText = offered ? `₹${Number(offered).toLocaleString("en-IN")}` : "—";
  const ownerText = ev.num_owners === 1 ? "1st" : ev.num_owners === 2 ? "2nd" : ev.num_owners === 3 ? "3rd" : `${ev.num_owners || "—"}th`;
  const carTitle = `${ev.make || ""} ${ev.model || ""}`.trim() || "—";

  return `🚗 Used Car Evaluation Report
📅 Date: ${date}
🏢 Branch: ${ev.branch || "—"}
👤 Evaluator: ${ev.evaluator_name || "—"}
👔 Sales Person: ${ev.ca_name || "—"}

Car Details
Reg No: ${ev.car_reg_no || "—"}
${carTitle}${ev.variant ? ` (${ev.variant})` : ""}
Year: ${ev.year || "—"} | Fuel: ${ev.fuel_type || "—"}
KM: ${ev.km_driven ? Number(ev.km_driven).toLocaleString("en-IN") : "—"} | Colour: ${ev.colour || "—"}
Owners: ${ownerText} owner

Conditions
${goodLine}
${badLine}

Our Offered Price: ${offeredText}

Techwheels Used Cars, ${ev.branch || "Jaipur"}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const { signOut, isUsedCarDept, employeeName, branchName, employee } = useAuth();
  const navigate = useNavigate();
  const [nav, setNav] = useState(isUsedCarDept ? "dashboard" : "evaluate");
  const [stats, setStats] = useState({ total:0, goodDeals:0, overpriced:0, listings:0 });
  const [recentEvals, setRecentEvals] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState(null);
  const [pendingExchangeCount, setPendingExchangeCount] = useState(0);
  const [evaluatePrefill, setEvaluatePrefill] = useState(null);
  const [editEvalData, setEditEvalData] = useState(null);

  const NAV = isUsedCarDept ? NAV_FULL : NAV_LIMITED;

  useEffect(() => {
    if (!NAV.some(n => n.id === nav)) setNav(NAV[0].id);
  }, [isUsedCarDept]);

  useEffect(() => {
    if (!isUsedCarDept) return;
    Promise.all([CarEvaluation.list(), CarListing.list(), ScrapeLog.list()])
      .then(([evals, listings, logs]) => {
        setStats({
          total: evals.length,
          goodDeals: evals.filter(e=>e.decision==="Good Deal").length,
          overpriced: evals.filter(e=>e.decision==="Overpriced").length,
          listings: listings.length,
        });
        setRecentEvals(
          evals.sort((a,b)=>new Date(b.eval_date||b.created_date)-new Date(a.eval_date||a.created_date)).slice(0,5)
        );
        if (logs.length > 0) {
          const sorted = logs.sort((a,b)=>new Date(b.scrape_date)-new Date(a.scrape_date));
          setLastSync(sorted[0]);
        }
      }).catch(()=>{});
  }, [nav, isUsedCarDept]);

  useEffect(() => {
    if (!isUsedCarDept) return;
    supabase
      .from('showroom_walkins')
      .select('id', { count: 'exact' })
      .eq('is_exchange_enquiry', true)
      .is('evaluated_at', null)
      .then(({ count }) => { if (count != null) setPendingExchangeCount(count); })
      .catch(()=>{});
  }, [nav, isUsedCarDept]);

  const handleScrape = async () => {
    setScraping(true); setScrapeMsg(null);
    try {
      const res = await scrapeListings({ action:"scrape" });
      setScrapeMsg(res);
      setLastSync({ scrape_date: new Date().toISOString(), listings_saved: res.saved_to_db, status: res.saved_to_db>0?"Success":"Partial" });
    } catch(e) { setScrapeMsg({ error: e.message }); }
    setScraping(false);
  };

  // ── Logout: instant, no await, no loading state needed ────────────────────
  const handleLogout = () => {
    sessionStorage.removeItem("tw_post_login_redirect");
    signOut(); // clears localStorage + React state synchronously, server call is fire-and-forget
    navigate("/login", { replace: true });
  };

  const openEvaluateFromWalkin = (walkin) => {
    setEvaluatePrefill({
      customer_name: walkin.customer_name || "",
      customer_mobile: walkin.mobile_number || "",
      ca_name: walkin.salesperson_name || "",
      branch: walkin.location_name || branchName,
      walkin_id: walkin.id,
    });
    setEditEvalData(null);
    setNav("evaluate");
  };

  const openEvaluateForEdit = (evalRecord) => {
    setEditEvalData(evalRecord);
    setEvaluatePrefill(null);
    setNav("evaluate");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Desktop sidebar */}
      {isUsedCarDept && (
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
          {isUsedCarDept && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Main</p>}
          {NAV.filter(n=>n.id!=="settings").map(n=>(
            <button key={n.id} onClick={()=>setNav(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${nav===n.id ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
              <NavIcon path={n.icon}/>
              {n.label}
              {n.id === "exchange" && pendingExchangeCount > 0 && (
                <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">{pendingExchangeCount}</span>
              )}
            </button>
          ))}
          {isUsedCarDept && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-4 mb-2">Configure</p>
              <button onClick={()=>setNav("settings")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${nav==="settings" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                <NavIcon path={NAV_FULL.find(n=>n.id==="settings")?.icon}/>
                Settings
              </button>
            </>
          )}
        </nav>
        {isUsedCarDept && (
          <div className="px-3 py-4 border-t border-gray-100">
            <button onClick={handleScrape} disabled={scraping}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-orange-200 text-orange-600 text-xs font-medium hover:bg-orange-50 disabled:opacity-60 transition-colors">
              <span className={`w-2 h-2 rounded-full ${lastSync?.status==="Success" ? "bg-green-400" : "bg-gray-300"}`}/>
              {scraping ? "Syncing…" : "Sync market data"}
            </button>
            {lastSync && <p className="text-xs text-gray-400 text-center mt-1">{new Date(lastSync.scrape_date).toLocaleDateString("en-IN")}</p>}
          </div>
        )}
      </aside>
      )}

      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">
        {/* Mobile topbar */}
        <header className="lg:hidden bg-orange-500 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div><p className="font-semibold text-base">{NAV.find(n=>n.id===nav)?.label || "Evaluate car"}</p></div>
          <div className="flex items-center gap-2">
            {isUsedCarDept && (
              <button onClick={handleScrape} disabled={scraping} className="text-xs bg-white/20 text-white px-3 py-1.5 rounded-lg font-medium">
                {scraping ? "Syncing…" : "Sync"}
              </button>
            )}
            <button onClick={handleLogout} className="text-xs bg-white/20 text-white px-3 py-1.5 rounded-lg font-medium">
              Logout
            </button>
          </div>
        </header>

        {/* Desktop topbar */}
        <header className="hidden lg:flex items-center justify-between bg-white border-b border-gray-100 px-6 h-12 shrink-0">
          <h1 className="text-sm font-semibold text-gray-900">{NAV.find(n=>n.id===nav)?.label || "Evaluate car"}</h1>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {employeeName && <span className="bg-gray-100 px-2 py-1 rounded-md">{employeeName}</span>}
            {branchName && <span className="bg-gray-100 px-2 py-1 rounded-md">{branchName}</span>}
            {lastSync && isUsedCarDept && <span>Last sync: {new Date(lastSync.scrape_date).toLocaleDateString("en-IN")}</span>}
            <button
              onClick={handleLogout}
              className="text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md font-medium hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </header>

        {scrapeMsg && (
          <div className={`mx-4 mt-3 px-4 py-3 rounded-xl text-sm font-medium border ${scrapeMsg.error ? "bg-red-50 text-red-700 border-red-200" : scrapeMsg.saved_to_db>0 ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
            {scrapeMsg.error ? `Error: ${scrapeMsg.error}` : scrapeMsg.message}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {nav==="dashboard" && isUsedCarDept && <DashboardPage stats={stats} recentEvals={recentEvals} lastSync={lastSync}/>}
          {nav==="evaluate"  && (
            <EvaluatePage
              key={editEvalData?.id || (evaluatePrefill?.walkin_id || 'new')}
              prefill={evaluatePrefill}
              editEvalData={editEvalData}
              employeeName={employeeName}
              branchName={branchName}
              isUsedCarDept={isUsedCarDept}
              employee={employee}
              onClearEdit={() => { setEditEvalData(null); setEvaluatePrefill(null); }}
            />
          )}
          {nav==="exchange"  && isUsedCarDept && <ExchangePage onEvaluate={openEvaluateFromWalkin}/>}
          {nav==="history"   && isUsedCarDept && <HistoryPage onEditEval={openEvaluateForEdit}/>}
          {nav==="settings"  && isUsedCarDept && <SettingsPage/>}
        </main>

        {/* Mobile bottom nav */}
        {isUsedCarDept && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50">
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setNav(n.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors relative ${nav===n.id ? "text-orange-500" : "text-gray-400"}`}>
              <NavIcon path={n.icon}/>
              <span className="text-xs font-medium">{n.label}</span>
              {n.id === "exchange" && pendingExchangeCount > 0 && (
                <span className="absolute top-1 right-2 text-xs bg-orange-500 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{fontSize:"9px"}}>{pendingExchangeCount}</span>
              )}
            </button>
          ))}
        </nav>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardPage({ stats, recentEvals }) {
  const metrics = [
    { label:"Total evaluations", value:stats.total,     color:"text-gray-900" },
    { label:"Good deals",        value:stats.goodDeals,  color:"text-green-600" },
    { label:"Overpriced",        value:stats.overpriced, color:"text-red-600" },
    { label:"Market listings",   value:stats.listings,   color:"text-gray-900" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map(m=>(
          <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <p className={`text-3xl font-semibold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>
      {recentEvals.length>0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-medium text-gray-900">Recent evaluations</p></div>
          <div className="divide-y divide-gray-50">
            {recentEvals.map(ev=>{
              const dm = decisionMeta[ev.decision]||decisionMeta["Pending"];
              return (
                <div key={ev.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ev.make} {ev.model} {ev.variant} ({ev.year})</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ev.car_reg_no||"—"} · {ev.customer_name||"—"}</p>
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
//  EVALUATE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function EvaluatePage({ prefill, editEvalData, employeeName, branchName, isUsedCarDept, employee, onClearEdit }) {
  const buildEmpty = () => ({
    make:"Maruti", model:"Swift", variant:"", year:2020,
    km_driven:50000, fuel_type:"Petrol", transmission:"Manual",
    colour:"White", num_owners:1, insurance_type:"Comprehensive",
    customer_name:"", car_reg_no:"", customer_mobile:"",
    offered_price:"", seller_asking_price:"", notes:"",
    branch: branchName || "",
    ca_name: !isUsedCarDept ? employeeName : "",
    evaluator_name: employeeName || "",
  });

  const buildFromEdit = (ev) => ({
    make: ev.make || "Maruti",
    model: ev.model || "",
    variant: ev.variant || "",
    year: ev.year || 2020,
    km_driven: ev.km_driven || 50000,
    fuel_type: ev.fuel_type || "Petrol",
    transmission: ev.transmission || "Manual",
    colour: ev.colour || "White",
    num_owners: ev.num_owners || 1,
    insurance_type: ev.insurance_type || "Comprehensive",
    customer_name: ev.customer_name || "",
    car_reg_no: ev.car_reg_no || "",
    customer_mobile: ev.customer_mobile || "",
    offered_price: ev.offered_price || "",
    seller_asking_price: ev.seller_asking_price || "",
    notes: ev.notes || "",
    branch: ev.branch || branchName || "",
    ca_name: ev.ca_name || "",
    evaluator_name: ev.evaluator_name || employeeName || "",
  });

  const initForm = () => {
    if (editEvalData) return buildFromEdit(editEvalData);
    const base = buildEmpty();
    if (prefill) {
      return {
        ...base,
        customer_name: prefill.customer_name || "",
        customer_mobile: prefill.customer_mobile || "",
        ca_name: prefill.ca_name || base.ca_name,
        branch: prefill.branch || base.branch,
      };
    }
    return base;
  };

  const [form, setForm] = useState(initForm);
  const [conditions, setConditions] = useState([]);
  const [condChecks, setCondChecks] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [sellerSaving, setSellerSaving] = useState(false);
  const [savedEvalId, setSavedEvalId] = useState(editEvalData?.id || null);
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
  const [rtoLoading, setRtoLoading] = useState(false);
  const [rtoFound, setRtoFound] = useState(false);
  const [rtoFields, setRtoFields] = useState({});
  const rtoDebounceRef = useRef(null);

  const [sections, setSections] = useState(() => {
    if (editEvalData) return { s1:"done", s2:"done", s3:"done", s4:"open", s5:"open" };
    return { s1:"open", s2:"idle", s3:"idle", s4:"idle", s5:"idle" };
  });

  useEffect(() => {
    ConditionCheck.filter({ is_active:true }).then(data => {
      setConditions(data);
      if (editEvalData) {
        const saved = {};
        data.forEach(c => {
          saved[c.id] = editEvalData[`cond_${c.id}`] !== undefined
            ? editEvalData[`cond_${c.id}`]
            : !c.is_negative;
        });
        setCondChecks(saved);
      } else {
        const defaults = {};
        data.forEach(c => { defaults[c.id] = !c.is_negative; });
        setCondChecks(defaults);
      }
    });

    Promise.all([
      supabase.from("locations").select("name"),
      supabase.from("employees").select("first_name,last_name").eq("employee_status","active"),
    ]).then(([{ data: locs }, { data: emps }]) => {
      if (locs) setBranches(locs.map(r=>r.name));
      if (emps) {
        const names = emps.map(e=>`${e.first_name} ${e.last_name}`.trim()).filter(Boolean);
        setCaNames(names);
        setEvaluatorNames(names);
      }
    });
  }, []);

  const lookupRTO = useCallback((regNo) => {
    if (rtoDebounceRef.current) clearTimeout(rtoDebounceRef.current);
    const cleaned = regNo.replace(/-/g, "").replace(/\s/g, "").toUpperCase();
    if (cleaned.length < 9) return;

    rtoDebounceRef.current = setTimeout(async () => {
      setRtoLoading(true);
      try {
        const { data } = await supabase
          .from("all_rto_data")
          .select("Registration No., Owner Name, Maker Name, Model Name, Fuel Type, Color, Mobile No.")
          .eq("Registration No.", regNo)
          .maybeSingle();

        if (data) { applyRTO(data); setRtoLoading(false); return; }

        const { data: data2 } = await supabase
          .from("all_rto_data")
          .select("Registration No., Owner Name, Maker Name, Model Name, Fuel Type, Color, Mobile No.")
          .eq("Registration No.", cleaned)
          .maybeSingle();

        if (data2) { applyRTO(data2); setRtoLoading(false); return; }

        const parts = cleaned.match(/^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{1,4})$/);
        if (parts) {
          const formatted = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
          const { data: data3 } = await supabase
            .from("all_rto_data")
            .select("Registration No., Owner Name, Maker Name, Model Name, Fuel Type, Color, Mobile No.")
            .eq("Registration No.", formatted)
            .maybeSingle();
          if (data3) applyRTO(data3);
        }
      } catch(e) {
        console.warn("RTO lookup failed:", e.message);
      }
      setRtoLoading(false);
    }, 400);
  }, [form.customer_name, form.customer_mobile]);

  const applyRTO = (data) => {
    setRtoFound(true);
    const newRtoFields = {};
    const updates = {};

    if (data["Maker Name"]) { updates.make = fuzzyMatchMake(data["Maker Name"]); newRtoFields.make = true; }
    if (data["Model Name"]) { updates.variant = data["Model Name"]; newRtoFields.variant = true; }
    if (data["Fuel Type"])  { updates.fuel_type = normalizeFuel(data["Fuel Type"]); newRtoFields.fuel_type = true; }
    if (data["Color"])      { updates.colour = normalizeColor(data["Color"]); newRtoFields.colour = true; }
    if (data["Owner Name"] && !form.customer_name)   { updates.customer_name = data["Owner Name"]; newRtoFields.customer_name = true; }
    if (data["Mobile No."] && !form.customer_mobile) { updates.customer_mobile = String(data["Mobile No."]); newRtoFields.customer_mobile = true; }

    setRtoFields(newRtoFields);
    setForm(f => ({ ...f, ...updates }));
  };

  const set = (field, value) => {
    setForm(f => {
      const u = { ...f, [field]:value };
      if (field==="make") { u.model = ""; }
      return u;
    });
    if (rtoFields[field]) setRtoFields(prev => { const n={...prev}; delete n[field]; return n; });
    const evalFields = ["make","model","variant","year","km_driven","fuel_type","transmission","colour","num_owners","insurance_type","customer_name","car_reg_no","customer_mobile","branch","ca_name","evaluator_name"];
    if (evalFields.includes(field)) { setResult(null); setAutoSaved(false); setSellerSaved(false); setAutoSaveMsg(""); }
    if (["seller_asking_price","offered_price","notes"].includes(field)) { setSellerSaved(false); }
    if (["make","model","variant","fuel_type","transmission"].includes(field)) setExData(null);
  };

  const setConditionCheck = (id, checked) => {
    setCondChecks(prev=>({ ...prev, [id]:checked }));
    setResult(null); setAutoSaved(false); setSellerSaved(false); setAutoSaveMsg("");
  };

  const toggleSection = (key) => {
    setSections(prev => {
      const isOpen = prev[key]==="open";
      return { ...prev, [key]: isOpen ? (key==="s1" ? "done" : "idle") : "open" };
    });
  };

  const completeSection = (key, next) => {
    setSections(prev => ({ ...prev, [key]:"done", [next]:"open" }));
  };

  const customerReady = form.customer_mobile.length >= 10 && form.car_reg_no.length >= 9;

  const s1Summary = customerReady
    ? `${form.branch||"—"} · ${form.ca_name||"—"} · ${form.customer_name||"—"} · ${form.car_reg_no}`
    : "Fill mobile number and reg no. to continue";

  const s2Summary = form.model
    ? `${form.make} ${form.model}${form.variant?" "+form.variant:""} · ${form.year} · ${form.fuel_type} · ${(+form.km_driven/1000).toFixed(0)}k km`
    : "Tap to fill car details";

  const s3Summary = conditions.length > 0
    ? `${conditions.filter(c=>{ const isBad=c.is_negative?condChecks[c.id]:!condChecks[c.id]; return !isBad; }).length}/${conditions.length} conditions OK`
    : "Toggle each condition";

  const fetchEx = async () => {
    setFetchingEx(true);
    try {
      const res = await scrapeListings({ action:"fetchExShowroomPrice", params:{ make:form.make, model:form.model, variant:form.variant, fuel_type:form.fuel_type, transmission:form.transmission } });
      const data = res.data||res;
      setExData(data.ex_showroom_price ? data : { error: data.error||"Not found" });
    } catch(e) { setExData({ error:e.message }); }
    setFetchingEx(false);
  };

  const evaluate = async () => {
    setLoading(true); setResult(null); setAutoSaved(false); setSellerSaved(false); setAutoSaveMsg("");
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

      const nextResult = { fair_value:fairValue, suggested_purchase_price:suggestedPurchasePrice, decision, breakdown:{ base_price_used:basePrice, age_years:age }, market_stats:marketStats };
      setResult(nextResult);

      const condSnapshot = {};
      conditions.forEach(c => { condSnapshot[`cond_${c.id}`] = !!condChecks[c.id]; });

      const payload = {
        eval_date: new Date().toISOString(),
        ...form,
        year:+form.year, km_driven:+form.km_driven, num_owners:+form.num_owners,
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
        ...condSnapshot,
      };

      setAutoSaving(true);
      if (savedEvalId) {
        await CarEvaluation.update(savedEvalId, payload);
        setAutoSaveMsg("Evaluation re-calculated and updated in history.");
        if (prefill?.walkin_id) {
          await supabase.from('showroom_walkins').update({ evaluated_at: new Date().toISOString() }).eq('id', prefill.walkin_id);
        }
      } else {
        const created = await CarEvaluation.create(payload);
        setSavedEvalId(created.id);
        setAutoSaveMsg("Evaluation saved to history. Continue to seller details.");
        if (prefill?.walkin_id) {
          await supabase.from('showroom_walkins').update({ evaluated_at: new Date().toISOString() }).eq('id', prefill.walkin_id);
        }
      }
      setAutoSaved(true);
      setSections(prev=>({ ...prev, s1:"done", s2:"done", s3:"done", s4:"done", s5:"open" }));
    } catch(e) { alert("Error: "+e.message); }
    setAutoSaving(false);
    setLoading(false);
  };

  const fetchMarket = async () => {
    setFetchingMarket(true); setMarketSavedMsg(null);
    try {
      const res = await scrapeListings({ action:"fetchTargetedMarketData", params:{ make:form.make, model:form.model, year:+form.year } });
      const data = res.data||res;
      if (data.market_stats) {
        setResult(prev=>prev ? { ...prev, market_stats:data.market_stats } : { market_stats:data.market_stats });
        setMarketSavedMsg(`${data.market_stats.count||0} listings for ${form.year} ${form.make} ${form.model} saved.`);
      }
    } catch(e) { alert("Error: "+e.message); }
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
      setResult(prev=>prev ? { ...prev, decision:nextDecision } : prev);
      setSellerSaved(true);
      setSections(prev=>({ ...prev, s5:"done" }));
    } catch(e) { alert("Save error: "+e.message); }
    setSellerSaving(false);
  };

  const dm = decisionMeta[result?.decision]||decisionMeta["Pending"];

  const fieldClass = (field) => rtoFields[field] ? inpBlue : inp;
  const selClass   = (field) => rtoFields[field] ? inpBlue : sel;

  const ResultPanel = () => result ? (
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
          <div><p className="text-xs font-medium text-green-700">Max purchase price</p><p className="text-xs text-green-600">10% margin baked in</p></div>
          <p className="text-xl font-semibold text-green-800">{formatINR(result.suggested_purchase_price)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div><p className="text-xs font-medium text-blue-700">Fair value</p><p className="text-xs text-blue-600">What buyer pays</p></div>
          <p className="text-xl font-semibold text-blue-800">{formatINR(result.fair_value)}</p>
        </div>
        {form.seller_asking_price && (
          <div className="flex items-center justify-between py-1.5 border-t border-gray-100">
            <p className="text-xs text-gray-500">Seller asking</p>
            <p className="text-sm font-medium">{formatINR(+form.seller_asking_price)}</p>
          </div>
        )}
        <div className="space-y-1.5 pt-1 border-t border-gray-100">
          {[["Base price",formatINR(result.breakdown?.base_price_used)],["Age",`${result.breakdown?.age_years} years`],["Fuel",form.fuel_type],["KM driven",`${(+form.km_driven/1000).toFixed(0)}k km`]].map(([l,v])=>(
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
          {editEvalData ? "Evaluation updated in history." : `Saved. Record ID: ${savedEvalId}`}
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
      <p className="text-xs text-gray-400 mt-1">Complete sections 1–4 to evaluate.</p>
    </div>
  );

  return (
    <div>
      {editEvalData && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-800 font-medium">Editing evaluation: {editEvalData.make} {editEvalData.model} · {editEvalData.car_reg_no}</p>
          <button onClick={onClearEdit} className="text-xs text-blue-600 border border-blue-300 rounded-lg px-3 py-1 hover:bg-blue-100">New evaluation</button>
        </div>
      )}
      {prefill && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm text-green-800 font-medium">Pre-filled from exchange enquiry: {prefill.customer_name}</p>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
        <div>
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block"></span><span className="text-gray-500">Auto from login</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400 inline-block"></span><span className="text-gray-500">Auto from RTO</span></span>
          </div>

          {/* Section 1 */}
          <AccordionItem number="1" title="Showroom & customer" summary={sections.s1==="done" ? s1Summary : "Branch, evaluator, customer details"} state={sections.s1} onToggle={()=>toggleSection("s1")}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Field label="Branch">
                  <select className={branchName ? inpGreen : sel} value={form.branch} onChange={e=>set("branch",e.target.value)}>
                    <option value="">Select branch</option>
                    {branches.map(b=><option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Sales person / CA">
                  <select className={(!isUsedCarDept || prefill?.ca_name) ? inpGreen : sel} value={form.ca_name} onChange={e=>set("ca_name",e.target.value)}>
                    <option value="">Select sales person</option>
                    {caNames.map(n=><option key={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Evaluator">
                  <select className={employeeName ? inpGreen : sel} value={form.evaluator_name} onChange={e=>set("evaluator_name",e.target.value)}>
                    <option value="">Select evaluator</option>
                    {evaluatorNames.map(n=><option key={n}>{n}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Field label="Customer name">
                  <input className={rtoFields.customer_name ? inpBlue : (prefill?.customer_name ? inpGreen : inp)}
                    value={form.customer_name} onChange={e=>set("customer_name",e.target.value)} placeholder="e.g. Ramesh Kumar"/>
                </Field>
                <Field label="Mobile number" required>
                  <input
                    className={`${rtoFields.customer_mobile ? inpBlue : (prefill?.customer_mobile ? inpGreen : inp)} ${form.customer_mobile&&form.customer_mobile.length<10?"border-red-300":form.customer_mobile.length>=10?"border-green-400":""}`}
                    type="tel" value={form.customer_mobile}
                    onChange={e=>set("customer_mobile",e.target.value.replace(/\D/g,"").slice(0,10))}
                    placeholder="10-digit number" inputMode="numeric"/>
                </Field>
                <Field label="Car reg. no." required>
                  <div className="relative">
                    <input
                      className={`${inp} ${!form.car_reg_no?"border-red-300":"border-green-400"} pr-16`}
                      value={form.car_reg_no}
                      onChange={e=>{
                        let v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
                        if(v.length>4)v=v.slice(0,4)+"-"+v.slice(4);
                        if(v.length>7)v=v.slice(0,7)+"-"+v.slice(7);
                        if(v.length>12)v=v.slice(0,12);
                        set("car_reg_no",v);
                        const cleanLen = v.replace(/-/g,"").length;
                        if(cleanLen >= 9 && cleanLen <= 11) lookupRTO(v);
                      }}
                      placeholder="RJ14-UB-3469" maxLength={12}/>
                    {rtoLoading && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-500">Looking up…</span>}
                    {rtoFound && !rtoLoading && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600">RTO ✓</span>}
                  </div>
                </Field>
              </div>
              <button disabled={!customerReady} onClick={()=>completeSection("s1","s2")}
                className="w-full lg:w-auto px-6 py-3 lg:py-2 rounded-xl lg:rounded-lg bg-orange-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors">
                Continue to car details →
              </button>
            </div>
          </AccordionItem>

          {/* Section 2 */}
          <AccordionItem number="2" title="Car details" summary={s2Summary} state={sections.s2} onToggle={()=>toggleSection("s2")}>
            <div className="space-y-3">
              {rtoFound && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  Blue fields were auto-filled from RTO data. You can edit them if needed.
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label={<span>Make {rtoFields.make && <span className="text-blue-500 text-xs">RTO</span>}</span>}>
                  <BrandCombobox value={form.make} onChange={v=>set("make",v)}/>
                </Field>
                <Field label="Model">
                  <ModelCombobox brand={form.make} value={form.model} onChange={v=>set("model",v)}/>
                </Field>
                <Field label={<span>Variant {rtoFields.variant && <span className="text-blue-500 text-xs">RTO</span>}</span>}>
                  <input className={fieldClass("variant")} value={form.variant} onChange={e=>set("variant",e.target.value)} placeholder="e.g. ZXI+"/>
                </Field>
                <Field label="Year">
                  <select className={sel} value={form.year} onChange={e=>set("year",+e.target.value)}>
                    {YEARS.map(y=><option key={y}>{y}</option>)}
                  </select>
                </Field>
                <Field label="KM driven">
                  <input className={inp} type="number" value={form.km_driven} onChange={e=>set("km_driven",e.target.value)} inputMode="numeric"/>
                </Field>
                <Field label={<span>Colour {rtoFields.colour && <span className="text-blue-500 text-xs">RTO</span>}</span>}>
                  <select className={selClass("colour")} value={form.colour} onChange={e=>set("colour",e.target.value)}>
                    {COLORS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label={<span>Fuel type {rtoFields.fuel_type && <span className="text-blue-500 text-xs">RTO</span>}</span>}>
                  <select className={selClass("fuel_type")} value={form.fuel_type} onChange={e=>set("fuel_type",e.target.value)}>
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
                    <option value={1}>1st owner</option><option value={2}>2nd owner</option>
                    <option value={3}>3rd owner</option><option value={4}>4th owner+</option>
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

          {/* Section 3 */}
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
                          <input type="checkbox" checked={checked} onChange={e=>setConditionCheck(c.id, e.target.checked)} className="w-5 h-5 lg:w-4 lg:h-4 rounded accent-orange-500"/>
                          <div>
                            <p className={`text-sm lg:text-xs font-medium ${isProblem?"text-red-700":"text-green-700"}`}>{c.name}</p>
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

          {/* Section 4 */}
          <AccordionItem number="4" title="Evaluate price" summary={autoSaved?"Evaluation complete":"Calculate and auto-save evaluation"} state={sections.s4} onToggle={()=>toggleSection("s4")}>
            <div className="space-y-3">
              <button onClick={evaluate} disabled={loading||autoSaving}
                className="w-full py-4 lg:py-3 rounded-xl lg:rounded-lg bg-orange-500 text-white text-base lg:text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors shadow-sm">
                {loading?"Calculating…":autoSaving?"Saving evaluation…":"Evaluate price"}
              </button>
              {autoSaved && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{autoSaveMsg}</p>}
              {!autoSaved && <p className="text-xs text-gray-500">This step creates the record in history immediately.</p>}
            </div>
          </AccordionItem>

          {/* Mobile result panel */}
          {result && (
            <div className="lg:hidden mt-3 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Evaluation result</p>
              <ResultPanel/>
              {marketSavedMsg && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">{marketSavedMsg}</p>}
            </div>
          )}

          {/* Section 5 */}
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
                className={`w-full lg:w-auto px-6 py-3 lg:py-2 rounded-xl lg:rounded-lg text-sm font-semibold transition-colors ${savedEvalId?"bg-gray-900 text-white hover:bg-gray-800":"bg-gray-200 text-gray-500 cursor-not-allowed"}`}>
                {sellerSaving?"Saving seller details…":"Save seller details"}
              </button>
              {!savedEvalId && <p className="text-xs text-gray-500">Evaluate price first to create the row.</p>}
              {sellerSaved && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Seller details updated. Decision recalculated.</p>}
            </div>
          </AccordionItem>

          {marketSavedMsg && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">{marketSavedMsg}</p>}
        </div>

        {/* Desktop sticky result panel */}
        <div className="hidden lg:block lg:sticky lg:top-4">
          <ResultPanel/>
          {marketSavedMsg && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">{marketSavedMsg}</p>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXCHANGE ENQUIRIES PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function ExchangePage({ onEvaluate }) {
  const [walkins, setWalkins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWalkins(); }, []);

  const loadWalkins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('showroom_walkins')
        .select(`
          id, customer_name, mobile_number, created_at, evaluated_at,
          salesperson_id,
          salesperson:salesperson_id ( first_name, last_name ),
          location:location_id ( name )
        `)
        .eq('is_exchange_enquiry', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setWalkins(data || []);
    } catch(e) { console.error('Error loading walkins:', e.message); }
    setLoading(false);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  };

  const pending   = walkins.filter(w => !w.evaluated_at);
  const evaluated = walkins.filter(w => w.evaluated_at);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Exchange enquiries</h2>
          <p className="text-xs text-gray-400 mt-0.5">Walkin customers who want to exchange their car</p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">{pending.length} pending</span>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">{evaluated.length} evaluated</span>
        </div>
      </div>

      {walkins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🔄</div>
          <p className="font-medium">No exchange enquiries yet</p>
          <p className="text-sm mt-1">Exchange walkins will appear here automatically</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {pending.length > 0 && (
            <>
              <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 text-xs font-semibold text-orange-700 uppercase tracking-wider">Pending evaluation</div>
              {pending.map(w => {
                const spName = w.salesperson ? `${w.salesperson.first_name||""} ${w.salesperson.last_name||""}`.trim() : "";
                const locationName = w.location?.name || "";
                return (
                  <div key={w.id} className="flex items-center px-4 py-3 border-b border-gray-50 gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">{getInitials(w.customer_name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{w.customer_name || "Unknown"}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {w.mobile_number && `+91 ${w.mobile_number}`}
                        {spName && ` · SA: ${spName}`}
                        {locationName && ` · ${locationName}`}
                        {` · ${new Date(w.created_at).toLocaleDateString("en-IN", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}`}
                      </p>
                    </div>
                    <button
                      onClick={() => onEvaluate({ id: w.id, customer_name: w.customer_name, mobile_number: w.mobile_number, salesperson_name: spName, location_name: locationName })}
                      className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                      Evaluate →
                    </button>
                  </div>
                );
              })}
            </>
          )}
          {evaluated.length > 0 && (
            <>
              <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-xs font-semibold text-green-700 uppercase tracking-wider">Already evaluated</div>
              {evaluated.map(w => {
                const spName = w.salesperson ? `${w.salesperson.first_name||""} ${w.salesperson.last_name||""}`.trim() : "";
                return (
                  <div key={w.id} className="flex items-center px-4 py-3 border-b border-gray-50 gap-3 opacity-55">
                    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-green-700 font-semibold text-xs flex-shrink-0">{getInitials(w.customer_name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{w.customer_name || "Unknown"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {w.mobile_number && `+91 ${w.mobile_number}`}
                        {spName && ` · SA: ${spName}`}
                        {` · ${new Date(w.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}`}
                      </p>
                    </div>
                    <span className="flex-shrink-0 bg-green-100 text-green-700 text-xs font-medium px-3 py-1.5 rounded-lg">Evaluated ✓</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
      <p className="text-xs text-gray-400 px-1">Once evaluated, the row is greyed out. The full record is in the History tab.</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HISTORY PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryPage({ onEditEval }) {
  const [evals, setEvals] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [priceModal, setPriceModal] = useState(null);
  const [priceForm, setPriceForm] = useState({ seller_asking_price:"", offered_price:"", notes:"" });
  const [savingPrices, setSavingPrices] = useState(false);
  const [waModal, setWaModal] = useState(null);
  const [editEvalModal, setEditEvalModal] = useState(null);

  const loadEvals = () => {
    Promise.all([CarEvaluation.list(), ConditionCheck.list()])
      .then(([data, conds]) => {
        setEvals(data.sort((a,b)=>new Date(b.eval_date||b.created_date)-new Date(a.eval_date||a.created_date)));
        setConditions(conds);
        setLoading(false);
      }).catch(()=>setLoading(false));
  };

  useEffect(() => { loadEvals(); }, []);

  const updateStatus = async (id, status) => {
    setSavingStatus(true);
    await CarEvaluation.update(id, { lead_status:status });
    setEvals(prev=>prev.map(e=>e.id===id?{...e,lead_status:status}:e));
    setSavingStatus(false);
  };

  const openPriceModal = (ev) => {
    setPriceForm({ seller_asking_price: ev.seller_asking_price || "", offered_price: ev.offered_price || "", notes: ev.notes || "" });
    setPriceModal(ev);
  };

  const savePrices = async () => {
    if (!priceModal) return;
    setSavingPrices(true);
    try {
      const sellerAsking = priceForm.seller_asking_price ? +priceForm.seller_asking_price : null;
      const newDecision = getDecision(sellerAsking, priceModal.suggested_purchase_price);
      const payload = { seller_asking_price: sellerAsking, offered_price: priceForm.offered_price ? +priceForm.offered_price : null, notes: priceForm.notes, decision: newDecision };
      await CarEvaluation.update(priceModal.id, payload);
      setEvals(prev=>prev.map(e=>e.id===priceModal.id?{...e,...payload}:e));
      setPriceModal(null);
    } catch(e) { alert("Save error: "+e.message); }
    setSavingPrices(false);
  };

  const sendWhatsApp = (ev) => {
    const mobile = ev.customer_mobile?.replace(/\D/g,"");
    if (!mobile) { alert("No customer mobile number on record."); return; }
    const msg = buildWhatsAppMessage(ev, conditions);
    window.open(`https://wa.me/91${mobile}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const confirmOpenEditEval = () => {
    if (!editEvalModal) return;
    onEditEval(editEvalModal);
    setEditEvalModal(null);
  };

  const filtered = evals.filter(e=>
    (decisionFilter==="All"||e.decision===decisionFilter) &&
    (statusFilter==="All"||(e.lead_status||"Pending")===statusFilter) &&
    (!search||`${e.make} ${e.model} ${e.variant||""} ${e.customer_name||""} ${e.car_reg_no||""}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search car, customer, reg no…"
          className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 self-center">Deal:</span>
          {["All","Good Deal","Fair Deal","Overpriced"].map(f=>(
            <button key={f} onClick={()=>setDecisionFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${decisionFilter===f?"bg-orange-500 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{f}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 self-center">Status:</span>
          {["All",...LEAD_STATUSES].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter===s?"bg-gray-800 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length===0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <p className="font-medium">No evaluations found</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
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
                        <div><span className="text-gray-400">Offered</span><p className="font-medium">{formatINR(ev.offered_price)||"—"}</p></div>
                      </div>
                      <div><Badge label={ev.decision||"Pending"} className={dm.badge}/></div>
                      <div className="flex flex-wrap gap-1.5">
                        {LEAD_STATUSES.map(s=>(
                          <button key={s} onClick={()=>updateStatus(ev.id,s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${(ev.lead_status||"Pending")===s?leadMeta[s]+" border-transparent":"bg-white text-gray-500 border-gray-200"}`}>{s}</button>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={()=>openPriceModal(ev)} className="flex-1 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50">Edit prices</button>
                        <button onClick={()=>setEditEvalModal(ev)} className="flex-1 py-2 rounded-lg border border-blue-200 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100">Edit evaluation</button>
                        <button onClick={()=>setWaModal(ev)} className="flex-1 py-2 rounded-lg border border-green-200 text-xs text-green-700 bg-green-50 hover:bg-green-100">WhatsApp</button>
                      </div>
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
                    {["Car","Reg No.","Customer","Date","Buy at","Deal","Status","Actions"].map(h=>(
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
                        <td className="px-4 py-3 font-semibold text-green-700">{formatINR(ev.suggested_purchase_price)}</td>
                        <td className="px-4 py-3"><Badge label={ev.decision||"Pending"} className={dm.badge}/></td>
                        <td className="px-4 py-3">
                          <select value={ls} onChange={e=>updateStatus(ev.id,e.target.value)} disabled={savingStatus}
                            className={`text-xs font-medium px-2 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400 ${leadMeta[ls]}`}>
                            {LEAD_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={()=>openPriceModal(ev)} className="text-xs border border-gray-200 hover:bg-gray-50 text-gray-600 px-2 py-1 rounded-lg">Edit prices</button>
                            <button onClick={()=>setEditEvalModal(ev)} className="text-xs border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">Edit eval</button>
                            <button onClick={()=>setWaModal(ev)} className="text-xs border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1 rounded-lg">WA</button>
                          </div>
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

      {/* Edit prices modal */}
      {priceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setPriceModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Edit prices &amp; notes</h3>
                <p className="text-xs text-gray-400 mt-1">{priceModal.make} {priceModal.model} · {priceModal.car_reg_no}</p>
                <p className="text-xs text-blue-600 mt-1">Saving will recalculate the deal decision automatically.</p>
              </div>
              <button onClick={()=>setPriceModal(null)} className="text-gray-400 hover:text-gray-600 ml-4 text-xl">×</button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Seller asking price (₹)</label>
                <input type="number" value={priceForm.seller_asking_price} onChange={e=>setPriceForm(f=>({...f,seller_asking_price:e.target.value}))}
                  className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="e.g. 450000"/>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Our offered price (₹)</label>
                <input type="number" value={priceForm.offered_price} onChange={e=>setPriceForm(f=>({...f,offered_price:e.target.value}))}
                  className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="e.g. 380000"/>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <textarea value={priceForm.notes} onChange={e=>setPriceForm(f=>({...f,notes:e.target.value}))} rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" placeholder="Any observations…"/>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={savePrices} disabled={savingPrices}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-50">
                {savingPrices?"Saving…":"Save & recalculate"}
              </button>
              <button onClick={()=>setPriceModal(null)} className="px-5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp preview modal */}
      {waModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setWaModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Send on WhatsApp</h3>
                <p className="text-xs text-gray-400 mt-1">{waModal.customer_mobile ? `Sending to +91 ${waModal.customer_mobile}` : "No mobile number on record"}</p>
              </div>
              <button onClick={()=>setWaModal(null)} className="text-gray-400 hover:text-gray-600 ml-4 text-xl">×</button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-xs leading-relaxed whitespace-pre-line text-gray-700 font-mono border border-gray-100">
              {buildWhatsAppMessage(waModal, conditions)}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>sendWhatsApp(waModal)} disabled={!waModal.customer_mobile}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-xl flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Open WhatsApp
              </button>
              <button onClick={()=>setWaModal(null)} className="px-5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit evaluation confirmation modal */}
      {editEvalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setEditEvalModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Edit full evaluation</h3>
                <p className="text-xs text-gray-500 mt-1">This will open the full 5-step evaluate form with saved details pre-filled.</p>
                <p className="text-xs text-gray-500 mt-1">Saving there will update this same history record (no duplicate).</p>
              </div>
              <button onClick={()=>setEditEvalModal(null)} className="text-gray-400 hover:text-gray-600 ml-4 text-xl">×</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs text-blue-700">{editEvalModal.make} {editEvalModal.model} {editEvalModal.variant ? `(${editEvalModal.variant})` : ""} · {editEvalModal.car_reg_no || "—"}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmOpenEditEval} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-xl">Open full form</button>
              <button onClick={()=>setEditEvalModal(null)} className="px-5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsPage() {
  const [activeTab, setActiveTab] = useState("sources");
  const tabs = [
    { id:"sources",      label:"Data sources" },
    { id:"conditions",   label:"Conditions" },
    { id:"exshowroom",   label:"Base prices" },
    { id:"depreciation", label:"Depreciation" },
  ];
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 flex overflow-x-auto">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-1 lg:flex-none ${activeTab===t.id?"border-orange-500 text-orange-600":"border-transparent text-gray-500 hover:text-gray-700"}`}>
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