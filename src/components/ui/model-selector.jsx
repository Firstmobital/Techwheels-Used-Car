import { useState, useEffect } from 'react';
import { fetchModelsForMake } from '../../utils/modelFetcher';

const sel = "w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900";
const inp = "w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900";

/**
 * ModelSelector Component
 * Displays both a dropdown with available models and a text input for manual entry.
 * 
 * Props:
 * - make: {string} The selected car make/brand
 * - model: {string} The current model value
 * - onChange: {function} Callback when model is changed (receives updated model value)
 * - placeholder: {string} Placeholder text for the input field (optional)
 * - onModelsLoaded: {function} Callback when models are loaded (optional)
 */
export default function ModelSelector({ make, model, onChange, placeholder = "Or enter manually", onModelsLoaded }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!make) {
      setModels([]);
      return;
    }

    setLoading(true);
    fetchModelsForMake(make).then(fetchedModels => {
      setModels(fetchedModels);
      if (onModelsLoaded) onModelsLoaded(fetchedModels);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load models:', err);
      setLoading(false);
    });
  }, [make, onModelsLoaded]);

  return (
    <div className="flex flex-col gap-2">
      {/* Dropdown for selecting from available models */}
      <select 
        className={sel} 
        value={model} 
        onChange={e => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">Select a model</option>
        {models.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      {/* Manual entry field */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Or enter manually:</label>
        <input 
          className={inp} 
          value={model} 
          onChange={e => onChange(e.target.value)} 
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
