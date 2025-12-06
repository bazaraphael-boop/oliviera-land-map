-- Add paper_form_completed field to hectares table
ALTER TABLE public.hectares 
ADD COLUMN paper_form_completed boolean DEFAULT false;

-- Add paper_form_completed field to parcelles table
ALTER TABLE public.parcelles 
ADD COLUMN paper_form_completed boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.hectares.paper_form_completed IS 'Indicates if the paper form has been completed for this buyer';
COMMENT ON COLUMN public.parcelles.paper_form_completed IS 'Indicates if the paper form has been completed for this buyer';