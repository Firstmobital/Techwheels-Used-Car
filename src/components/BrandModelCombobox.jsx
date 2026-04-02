import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAllBrands, fetchModelsByBrand, addCustomBrand, addCustomModel } from '@/api/backendFunctions';

/**
 * BrandCombobox
 * Searchable dropdown for selecting car brands.
 * Shows all predefined brands + custom brands from database.
 * Allows adding new custom brands.
 */
export function BrandCombobox({ value, onChange, placeholder = 'Search or add brand...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

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

  // Filter brands based on search
  const filteredBrands = brands.filter(b =>
    b.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search term is a new brand that doesn't exist
  const isNewBrand = search.trim() && !brands.some(b => b.toLowerCase() === search.toLowerCase());

  const handleAddBrand = async () => {
    if (!search.trim()) return;
    setAdding(true);
    try {
      const newBrand = await addCustomBrand(search.trim());
      setBrands(prev => [...new Set([...prev, newBrand])].sort());
      onChange(newBrand);
      setSearch('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to add brand:', error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-11 lg:h-9 justify-between px-3 text-sm lg:text-xs bg-white"
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0">
        <Command shouldFilter={false} className="w-full">
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList className="max-h-[200px]">
            {loading ? (
              <CommandEmpty>Loading brands...</CommandEmpty>
            ) : filteredBrands.length === 0 && !isNewBrand ? (
              <CommandEmpty>No brands found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredBrands.map(brand => (
                  <CommandItem
                    key={brand}
                    value={brand}
                    onSelect={() => {
                      onChange(brand);
                      setSearch('');
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === brand ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {brand}
                  </CommandItem>
                ))}

                {/* "Add new brand" option */}
                {isNewBrand && (
                  <>
                    <CommandItem
                      value="add-new"
                      onSelect={handleAddBrand}
                      className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-900"
                      disabled={adding}
                    >
                      <span className="text-sm">
                        {adding ? '...' : `+ Add new brand: "${search.trim()}"`}
                      </span>
                    </CommandItem>
                  </>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);

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

  // If no predefined models for the brand, show manual input by default
  useEffect(() => {
    if (models.length === 0 && brand) {
      setUseManualInput(true);
    }
  }, [models, brand]);

  // Filter models based on search
  const filteredModels = models.filter(m =>
    m.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search term is a new model that doesn't exist
  const isNewModel = search.trim() && !models.some(m => m.toLowerCase() === search.toLowerCase());

  const handleAddModel = async () => {
    if (!search.trim() || !brand) return;
    setAdding(true);
    try {
      const newModel = await addCustomModel(brand, search.trim());
      setModels(prev => [...new Set([...prev, newModel])].sort());
      onChange(newModel);
      setSearch('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to add model:', error);
    } finally {
      setAdding(false);
    }
  };

  const handleManualInput = (e) => {
    onChange(e.target.value);
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

  // Show manual input if there are no predefined models for this brand
  if (useManualInput && models.length === 0) {
    return (
      <div className="space-y-1.5">
        <input
          type="text"
          value={value}
          onChange={handleManualInput}
          placeholder={placeholder}
          className="w-full h-11 lg:h-9 border border-gray-200 rounded-lg px-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-900"
        />
        <p className="text-xs text-gray-400">Models for this brand will appear once available</p>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-11 lg:h-9 justify-between px-3 text-sm lg:text-xs bg-white"
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0">
        <Command shouldFilter={false} className="w-full">
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList className="max-h-[200px]">
            {loading ? (
              <CommandEmpty>Loading models...</CommandEmpty>
            ) : filteredModels.length === 0 && !isNewModel ? (
              <CommandEmpty>No models found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredModels.map(model => (
                  <CommandItem
                    key={model}
                    value={model}
                    onSelect={() => {
                      onChange(model);
                      setSearch('');
                      setOpen(false);
                      setUseManualInput(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === model ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {model}
                  </CommandItem>
                ))}

                {/* "Add new model" option */}
                {isNewModel && (
                  <CommandItem
                    value="add-new"
                    onSelect={handleAddModel}
                    className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-900"
                    disabled={adding}
                  >
                    <span className="text-sm">
                      {adding ? '...' : `+ Add new model: "${search.trim()}"`}
                    </span>
                  </CommandItem>
                )}

                {/* Manual input option */}
                {allowCustomInput && !isNewModel && (
                  <CommandItem
                    value="manual"
                    onSelect={() => setUseManualInput(true)}
                    className="cursor-pointer text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  >
                    <span className="text-sm">Enter model manually...</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
