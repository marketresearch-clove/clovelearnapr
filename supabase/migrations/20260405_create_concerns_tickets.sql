-- Create concerns_tickets table
CREATE TABLE IF NOT EXISTS public.concerns_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('course-request', 'issue', 'query', 'feedback', 'other')),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_concerns_tickets_user_id ON public.concerns_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_concerns_tickets_status ON public.concerns_tickets(status);
CREATE INDEX IF NOT EXISTS idx_concerns_tickets_category ON public.concerns_tickets(category);
CREATE INDEX IF NOT EXISTS idx_concerns_tickets_created_at ON public.concerns_tickets(created_at DESC);

-- Enable RLS
ALTER TABLE public.concerns_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own concerns
CREATE POLICY "Users can view their own concerns" 
ON public.concerns_tickets FOR SELECT 
USING (auth.uid() = user_id);

-- RLS Policy: Users can create concerns
CREATE POLICY "Users can create concerns" 
ON public.concerns_tickets FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id = auth.uid());

-- RLS Policy: Admins can view all concerns
CREATE POLICY "Admins can view all concerns" 
ON public.concerns_tickets FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- RLS Policy: Admins can update concerns
CREATE POLICY "Admins can update concerns" 
ON public.concerns_tickets FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- Create a trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_concerns_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER concerns_tickets_update_timestamp
BEFORE UPDATE ON public.concerns_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_concerns_tickets_updated_at();
