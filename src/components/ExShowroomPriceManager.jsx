import { useState, useEffect } from "react";
import { ExShowroomPrice } from "@/api/entities";
import ModelSelector from "./ui/model-selector";

const MAKES = ["Maruti", "Hyundai", "Tata", "Honda", "Kia", "Toyota", "Renault", "Nissan", "MG", "Skoda", "Volkswagen", "Ford", "Chevrolet", "Mahindra", "Other"];

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

function formatINR(amount) {
  if (!amount && amount !== 0) return "—";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ExShowroomPriceManager() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ make: "Maruti", model: "", variant: "", ex_showroom_price: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);

  useEffect(() => { loadPrices(); }, []);

  const loadPrices = () => {
    setLoading(true);
    ExShowroomPrice.list().then(data => {
      setPrices(data.sort((a, b) => `${a.make}${a.model}`.localeCompare(`${b.make}${b.model}`)));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const savePrice = async () => {
    if (!form.make || !form.model || !form.ex_showroom_price) return;
    setSaving(true);
    const data = { ...form, ex_showroom_price: Number(form.ex_showroom_price) };
    if (editingId) {
      await ExShowroomPrice.update(editingId, data);
    } else {
      await ExShowroomPrice.create(data);
    }
    setSaving(false);
    cancelForm();
    loadPrices();
  };

  const startEdit = (p) => {
    setForm({ make: p.make, model: p.model, variant: p.variant || "", ex_showroom_price: p.ex_showroom_price });
    setEditingId(p.id);
    setShowForm(true);
  };

  const deletePrice = async (id) => {
    await ExShowroomPrice.delete(id);
    setPrices(prev => prev.filter(p => p.id !== id));
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ make: "Maruti", model: "", variant: "", ex_showroom_price: "" });
  };

  const filtered = prices.filter(p =>
    !search || `${p.make} ${p.model} ${p.variant}`.toLowerCase().includes(search.toLowerCase())
  );

  const downloadCSV = () => {
    const header = "make,model,variant,ex_showroom_price";
    const rows = prices.map(p => `${p.make},${p.model},${p.variant || ""},${p.ex_showroom_price}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ex_showroom_prices.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const text = await file.text();
    const lines = text.trim().split("\n");
    const header = lines[0].toLowerCase().split(",").map(h => h.trim());
    const makeIdx = header.indexOf("make");
    const modelIdx = header.indexOf("model");
    const variantIdx = header.indexOf("variant");
    const priceIdx = header.indexOf("ex_showroom_price");
    if (makeIdx === -1 || modelIdx === -1 || priceIdx === -1) {
      setUploadMsg({ type: "error", text: "CSV must have columns: make, model, variant, ex_showroom_price" });
      setUploading(false);
      e.target.value = "";
      return;
    }
    let successCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const make = cols[makeIdx]; const model = cols[modelIdx];
      const variant = variantIdx !== -1 ? cols[variantIdx] : "";
      const price = Number(cols[priceIdx]);
      if (!make || !model || !price) continue;
      await ExShowroomPrice.create({ make, model, variant, ex_showroom_price: price });
      successCount++;
    }
    setUploadMsg({ type: "success", text: `Imported ${successCount} records successfully.` });
    setUploading(false);
    e.target.value = "";
    loadPrices();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">🏷️ Ex-Showroom Base Prices</h2>
          <p className="text-xs text-gray-400 mt-0.5">Manage ex-showroom prices used for car valuations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadCSV} disabled={prices.length === 0}
            className="border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-600 font-semibold px-4 py-2 rounded-lg text-sm transition-all">
            ⬇️ Download CSV
          </button>
          <label className={`cursor-pointer border border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold px-4 py-2 rounded-lg text-sm transition-all ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            {uploading ? "⏳ Uploading..." : "⬆️ Upload CSV"}
            <input type="file" accept=".csv" className="hidden" onChange={handleUploadCSV} />
          </label>
          <button onClick={() => { cancelForm(); setShowForm(true); }}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow">
            + Add Price
          </button>
        </div>
      </div>

      {uploadMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${uploadMsg.type === "success" ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
          {uploadMsg.type === "success" ? "✅" : "❌"} {uploadMsg.text}
          <span className="ml-2 text-xs opacity-60">CSV format: make, model, variant, ex_showroom_price</span>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-5 space-y-4">
          <p className="font-semibold text-gray-700">{editingId ? "Edit Price" : "Add New Price"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Make *</label>
              <select value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value, model: "" }))} className={inp}>
                {MAKES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Model *</label>
              <ModelSelector
                make={form.make}
                model={form.model}
                onChange={value => setForm(f => ({ ...f, model: value }))}
                placeholder="e.g. Swift"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Variant (optional)</label>
              <input value={form.variant} onChange={e => setForm(f => ({ ...f, variant: e.target.value }))}
                placeholder="e.g. VXI, ZXI+" className={inp} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Ex-Showroom Price (₹) *</label>
              <input type="number" value={form.ex_showroom_price} onChange={e => setForm(f => ({ ...f, ex_showroom_price: e.target.value }))}
                placeholder="e.g. 650000" className={inp} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={savePrice} disabled={saving || !form.make || !form.model || !form.ex_showroom_price}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-all">
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Price"}
            </button>
            <button onClick={cancelForm} className="border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium px-4 py-2 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 Search make, model, variant..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400 border border-gray-100">
          <div className="text-4xl mb-3">🏷️</div>
          <p className="font-medium">{search ? "No results found" : "No prices added yet"}</p>
          <p className="text-sm mt-1">Click "+ Add Price" to add ex-showroom prices for car models</p>
          <p className="text-xs mt-2 text-orange-500">⚠️ Without entries here, calculations will use a default fallback of ₹7,00,000</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Make", "Model", "Variant", "Ex-Showroom Price", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800">{p.make}</td>
                  <td className="px-4 py-3 text-gray-700">{p.model}</td>
                  <td className="px-4 py-3 text-gray-500">{p.variant || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 font-bold text-orange-600">{formatINR(p.ex_showroom_price)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(p)} className="text-xs text-blue-500 hover:underline">Edit</button>
                      <button onClick={() => deletePrice(p.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} price{filtered.length !== 1 ? "s" : ""} • During valuation, the closest matching make+model is used as the base price
          </div>
        </div>
      )}

      <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 text-xs text-orange-700">
        <strong>How it works:</strong> When evaluating a car, the system first looks up the make+model here. If a variant match is found, it's used; otherwise the make+model base price is used. If no entry exists, ₹7,00,000 is used as fallback.
      </div>
    </div>
  );
}