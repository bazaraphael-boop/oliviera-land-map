-- Enable realtime updates for parcelles table
ALTER TABLE public.parcelles REPLICA IDENTITY FULL;

-- Add parcelles to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcelles;