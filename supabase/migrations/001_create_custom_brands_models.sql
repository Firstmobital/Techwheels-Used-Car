-- Supabase SQL Migration: Create custom brands and models tables
-- Run this SQL in your Supabase project's SQL Editor

-- Create custom_car_brands table
CREATE TABLE IF NOT EXISTS custom_car_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_name VARCHAR(255) NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create custom_car_models table
CREATE TABLE IF NOT EXISTS custom_car_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand VARCHAR(255) NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand, model_name)
);

-- Enable RLS (Row Level Security) for custom_car_brands
ALTER TABLE custom_car_brands ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read all brands
CREATE POLICY "anyone_can_read_brands"
  ON custom_car_brands FOR SELECT
  USING (true);

-- Policy: Allow users to insert their own brands
CREATE POLICY "users_can_insert_brands"
  ON custom_car_brands FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Enable RLS for custom_car_models
ALTER TABLE custom_car_models ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read all models
CREATE POLICY "anyone_can_read_models"
  ON custom_car_models FOR SELECT
  USING (true);

-- Policy: Allow users to insert their own models
CREATE POLICY "users_can_insert_models"
  ON custom_car_models FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_car_brands_brand_name 
  ON custom_car_brands(brand_name);

CREATE INDEX IF NOT EXISTS idx_custom_car_models_brand 
  ON custom_car_models(brand);

CREATE INDEX IF NOT EXISTS idx_custom_car_models_brand_model 
  ON custom_car_models(brand, model_name);

-- Optional: View for getting distinct brands (for deduplication query)
CREATE OR REPLACE VIEW v_distinct_brands AS
SELECT DISTINCT brand_name as name FROM custom_car_brands
ORDER BY brand_name;

-- Optional: View for getting distinct models by brand
CREATE OR REPLACE VIEW v_distinct_models_by_brand AS
SELECT DISTINCT brand, model_name as name FROM custom_car_models
ORDER BY brand, model_name;
