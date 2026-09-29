# Spécification de Conception : Guichet Unique « Inscription Foncière & Acquéreur »

- **Date** : 2026-09-29
- **Auteur** : Assistant Antigravity & Équipe Projet Concession Manuel Joaquim d'Oliveira
- **Statut** : En cours de validation

---

## 1. Contexte & Problématique

Actuellement, l'application propose trois voies de saisie distinctes et fragmentées :
1. Sur la page *Parcelles* : un dialogue « Ajouter une parcelle » qui crée une parcelle (avec ou sans affectation à un hectare).
2. Sur la page *Hectares* : un dialogue « Ajouter un hectare ».
3. Sur la page *Acheteurs* : un dialogue « Ajouter un acheteur » qui obligeait à sélectionner parmi les parcelles déjà pré-créées.

Cette dispersion entraînait :
- Une lourdeur d'utilisation (obligation de créer d'abord un bien avant de pouvoir inscrire son acheteur).
- Des allers-retours fréquents entre pages.
- Une ambiguïté sur la gestion des RMB lorsqu'un client achetait une nouvelle parcelle ou un nouvel hectare (doit-on réutiliser le même RMB ou lui en attribuer un nouveau ?).

---

## 2. Objectifs de la Refonte

1. **Une Voie Unique d'Inscription** : Centraliser l'inscription dans un guichet unique moderne (`UnifiedLandSaleDialog`) où l'on renseigne en une seule opération : le type de terrain, ses dimensions/numéros, l'acquéreur, et les conditions de vente.
2. **Choix immédiat et clair du Bien** :
   - **Hectare** (Hectare complet 10 000 m² ou Demi-hectare 5 000 m²).
   - **Parcelle dans un hectare** (sélection de l'hectare d'accueil avec contrôle d'occupation max 16 parcelles).
   - **Parcelle seule** (autonome, indépendante de tout hectare).
3. **Gestion Intelligente des Acheteurs Déjà Enregistrés** :
   - Détection automatique ou recherche parmi les acquéreurs existants.
   - Deux choix clairs :
     - **Option 1 : Conserver le RMB principal existant** (extension de quota sur le même dossier).
     - **Option 2 : Attribuer un nouveau numéro RMB indépendant** (nouvelle acquisition avec son propre numéro RMB et suggestion de la suite logique).
4. **Prise en charge native des types de vente** :
   - Vente normale (avec acomptes ou solde total).
   - À titre gratuit (onéreux).
   - À renseigner (champs financiers masqués, enregistrement propre avec `sale_type: null` sans violation de contrainte).
5. **Remplacement des anciens formulaires doublons** :
   - Sur *Acheteurs* : le bouton principal ouvre ce guichet unique.
   - Sur *Parcelles* et *Hectares* : les boutons d'ajout ouvrent également ce guichet unique avec le type de bien pré-coché, garantissant une cohérence absolue à travers toute l'application.

---

## 3. Architecture Technique

### 3.1. Composant `src/components/UnifiedLandSaleDialog.tsx`
- **Props** :
  ```typescript
  interface UnifiedLandSaleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultItemType?: "parcelle_alone" | "parcelle_in_hectare" | "hectare";
    defaultHectareId?: string;
    onSuccess?: () => void;
  }
  ```
- **État Interne** :
  - `itemType` : `"parcelle_alone" | "parcelle_in_hectare" | "hectare"`
  - `hectareSubType` : `"complet" | "demi"` (10 000 m² ou 5 000 m²)
  - `hectareId` : ID de l'hectare d'accueil si `parcelle_in_hectare`
  - `numero` / `rmbNumber` : Saisie ou génération via `getNextRmbNumber()`
  - `surface` : Surface en m²
  - `buyer` : Nom, prénom, post-nom, téléphone, adresse, profession, etc.
  - `existingBuyerMode` : `"keep_rmb" | "new_rmb"`
  - `selectedExistingBuyer` : Objet acquéreur existant détecté
  - `saleType` : `"normal" | "onereux" | "a_renseigner"`
  - `paymentType` : `"total" | "partiel"`
  - `prix`, `amountPaid`, `remainingAmount`

### 3.2. Flux d'Enregistrement Atomique
1. Validation des données (surface > 0, numéro renseigné, nom d'acquéreur présent, vérification capacité de l'hectare si parcelle dans un hectare).
2. Si type **Hectare** :
   - Insertion dans la table `hectares` avec statut `vendu`, `buyer_name`, `rmb_number`, etc.
3. Si type **Parcelle** :
   - Insertion dans la table `parcelles` avec `hectare_id` (ou `null` si parcelle seule), statut `vendu`, `buyer_name`, `rmb_number`, `sale_type` (`null` si à renseigner).
   - Gestion du `merged_group_id` si cumul avec un dossier existant.
4. Invalidation du cache React Query :
   - `queryClient.invalidateQueries({ queryKey: ["acheteurs"] })`
   - `queryClient.invalidateQueries({ queryKey: ["parcelles"] })`
   - `queryClient.invalidateQueries({ queryKey: ["hectares"] })`
   - `queryClient.invalidateQueries({ queryKey: ["existing-buyers-detection"] })`
5. Notification Toast de confirmation et fermeture du dialogue.

---

## 4. Expérience Utilisateur (UI/UX)

- **Cartes de sélection du bien (Étape 1)** :
  - Design moderne avec bordures actives, icônes colorées et descriptions succinctes.
- **Détection de client existant (Étape 2)** :
  - Alerte ambre élégante qui indique le nombre de quotas actuels et son RMB actuel.
  - Deux tuiles de choix claires : "Même dossier (RMB xxx)" ou "Nouveau dossier (Nouveau RMB)".
- **Type de vente réactif (Étape 3)** :
  - Si "À renseigner", masque immédiatement tous les champs de prix/acomptes et affiche la mention d'attente.

---

## 5. Critères de Réussite & Vérification

1. Un utilisateur peut ouvrir le dialogue depuis la page *Acheteurs*, *Parcelles* ou *Hectares*.
2. L'inscription d'une parcelle seule se fait directement avec son acquéreur sans passer par la page Parcelles préalable.
3. L'inscription d'une parcelle dans un hectare s'effectue avec contrôle de la jauge (max 16 effectifs).
4. L'inscription d'un hectare complet ou demi-hectare s'effectue directement.
5. Lorsqu'un acquéreur existant est sélectionné :
   - Le mode "Même RMB" incrémente son quota sans créer de doublon de RMB.
   - Le mode "Nouveau RMB" lui associe un nouveau numéro RMB indépendant.
6. Le mode "À renseigner" s'enregistre sans erreur de contrainte PostgreSQL.
7. Aucune régression sur le build de production (`npm run build`).
