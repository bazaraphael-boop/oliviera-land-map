-- Ajouter un champ pour grouper les parcelles fusionnées
ALTER TABLE public.parcelles 
ADD COLUMN merged_group_id uuid DEFAULT NULL,
ADD COLUMN is_merge_primary boolean DEFAULT false;

-- Ajouter un commentaire pour expliquer l'utilisation
COMMENT ON COLUMN public.parcelles.merged_group_id IS 'ID du groupe de parcelles fusionnées visuellement (toutes les parcelles avec le même merged_group_id sont affichées comme un bloc unique)';
COMMENT ON COLUMN public.parcelles.is_merge_primary IS 'Indique si cette parcelle est la parcelle principale du groupe fusionné (celle qui affiche les informations)';