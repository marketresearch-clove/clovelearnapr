-- Migration: Add automatic template deactivation trigger
-- Purpose: When a certificate template is activated (is_active = true),
--          automatically deactivate all other templates to ensure only one is active

-- Create function to handle automatic deactivation
CREATE OR REPLACE FUNCTION enforce_single_active_template()
RETURNS TRIGGER AS $$
BEGIN
  -- If the template being updated is being set to active
  IF NEW.is_active = true AND OLD.is_active = false THEN
    -- Deactivate all other templates
    UPDATE certificate_templates
    SET is_active = false, updated_at = NOW()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_single_active_template_trigger ON certificate_templates;

-- Create trigger to enforce single active template
CREATE TRIGGER enforce_single_active_template_trigger
BEFORE UPDATE ON certificate_templates
FOR EACH ROW
EXECUTE FUNCTION enforce_single_active_template();

-- Add comment for documentation
COMMENT ON FUNCTION enforce_single_active_template() IS 
'Ensures only one certificate template is active at a time. When a template is activated, 
all other templates are automatically deactivated.';

COMMENT ON TRIGGER enforce_single_active_template_trigger ON certificate_templates IS
'Triggers on UPDATE to enforce single active certificate template policy';
