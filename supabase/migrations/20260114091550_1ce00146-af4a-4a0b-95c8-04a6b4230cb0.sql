-- Create audit_logs table to track access to sensitive PII data
CREATE TABLE public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- System can insert audit logs (via trigger)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create function to log access to hectares table
CREATE OR REPLACE FUNCTION public.log_hectares_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log SELECT operations on hectares with buyer info
    IF TG_OP = 'SELECT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, details)
        VALUES (
            auth.uid(),
            TG_OP,
            'hectares',
            COALESCE(OLD.id, NEW.id),
            jsonb_build_object(
                'buyer_name', COALESCE(OLD.buyer_name, NEW.buyer_name),
                'has_pii', (COALESCE(OLD.buyer_name, NEW.buyer_name) IS NOT NULL)
            )
        );
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Create function to log access to parcelles table
CREATE OR REPLACE FUNCTION public.log_parcelles_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log operations on parcelles with buyer info
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, details)
        VALUES (
            auth.uid(),
            TG_OP,
            'parcelles',
            COALESCE(OLD.id, NEW.id),
            jsonb_build_object(
                'buyer_name', COALESCE(OLD.buyer_name, NEW.buyer_name),
                'has_pii', (COALESCE(OLD.buyer_name, NEW.buyer_name) IS NOT NULL)
            )
        );
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger to log hectares modifications
CREATE TRIGGER audit_hectares_modifications
    AFTER UPDATE OR DELETE ON public.hectares
    FOR EACH ROW
    EXECUTE FUNCTION public.log_hectares_access();

-- Create trigger to log parcelles modifications
CREATE TRIGGER audit_parcelles_modifications
    AFTER UPDATE OR DELETE ON public.parcelles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_parcelles_access();

-- Add index for efficient querying of audit logs
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);