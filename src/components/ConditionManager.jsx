// @ts-nocheck
import { useState, useEffect } from "react";
import { ConditionCheck } from "@/api/entities";

const DEFAULT_CONDITIONS = [
  { name: "Accident History", description: "Car has been in a past accident", is_negative: true, depreciation_percent: 15, is_active: true },
  { name: "Insurance Valid", description: "Valid insurance document available", is_negative: false, depreciation_percent: 3, is_active: true },
  { name: "Service History Available", description: "Service records from authorized center", is_negative: false, depreciation_percent: 5, is_active: true },
  { name: "AC Working", description: "Air conditioning works properly", is_negative: false, depreciation_percent: 5, is_active: true },
  { name: "Electricals Working", description: "All electrical features functional", is_negative: false, depreciation_percent: 3, is_active: true },
  { name: "RC Clear (No Dues)", description: "No pending challans or dues on RC", is_negative: false, depreciation_percent: 10, is_active: true },
  { name: "Loan Cleared / NOC", description: "Car loan fully paid with NOC", is_negative: false, depreciation_percent: 10, is_active: true },
  { name: "Tyres in Good Condition", description: "Tyres have adequate tread depth", is_negative: false, depreciation_percent: 5, is_active: true },
  { name: "Body Dents / Scratches", description: "Visible dents or paint damage", is_negative: true, depreciation_percent: 5, is_active: true },
  { name: "Engine Oil Leak", description: "Any oil seepage from engine", is_negative: true, depreciation_percent: 8, is_active: true },
  { name: "Suspension Issue", description: "Unusual noise or poor handling", is_negative: true, depreciation_percent: 7, is_active: true },
  { name: "Flood Damaged", description: "Car was submerged/flood exposed", is_negative: true, depreciation_percent: 20, is_active: true },
  { name: "Windshield Crack", description: "Cracked or chipped windshield", is_negative: true, depreciation_percent: 3, is_active: true },
  { name: "Modified / Tampered", description: "Engine or chassis modified", is_negative: true, depreciation_percent: 10, is_active: true },
  { name: "Alloy Wheels Intact", description: "Original alloys in good shape", is_negative: false, depreciation_percent: 2, is_active: true },
  { name: "Music System / Accessories", description: "Aftermarket audio or extras", is_negative: false, depreciation_percent: 0, is_active: true },
  { name: "Spare Tyre Available", description: "Spare tyre with jack and tools", is_negative: false, depreciation_percent: 1, is_active: true },
  { name: "Gear Box Issue", description: "Difficulty shifting or grinding", is_negative: true, depreciation_percent: 12, is_active: true },
  { name: "Rust / Underbody Corrosion", description: "Rust visible on body or underbody", is_negative: true, depreciation_percent: 6, is_active: true },
];

export default function ConditionManager() {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", is_negative: false, depreciation_percent: 5, is_active: true });
  const [showAdd, setShowAdd] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadConditions(); }, []);

  const loadConditions = () => {
    setLoading(true);
    ConditionCheck.list().then(data => {
      setConditions(data.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const seedDefaults = async () => {
    setSeeding(true);
    for (const c of DEFAULT_CONDITIONS) {
      await ConditionCheck.create(c);
    }
    setSeeding(false);
    loadConditions();
    setMsg({ type: "success", text: "Default conditions added!" });
  };

  const saveCondition = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await ConditionCheck.update(editingId, form);
    } else {
      await ConditionCheck.create(form);
    }
    setForm({ name: "", description: "", is_negative: false, depreciation_percent: 5, is_active: true });
    setEditingId(null);
    setShowAdd(false);
    loadConditions();
  };

  const startEdit = (c) => {
    setForm({ name: c.name, description: c.description || "", is_negative: !!c.is_negative, depreciation_percent: c.depreciation_percent || 0, is_active: c.is_active !== false });
    setEditingId(c.id);
    setShowAdd(true);
  };

  const toggleActive = async (c) => {
    await ConditionCheck.update(c.id, { is_active: !c.is_active });
    setConditions(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
  };

  const deleteCondition = async (id) => {
    await ConditionCheck.delete(id);
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  const cancelForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm({ name: "", description: "", is_negative: false, depreciation_percent: 5, is_active: true });
  };

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">⚙️ Condition Checks</h2>
          <p className="text-xs text-gray-400 mt-0.5">Manage car condition parameters and their depreciation impact</p>
        </div>
        <div className="flex gap-2">
          {conditions.length === 0 && (
            <button onClick={seedDefaults} disabled={seeding}
              className="text-sm border border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold px-3 py-2 rounded-lg transition-all">
              {seeding ? "Adding..." : "➕ Load Defaults"}
            </button>
          )}
          <button onClick={() => { cancelForm(); setShowAdd(true); }}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow">
            + Add Condition
          </button>
        </div>
      </div>

      {msg && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium bg-green-100 text-green-700 border border-green-300">
          ✅ {msg.text}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-5 space-y-4">
          <p className="font-semibold text-gray-700">{editingId ? "Edit Condition" : "New Condition"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Condition Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Engine Oil Leak" className={inp} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Description (optional)</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Any oil seepage visible" className={inp} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Depreciation % when bad</label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={30} step={1} value={form.depreciation_percent}
                  onChange={e => setForm(f => ({ ...f, depreciation_percent: +e.target.value }))}
                  className="flex-1 accent-orange-500" />
                <span className="w-14 text-center font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg py-1.5 text-sm">
                  {form.depreciation_percent}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Value deducted when this condition is in bad state</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Checkbox Behaviour</label>
              <div className="flex gap-2">
                <button onClick={() => setForm(f => ({ ...f, is_negative: true }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${form.is_negative ? "bg-red-500 text-white border-red-500" : "bg-white border-gray-200 text-gray-500"}`}>
                  ✅ = Bad (e.g. Accident)
                </button>
                <button onClick={() => setForm(f => ({ ...f, is_negative: false }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${!form.is_negative ? "bg-green-500 text-white border-green-500" : "bg-white border-gray-200 text-gray-500"}`}>
                  ✅ = Good (e.g. AC Works)
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {form.is_negative ? "Checking this box = BAD condition (reduces value)" : "Checking this box = GOOD condition (unchecking reduces value)"}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={saveCondition} disabled={!form.name.trim()}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-all">
              {editingId ? "Save Changes" : "Add Condition"}
            </button>
            <button onClick={cancelForm} className="border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium px-4 py-2 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Conditions List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : conditions.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400 border border-gray-100">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="font-medium">No custom conditions yet</p>
          <p className="text-sm mt-1">Click "Load Defaults" to add common conditions or add your own</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Condition", "Behaviour", "Depreciation", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {conditions.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{c.name}</p>
                    {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.is_negative ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {c.is_negative ? "☑ = Bad" : "☑ = Good"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${c.depreciation_percent > 0 ? "text-orange-600" : "text-gray-400"}`}>
                      {c.depreciation_percent > 0 ? `-${c.depreciation_percent}%` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(c)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border transition-colors ${c.is_active ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"}`}>
                      {c.is_active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(c)} className="text-xs text-blue-500 hover:underline">Edit</button>
                      <button onClick={() => deleteCondition(c.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 text-xs text-orange-700">
        <strong>How it works:</strong> Active conditions appear in the "Evaluate Car" form. When a condition is in bad state, its depreciation % is deducted from the car's calculated value. Changes here instantly reflect in new evaluations.
      </div>
    </div>
  );
}