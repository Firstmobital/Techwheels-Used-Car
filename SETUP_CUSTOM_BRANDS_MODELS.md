# Setup Guide: Custom Brand/Model Dropdowns Implementation

## ✅ Implementation Complete

All code changes have been committed. Before the feature is fully functional, you need to **create the Supabase tables** using the migration script.

---

## 🚀 Next Steps: Database Setup (REQUIRED)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com and sign in
2. Select your Techwheels project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"** button

### Step 2: Run the Migration SQL
1. Open this file: [supabase/migrations/001_create_custom_brands_models.sql](supabase/migrations/001_create_custom_brands_models.sql)
2. **Copy ALL the SQL code** (all 60 lines)
3. Paste it into the Supabase SQL Editor
4. Click **"Run"** to execute

### Step 3: Verify Success
✅ You should see no errors  
✅ You should see "Success" message in green  
✅ Two tables should now exist: `custom_car_brands` and `custom_car_models`

---

## 📋 What the Migration Creates

### Table: `custom_car_brands`
Stores custom car brands added by users
- `id` — UUID primary key
- `brand_name` — Unique brand name (max 255 chars)
- `created_by` — User ID who created it
- `created_at` / `updated_at` — Timestamps

### Table: `custom_car_models`
Stores custom car models for brands
- `id` — UUID primary key
- `brand` — Car brand name (e.g., "Tesla")
- `model_name` — Model name (e.g., "Model 3")
- `created_by` — User ID who created it
- `created_at` / `updated_at` — Timestamps
- Unique constraint on (brand, model_name)

### RLS Policies
- ✅ All authenticated users can **READ** all brands and models
- ✅ Users can only **INSERT** their own entries
- ✅ Prevents data corruption while allowing community contributions

---

## 🎯 Feature Overview

### BrandCombobox Component
Users can now:
1. Click brand field → see searchable dropdown
2. Type to filter brands (e.g., "Maruti" shows only Maruti)
3. Type "Tesla" (not in list) → see "Add new brand: Tesla" option
4. Click "Add new brand: Tesla" → saves to database instantly
5. Close/reopen → "Tesla" appears in dropdown

### ModelCombobox Component
Users can now:
1. Select a brand first
2. Click model field → see searchable dropdown of that brand's models
3. Type to filter models (e.g., "Swift" shows only Swift)
4. Type "XL5" (not in Maruti models) → see "Add new model: XL5" option
5. Click "Add new model: XL5" → saves to database instantly
6. Close/reopen → "XL5" appears in model dropdown for Maruti

### Where It's Used
- ✅ Home.jsx → Car evaluation form (Make & Model fields)
- ✅ ExShowroomPriceManager.jsx → Price management form
- ✅ DepreciationManager.jsx → Depreciation rules form

---

## 🧪 Testing the Feature

After running the SQL migration:

### Test 1: Add Custom Brand
1. Go to Home.jsx → Section 2 "Car details"
2. Click brand field dropdown
3. Type a brand name that doesn't exist (e.g., "Tesla")
4. See "Add new brand: Tesla" option appear in blue
5. Click it → should save (you'll see the button briefly show "...")
6. Close dropdown and reopen → "Tesla" now appears in the list

### Test 2: Add Custom Model
1. Same as Test 1, but select a brand first (e.g., "Maruti")
2. Click model field dropdown
3. Type a model not in Maruti's list (e.g., "XL5")
4. See "Add new model: XL5" option appear
5. Click it → saves to database
6. Close/reopen dropdown → "XL5" shows for Maruti

### Test 3: Cross-Component Sync
1. Add custom brand in Home.jsx
2. Navigate to ExShowroomPriceManager.jsx
3. Click brand dropdown → your custom brand appears there too
4. Navigate to DepreciationManager.jsx
5. Click brand dropdown → custom brand appears there as well

### Test 4: Persistence
1. Add custom brand "Tata Motors"
2. Refresh the page (F5)
3. Click brand dropdown → "Tata Motors" is still there (data persisted!)

---

## 🔧 Technical Details

### Files Changed
**Created:**
- `src/components/BrandModelCombobox.jsx` — Reusable combobox components
- `src/utils/carConstants.js` — Centralized constants
- `supabase/migrations/001_create_custom_brands_models.sql` — Database migration

**Modified:**
- `src/api/entities.js` — Added CustomCarBrand, CustomCarModel entities
- `src/api/backendFunctions.js` — Added 4 helper functions for brand/model management
- `src/pages/Home.jsx` — Replaced make/model selects with new combobox components
- `src/components/ExShowroomPriceManager.jsx` — Replaced make/model logic
- `src/components/DepreciationManager.jsx` — Replaced make/model logic

### API Functions Added
1. **`fetchAllBrands()`** — Gets all brands (predefined + custom)
2. **`fetchModelsByBrand(brand)`** — Gets models for a specific brand
3. **`addCustomBrand(brandName)`** — Saves new custom brand
4. **`addCustomModel(brand, modelName)`** — Saves new custom model

All functions include:
- Error handling with graceful fallback to hardcoded data
- Deduplication (won't add duplicates)
- User ownership tracking (created_by field)

### Data Validation
- Brand/model names: 2-50 characters
- Both tables use UNIQUE constraints
- RLS policies prevent unauthorized access

---

## ⚠️ If Something Goes Wrong

### "Failed to fetch custom brands, using predefined makes"
- This warning is NORMAL if the database tables don't exist yet
- **ACTION:** Run the SQL migration (see "Step 2" above)
- After migration is complete, warning should disappear

### Dropdown shows only predefined brands/models
- Check that Supabase migration was run successfully
- Verify that both tables exist in Supabase SQL Editor
- Check your internet connection (Supabase needs to be reachable)

### "User not authenticated" error
- The user must be logged in to add custom brands/models
- Check AuthContext is properly set up
- Verify user has valid Supabase session

### Custom entries not appearing after adding
- Check Supabase dashboard → `custom_car_brands` and `custom_car_models` tables
- Verify that data was actually inserted (check table contents)
- Check browser console for any error messages
- Try closing/reopening the dropdown or refreshing the page

---

## 📈 Future Enhancements

Possible features for later:
- [ ] Bulk import brands/models from CSV
- [ ] Admin dashboard to review/approve custom entries
- [ ] Edit/delete custom entries (with permission checks)
- [ ] Auto-suggestions based on market data
- [ ] Analytics on which brands/models are most commonly added

---

## 📞 Key Files Reference

| File | Purpose |
|------|---------|
| [src/components/BrandModelCombobox.jsx](src/components/BrandModelCombobox.jsx) | Brand & Model dropdown components |
| [src/utils/carConstants.js](src/utils/carConstants.js) | Centralized constants |
| [src/api/backendFunctions.js](src/api/backendFunctions.js) | Brand/model API functions |
| [src/pages/Home.jsx](src/pages/Home.jsx) | Uses BrandCombobox & ModelCombobox |
| [src/components/ExShowroomPriceManager.jsx](src/components/ExShowroomPriceManager.jsx) | Uses new comboboxes |
| [src/components/DepreciationManager.jsx](src/components/DepreciationManager.jsx) | Uses new comboboxes |
| [supabase/migrations/001_create_custom_brands_models.sql](supabase/migrations/001_create_custom_brands_models.sql) | Database migration SQL |

---

## ✨ Summary

The implementation is **code-complete**. All you need to do is:

1. ✅ **Run the SQL migration** (copy-paste and execute in Supabase)
2. ✅ **Test the feature** (try adding custom brands/models)
3. ✅ **Enjoy!** Users can now search and add custom car brands and models

The feature is already integrated across Home.jsx, ExShowroomPriceManager.jsx, and DepreciationManager.jsx.

---

**Questions?** Check the browser console for detailed error messages or the Supabase dashboard for database issues.
