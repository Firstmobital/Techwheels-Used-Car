import { useState, useEffect } from "react";
import { CustomDepreciation } from "@/api/entities";
import { MAKES, MODELS_BY_MAKE } from "@/utils/carConstants";
import { BrandCombobox, ModelCombobox } from "./BrandModelCombobox";

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

export default function DepreciationManager() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    make: "Maruti",
    model: "",
    fuel_type: "",
    transmission: "",
    depreciation_percent_per_year: 10,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = () => {
    setLoading(true);
    CustomDepreciation.list()
      .then(data => {
        setRules(data.sort((a, b) => `${a.make}${a.model}`.localeCompare(`${b.make}${b.model}`)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const saveRule = async () => {
    if (!form.make) return;
    setSaving(true);
    const data = {
      ...form,
      depreciation_percent_per_year: Number(form.depreciation_percent_per_year),
    };
    if (editingId) {
      await CustomDepreciation.update(editingId, data);
    } else {
      await CustomDepreciation.create(data);
    }
    setSaving(false);
    cancelForm();
    loadRules();
  };

  const startEdit = (rule) => {
    setForm({
      make: rule.make,
      model: rule.model || "",
      fuel_type: rule.fuel_type || "",
      transmission: rule.transmission || "",
      depreciation_percent_per_year: rule.depreciation_percent_per_year,
      is_active: rule.is_active !== false,
    });
    setEditingId(rule.id);
    setShowForm(true);
  };

  const deleteRule = async (id) => {
    await CustomDepreciation.delete(id);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      make: "Maruti",
      model: "",
      fuel_type: "",
      transmission: "",
      depreciation_percent_per_year: 10,
      is_active: true,
    });
  };

  const filtered = rules.filter(r =>
    !search || `${r.make} ${r.model} ${r.fuel_type} ${r.transmission}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">📊 Custom Depreciation Rates</h2>
          <p className="text-xs text-gray-400 mt-0.5">Set brand-specific depreciation rates based on make, model, fuel type, and transmission</p>
        </div>
        <button
          onClick={() => {
            cancelForm();
            setShowForm(true);
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow"
        >
          + Add Rule
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-5 space-y-4">
          <p className="font-semibold text-gray-700">{editingId ? "Edit Rule" : "New Depreciation Rule"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Make *</label>
              <BrandCombobox value={form.make} onChange={v => setForm(f => ({ ...f, make: v, model: "" }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Model (optional)</label>
              <ModelCombobox brand={form.make} value={form.model} onChange={v => setForm(f => ({ ...f, model: v }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Fuel Type (optional)</label>
              <select
                value={form.fuel_type}
                onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}
                className={inp}
              >
                <option value="">All Fuel Types</option>
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="CNG">CNG</option>
                <option value="Electric">Electric</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Transmission (optional)</label>
              <select
                value={form.transmission}
                onChange={e => setForm(f => ({ ...f, transmission: e.target.value }))}
                className={inp}
              >
                <option value="">All Transmissions</option>
                <option value="Manual">Manual</option>
                <option value="Automatic">Automatic</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Annual Depreciation Rate (%) *</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={0.5}
                  value={form.depreciation_percent_per_year}
                  onChange={e => setForm(f => ({ ...f, depreciation_percent_per_year: Number(e.target.value) }))}
                  className="flex-1 accent-orange-500"
                />
                <span className="w-20 text-center font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg py-2 text-sm">
                  {form.depreciation_percent_per_year.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Percentage depreciation per year of age</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={saveRule}
              disabled={saving || !form.make}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-all"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Rule"}
            </button>
            <button
              onClick={cancelForm}
              className="border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔎 Search make, model, fuel type, transmission..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400 border border-gray-100">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-medium">{search ? "No rules found" : "No depreciation rules yet"}</p>
          <p className="text-sm mt-1">Click "+ Add Rule" to create brand-specific depreciation rates</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Make", "Model", "Fuel Type", "Transmission", "Annual Rate", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800">{rule.make}</td>
                  <td className="px-4 py-3 text-gray-600">{rule.model || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{rule.fuel_type || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{rule.transmission || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 font-bold text-orange-600">{rule.depreciation_percent_per_year.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${rule.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {rule.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(rule)} className="text-xs text-blue-500 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => deleteRule(rule.id)} className="text-xs text-red-400 hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 text-xs text-orange-700">
        <strong>How it works:</strong> When evaluating a car, the system looks for the most specific matching rule. For example, if you have rules for "Toyota" (10% per year) and "Toyota Diesel Automatic" (8% per year), a Toyota Diesel with Automatic transmission will use 8%. If no rule matches, the system falls back to default depreciation rates.
      </div>
    </div>
  );
}