import React, { useState, useEffect } from 'react';
import { fetchAllBrands, fetchModelsByBrand, addCustomBrand, addCustomModel } from '@/api/backendFunctions';

/**
 * BrandCombobox
 * Searchable dropdown for selecting car brands.
 * Shows all predefined brands + custom brands from database.
 * Allows adding new custom brands.
 */
export function BrandCombobox({ value, onChange, placeholder = 'Search or add brand...' }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  // Fetch all brands on mount
  useEffect(() => {
    const loadBrands = async () => {
      setLoading(true);
      try {
        const allBrands = await fetchAllBrands();
        setBrands(allBrands);
      } catch (error) {
        console.error('Failed to load brands:', error);
      } finally {
        setLoading(false);
      }
    };
    loadBrands();
  }, []);

  const normalizedDraft = draft.trim();
  const isNewBrand =
    normalizedDraft &&
    !brands.some(b => b.toLowerCase() === normalizedDraft.toLowerCase());

  const handleAddBrand = async () => {
    if (!normalizedDraft) return;
    setAdding(true);
    try {
      const newBrand = await addCustomBrand(normalizedDraft);
      setBrands(prev => [...new Set([...prev, newBrand])].sort());
      onChange(newBrand);
      setDraft(newBrand);
    } catch (error) {
      console.error('Failed to add brand:', error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <select
        className="w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900"
        value={value || ''}
        onChange={e => {
          onChange(e.target.value);
          setDraft(e.target.value);
        }}
        disabled={loading}
      >
        <option value="">{loading ? 'Loading brands...' : 'Select brand'}</option>
        {brands.map(brand => (
          <option key={brand} value={brand}>{brand}</option>
        ))}
      </select>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900"
          list="brand-options"
        />
        {isNewBrand && (
          <button
            type="button"
            onClick={handleAddBrand}
            disabled={adding}
            className="h-11 lg:h-9 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium whitespace-nowrap disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        )}
      </div>

      <datalist id="brand-options">
        {brands.map(brand => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
    </div>
  );
}

/**
 * ModelCombobox
 * Searchable dropdown for selecting car models within a brand.
 * Shows predefined + custom models for the selected brand.
 * Allows adding new custom models.
 * Includes fallback text input for manual entry if needed.
 */
export function ModelCombobox({
  brand,
  value,
  onChange,
  placeholder = 'Search or add model...',
  allowCustomInput = true,
}) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  // Fetch models for the brand whenever brand changes
  useEffect(() => {
    if (!brand) {
      setModels([]);
      setLoading(false);
      return;
    }

    const loadModels = async () => {
      setLoading(true);
      try {
        const brandModels = await fetchModelsByBrand(brand);
        setModels(brandModels);
      } catch (error) {
        console.error(`Failed to load models for brand ${brand}:`, error);
        setModels([]);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [brand]);

  const normalizedDraft = draft.trim();
  const isNewModel =
    normalizedDraft &&
    !models.some(m => m.toLowerCase() === normalizedDraft.toLowerCase());

  const handleAddModel = async () => {
    if (!normalizedDraft || !brand) return;
    setAdding(true);
    try {
      const newModel = await addCustomModel(brand, normalizedDraft);
      setModels(prev => [...new Set([...prev, newModel])].sort());
      onChange(newModel);
      setDraft(newModel);
    } catch (error) {
      console.error('Failed to add model:', error);
    } finally {
      setAdding(false);
    }
  };

  if (!brand) {
    return (
      <input
        type="text"
        disabled
        placeholder="Select a brand first"
        className="w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs bg-gray-50 text-gray-400 cursor-not-allowed"
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <select
        className="w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900"
        value={value || ''}
        onChange={e => {
          onChange(e.target.value);
          setDraft(e.target.value);
        }}
        disabled={loading}
      >
        <option value="">{loading ? 'Loading models...' : 'Select model'}</option>
        {models.map(model => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>

      {allowCustomInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              onChange(e.target.value);
            }}
            placeholder={placeholder}
            className="w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900"
            list="model-options"
          />
          {isNewModel && (
            <button
              type="button"
              onClick={handleAddModel}
              disabled={adding}
              className="h-11 lg:h-9 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium whitespace-nowrap disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          )}
        </div>
      )}

      <datalist id="model-options">
        {models.map(model => (
          <option key={model} value={model} />
        ))}
      </datalist>

      {!loading && models.length === 0 && (
        <p className="text-xs text-gray-400">No preset models found for this brand. You can type one manually.</p>
      )}
    </div>
  );
}
