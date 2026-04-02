import React, { useState, useEffect } from 'react';
import { fetchAllBrands, fetchModelsByBrand, addCustomBrand, addCustomModel } from '@/api/backendFunctions';

const inputStyle = "w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900";

/**
 * BrandCombobox
 * Toggle between dropdown selection and manual text input
 * @param {Object} props
 * @param {string} props.value
 * @param {function} props.onChange
 * @param {string} props.placeholder
 */
/**
 * @param {Object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder]
 */
export function BrandCombobox({ value, onChange, placeholder = 'Enter brand name' }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [useManual, setUseManual] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const loadBrands = async () => {
      setLoading(true);
      try {
        const allBrands = await fetchAllBrands();
        // @ts-expect-error - useState type inference limitation
        setBrands(allBrands);
      } catch (error) {
        console.error('Failed to load brands:', error);
      } finally {
        setLoading(false);
      }
    };
    loadBrands();
  }, []);

  const isNewBrand = value && !brands.some(
    // @ts-expect-error - useState type inference limitation
    b => b.toLowerCase() === value.toLowerCase()
  );

  const handleAddBrand = async () => {
    if (!value.trim()) return;
    setAdding(true);
    try {
      const newBrand = await addCustomBrand(value.trim());
      // @ts-expect-error
      setBrands(prev => [...new Set([...prev, newBrand])].sort());
    } catch (error) {
      console.error('Failed to add brand:', error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-1">
      {!useManual ? (
        <div className="flex items-center gap-2">
          <select
            className={inputStyle}
            value={value || ''}
            onChange={e => {
              onChange(e.target.value);
              setUseManual(false);
            }}
            disabled={loading}
          >
            <option value="">{loading ? 'Loading...' : 'Select brand'}</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setUseManual(true)}
            className="text-orange-500 hover:text-orange-600 text-xs font-medium whitespace-nowrap"
          >
            Type manually
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputStyle}
          />
          <button
            type="button"
            onClick={() => setUseManual(false)}
            className="text-orange-500 hover:text-orange-600 text-xs font-medium whitespace-nowrap"
          >
            Pick from list
          </button>
          {isNewBrand && (
            <button
              type="button"
              onClick={handleAddBrand}
              disabled={adding}
              className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium whitespace-nowrap disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ModelCombobox
 * Toggle between dropdown selection and manual text input
 * @param {Object} props
 * @param {string} props.brand
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder]
 */
export function ModelCombobox({
  brand,
  value,
  onChange,
  placeholder = 'Enter model name',
}) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [useManual, setUseManual] = useState(false);
  const [adding, setAdding] = useState(false);

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
        if (brandModels.length === 0) setUseManual(true);
      } catch (error) {
        console.error(`Failed to load models for brand ${brand}:`, error);
        setModels([]);
        setUseManual(true);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [brand]);

  const isNewModel = value && !models.some(
    // @ts-expect-error - useState type inference limitation
    m => m.toLowerCase() === value.toLowerCase()
  );

  const handleAddModel = async () => {
    if (!value.trim() || !brand) return;
    setAdding(true);
    try {
      const newModel = await addCustomModel(brand, value.trim());
      // @ts-expect-error
      setModels(prev => [...new Set([...prev, newModel])].sort());
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
        className={`${inputStyle} bg-gray-50 text-gray-400 cursor-not-allowed`}
      />
    );
  }

  return (
    <div className="space-y-1">
      {!useManual ? (
        <div className="flex items-center gap-2">
          <select
            className={inputStyle}
            value={value || ''}
            onChange={e => {
              onChange(e.target.value);
              setUseManual(false);
            }}
            disabled={loading}
          >
            <option value="">{loading ? 'Loading...' : 'Select model'}</option>
            {models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setUseManual(true)}
            className="text-orange-500 hover:text-orange-600 text-xs font-medium whitespace-nowrap"
          >
            Type manually
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputStyle}
          />
          {models.length > 0 && (
            <button
              type="button"
              onClick={() => setUseManual(false)}
              className="text-orange-500 hover:text-orange-600 text-xs font-medium whitespace-nowrap"
            >
              Pick from list
            </button>
          )}
          {isNewModel && (
            <button
              type="button"
              onClick={handleAddModel}
              disabled={adding}
              className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium whitespace-nowrap disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
