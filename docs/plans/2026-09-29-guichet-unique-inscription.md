# Plan d'Implémentation - Guichet Unique « Inscription Foncière & Acquéreur »

> **Note pour les agents/exécutants :** Utiliser la sous-compétence recommandée pour exécuter les tâches étape par étape. Les étapes utilisent la syntaxe des cases à cocher (`- [ ]`) pour le suivi.

**Objectif :** Créer un guichet unique d'inscription foncière (`UnifiedLandSaleDialog`) qui permet de choisir directement le bien (Hectare, Parcelle dans un hectare ou Parcelle seule), de détecter intelligemment l'acquéreur (avec choix d'un nouveau RMB ou conservation du RMB existant), et d'enregistrer la vente de manière atomique en unifiant tous les chemins d'accès de l'application.

**Architecture :** Un composant autonome `src/components/UnifiedLandSaleDialog.tsx` centralise l'ensemble de la logique de sélection de terrain, détection client, calcul de quotas RMB et persistance Supabase. Il est branché comme point d'entrée unique sur `Acheteurs.tsx`, `Parcelles.tsx` et `Hectares.tsx`, éliminant les formulaires doublons.

**Stack Technique :** React 18, TypeScript, Tailwind CSS, Lucide React, Radix UI (Dialog, Select, Tabs, RadioGroup), TanStack Query v5, Supabase JS.

**Spécification de référence :** `docs/specs/2026-09-29-guichet-unique-inscription-design.md`

## Contraintes Globales

- Respect strict des contraintes PostgreSQL sur `sale_type` (`null` pour "à renseigner").
- Contrôle de la capacité maximale des hectares (16 parcelles de 600 m² ou équivalent effectif).
- Détection instantanée des acquéreurs existants pour proposer le choix : même RMB vs nouveau RMB.
- Suggestion automatique du prochain numéro dans la suite logique RMB via `getNextRmbProposal`.
- Zéro régression sur le build de production (`npm run build`).

---

### Tâche 1 : Création du composant `UnifiedLandSaleDialog`

**Fichiers :**
- Créer : `src/components/UnifiedLandSaleDialog.tsx`

**Interfaces :**
- Consomme : `supabase` depuis `@/integrations/supabase/client`, `useQueryClient` depuis `@tanstack/react-query`, `toast` depuis `sonner`, `getNextRmbProposal` depuis `@/lib/rmbSuite`.
- Produit : Composant exporté `UnifiedLandSaleDialog({ open, onOpenChange, defaultItemType, defaultHectareId, onSuccess })`.

- [ ] **Étape 1 : Créer le fichier `src/components/UnifiedLandSaleDialog.tsx` avec les types, l'état complet et la logique métier**
  - Gérer l'état du type de bien : `parcelle_alone`, `parcelle_in_hectare`, `hectare`.
  - Gérer le sous-type hectare : `complet` (10 000 m²) ou `demi` (5 000 m²).
  - Gérer le sélecteur d'hectare d'accueil avec calcul de capacité disponible.
  - Gérer la détection d'acquéreur existant et les deux options radio : `keep_rmb` (même dossier) ou `new_rmb` (nouveau RMB distinct).
  - Gérer les 3 types de vente (`normal`, `onereux`, `a_renseigner`).

- [ ] **Étape 2 : Implémenter la persistance Supabase dans `UnifiedLandSaleDialog`**
  - Insertion atomique dans la table `parcelles` ou `hectares`.
  - Invalidation du cache React Query (`parcelles`, `hectares`, `acheteurs`).
  - Fermeture et réinitialisation du formulaire avec toast de succès.

- [ ] **Étape 3 : Vérifier la compilation TypeScript du composant**
  Commande : `npx tsc --noEmit`
  Résultat attendu : 0 erreur de type.

- [ ] **Étape 4 : Commiter la création du composant**
  ```bash
  git add src/components/UnifiedLandSaleDialog.tsx
  git commit -m "feat(ui): créer le composant UnifiedLandSaleDialog pour le guichet unique foncier"
  ```

---

### Tâche 2 : Intégration sur la page `Acheteurs.tsx`

**Fichiers :**
- Modifier : `src/pages/Acheteurs.tsx`

**Interfaces :**
- Consomme : `UnifiedLandSaleDialog` depuis `@/components/UnifiedLandSaleDialog`.
- Produit : Remplacement du bouton d'action et du dialogue d'ajout de la page `Acheteurs`.

- [ ] **Étape 1 : Remplacer l'ancien bouton et modal d'ajout dans `Acheteurs.tsx` par `UnifiedLandSaleDialog`**
  - Importer `UnifiedLandSaleDialog`.
  - Remplacer le bouton "Ajouter un acheteur" par un bouton d'action primaire "Nouvelle inscription foncière".
  - Raccorder l'ouverture de `UnifiedLandSaleDialog` et le rechargement des données sur succès.

- [ ] **Étape 2 : Vérifier le fonctionnement de la page Acheteurs**
  Commande : `npm run build`
  Résultat attendu : Build réussi.

- [ ] **Étape 3 : Commiter l'intégration dans `Acheteurs.tsx`**
  ```bash
  git add src/pages/Acheteurs.tsx
  git commit -m "refactor(acheteurs): connecter le guichet unique d'inscription foncière"
  ```

---

### Tâche 3 : Intégration sur la page `Parcelles.tsx`

**Fichiers :**
- Modifier : `src/pages/Parcelles.tsx`

**Interfaces :**
- Consomme : `UnifiedLandSaleDialog` depuis `@/components/UnifiedLandSaleDialog`.
- Produit : Redirection de l'action d'ajout de parcelle vers le guichet unique avec pré-sélection.

- [ ] **Étape 1 : Remplacer le dialogue d'ajout de parcelle par `UnifiedLandSaleDialog`**
  - Le bouton "Ajouter une parcelle" ouvre `UnifiedLandSaleDialog` avec `defaultItemType="parcelle_in_hectare"` ou `"parcelle_alone"`.
  - Passer le `selectedHectare` actif comme `defaultHectareId` si filtré.

- [ ] **Étape 2 : Vérifier le build**
  Commande : `npm run build`
  Résultat attendu : Succès.

- [ ] **Étape 3 : Commiter la modification dans `Parcelles.tsx`**
  ```bash
  git add src/pages/Parcelles.tsx
  git commit -m "refactor(parcelles): unifier l'ajout de parcelle vers le guichet unique"
  ```

---

### Tâche 4 : Intégration sur la page `Hectares.tsx`

**Fichiers :**
- Modifier : `src/pages/Hectares.tsx`

**Interfaces :**
- Consomme : `UnifiedLandSaleDialog` depuis `@/components/UnifiedLandSaleDialog`.
- Produit : Redirection de l'action d'ajout d'hectare vers le guichet unique avec pré-sélection.

- [ ] **Étape 1 : Remplacer l'action d'ajout d'hectare par `UnifiedLandSaleDialog`**
  - Le bouton "Ajouter un hectare" ouvre `UnifiedLandSaleDialog` avec `defaultItemType="hectare"`.

- [ ] **Étape 2 : Vérifier le build**
  Commande : `npm run build`
  Résultat attendu : Succès.

- [ ] **Étape 3 : Commiter la modification dans `Hectares.tsx`**
  ```bash
  git add src/pages/Hectares.tsx
  git commit -m "refactor(hectares): unifier l'ajout d'hectare vers le guichet unique"
  ```

---

### Tâche 5 : Validation finale, tests de bout en bout et déploiement

**Fichiers :**
- Tester l'ensemble des parcours dans l'application.

- [ ] **Étape 1 : Exécuter le build de production complet**
  Commande : `npm run build`
  Résultat attendu : Code de sortie 0, chunks minifiés sans erreur.

- [ ] **Étape 2 : Pousser les commits vers `origin main`**
  Commande : `git push origin main`
  Résultat attendu : Branche distante mise à jour.
