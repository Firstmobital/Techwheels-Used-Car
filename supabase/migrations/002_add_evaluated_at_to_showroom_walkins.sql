-- Adds evaluated_at timestamp for exchange enquiry workflow
ALTER TABLE public.showroom_walkins
ADD COLUMN IF NOT EXISTS evaluated_at timestamptz;

-- Helps pending/evaluated filters in UI
CREATE INDEX IF NOT EXISTS idx_showroom_walkins_evaluated_at
ON public.showroom_walkins (evaluated_at);
