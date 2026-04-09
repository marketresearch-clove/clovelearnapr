-- Migration: Automatically snapshot enabled certificate signatures on new certificate issuance
-- Date: 2026-04-09

CREATE OR REPLACE FUNCTION snapshot_certificate_signatures_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  enabled_sig RECORD;
  signature_ids TEXT[] := ARRAY[]::TEXT[];
  signature_snapshot JSONB[] := ARRAY[]::JSONB[];
BEGIN
  FOR enabled_sig IN
    SELECT id, name, designation, signature_text, signature_image_url, display_order
    FROM public.certificate_signature_settings
    WHERE is_enabled = true
    ORDER BY display_order ASC
  LOOP
    INSERT INTO public.certificate_signatures (
      certificate_id,
      signature_id,
      display_order,
      signature_name,
      signature_designation,
      signature_text,
      signature_image_url
    ) VALUES (
      NEW.id,
      enabled_sig.id,
      enabled_sig.display_order,
      enabled_sig.name,
      enabled_sig.designation,
      enabled_sig.signature_text,
      enabled_sig.signature_image_url
    );

    signature_ids := array_append(signature_ids, enabled_sig.id::TEXT);
    signature_snapshot := array_append(
      signature_snapshot,
      jsonb_build_object(
        'signature_id', enabled_sig.id,
        'signature_name', enabled_sig.name,
        'signature_designation', enabled_sig.designation,
        'signature_text', enabled_sig.signature_text,
        'signature_image_url', enabled_sig.signature_image_url,
        'display_order', enabled_sig.display_order
      )
    );
  END LOOP;

  IF array_length(signature_ids, 1) IS NOT NULL THEN
    UPDATE public.certificates
    SET signature_ids = signature_ids,
        signatures_data = COALESCE(signature_snapshot, '[]'::JSONB[])
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'snapshot_certificate_signatures_on_insert failed for certificate %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS certificate_snapshot_signatures_trigger ON public.certificates;

CREATE TRIGGER certificate_snapshot_signatures_trigger
AFTER INSERT ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION snapshot_certificate_signatures_on_insert();
