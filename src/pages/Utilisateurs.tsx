import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Shield, User, Mail, Calendar, Eye, Edit, Trash, FileText, MapPin, Users, Settings, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface Permission {
  code: string;
  label: string;
  description: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  organization: string;
  created_at: string;
  roles?: { role: string }[];
  permissions?: { permission_code: string }[];
}

const Utilisateurs = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    phone: "",
    organization: "",
    role: "user" as "admin" | "moderator" | "user",
  });

  // Définition des permissions par rôle
  const rolePermissions = {
    admin: {
      label: "Administrateur",
      style: "bg-red-500/10 text-red-500 border-red-500/20",
      icon: Shield,
      description: "Accès complet à toutes les fonctionnalités",
      permissions: [
        { action: "Gérer les utilisateurs", allowed: true },
        { action: "Créer/Modifier/Supprimer des hectares", allowed: true },
        { action: "Créer/Modifier/Supprimer des parcelles", allowed: true },
        { action: "Gérer les sites", allowed: true },
        { action: "Voir tous les acheteurs", allowed: true },
        { action: "Gérer les paiements", allowed: true },
        { action: "Générer des rapports", allowed: true },
        { action: "Voir les documents", allowed: true },
        { action: "Accéder aux paramètres", allowed: true },
      ],
    },
    moderator: {
      label: "Modérateur",
      style: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      icon: User,
      description: "Accès à la plupart des fonctionnalités sauf la gestion des utilisateurs",
      permissions: [
        { action: "Gérer les utilisateurs", allowed: false },
        { action: "Créer/Modifier/Supprimer des hectares", allowed: true },
        { action: "Créer/Modifier/Supprimer des parcelles", allowed: true },
        { action: "Gérer les sites", allowed: true },
        { action: "Voir tous les acheteurs", allowed: true },
        { action: "Gérer les paiements", allowed: true },
        { action: "Générer des rapports", allowed: true },
        { action: "Voir les documents", allowed: true },
        { action: "Accéder aux paramètres", allowed: false },
      ],
    },
    user: {
      label: "Utilisateur",
      style: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      icon: User,
      description: "Accès en lecture seule",
      permissions: [
        { action: "Gérer les utilisateurs", allowed: false },
        { action: "Créer/Modifier/Supprimer des hectares", allowed: false },
        { action: "Créer/Modifier/Supprimer des parcelles", allowed: false },
        { action: "Gérer les sites", allowed: false },
        { action: "Voir tous les acheteurs", allowed: true },
        { action: "Gérer les paiements", allowed: false },
        { action: "Générer des rapports", allowed: true },
        { action: "Voir les documents", allowed: true },
        { action: "Accéder aux paramètres", allowed: false },
      ],
    },
  };

  useEffect(() => {
    checkAuthAndLoadUsers();
    loadPermissions();
  }, []);

  const checkAuthAndLoadUsers = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        navigate("/login");
        return;
      }

      setCurrentUserId(user.id);

      // Vérifier si l'utilisateur est admin
      const { data: adminCheck } = await supabase
        .rpc('is_admin', { _user_id: user.id });

      setIsAdmin(adminCheck || false);

      if (!adminCheck) {
        toast.error("Accès non autorisé - Administrateurs uniquement");
        navigate("/dashboard");
        return;
      }

      await loadUsers();
    } catch (error) {
      console.error("Erreur:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Récupérer tous les profils
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Récupérer les rôles pour chaque utilisateur
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Récupérer les permissions pour chaque utilisateur
      const { data: permissionsData, error: permissionsError } = await supabase
        .from("user_permissions")
        .select("user_id, permission_code");

      if (permissionsError) throw permissionsError;

      // Combiner les données
      const usersWithRoles = (profilesData || []).map((profile) => ({
        ...profile,
        roles: rolesData?.filter((r) => r.user_id === profile.id) || [],
        permissions: permissionsData?.filter((p) => p.user_id === profile.id) || [],
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    }
  };

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("label", { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des permissions");
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.full_name) {
      toast.error("Email et nom complet sont requis");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        return;
      }

      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: newUser.email,
          full_name: newUser.full_name,
          phone: newUser.phone,
          organization: newUser.organization,
          role: newUser.role,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      toast.success("Utilisateur créé avec succès");
      setShowAddUserDialog(false);
      setNewUser({
        email: "",
        full_name: "",
        phone: "",
        organization: "",
        role: "user",
      });
      await loadUsers();
    } catch (error: any) {
      console.error("Erreur création utilisateur:", error);
      toast.error(error.message || "Erreur lors de la création de l'utilisateur");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Supprimer tous les rôles existants
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Ajouter le nouveau rôle
      const { error } = await supabase
        .from("user_roles")
        .insert([{ 
          user_id: userId, 
          role: newRole as "admin" | "moderator" | "user"
        }]);

      if (error) throw error;

      toast.success("Rôle mis à jour avec succès");
      loadUsers();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour du rôle");
    }
  };

  const handlePermissionToggle = async (userId: string, permissionCode: string, isEnabled: boolean) => {
    try {
      if (isEnabled) {
        // Ajouter la permission
        const { error } = await supabase
          .from("user_permissions")
          .insert([{ user_id: userId, permission_code: permissionCode }]);

        if (error) throw error;
        toast.success("Permission ajoutée");
      } else {
        // Retirer la permission
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("permission_code", permissionCode);

        if (error) throw error;
        toast.success("Permission retirée");
      }

      loadUsers();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour de la permission");
    }
  };

  const hasPermission = (user: UserProfile, permissionCode: string) => {
    return user.permissions?.some(p => p.permission_code === permissionCode) || false;
  };

  const getUserRole = (user: UserProfile) => {
    if (!user.roles || user.roles.length === 0) return "user";
    return user.roles[0].role;
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = rolePermissions[role as keyof typeof rolePermissions] || rolePermissions.user;
    return {
      style: roleConfig.style,
      label: roleConfig.label,
      icon: roleConfig.icon,
    };
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.organization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Gestion des Utilisateurs
            </h1>
            <p className="text-muted-foreground">
              Gérez les utilisateurs et leurs permissions
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Ajouter un utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Ajouter un nouvel utilisateur</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="utilisateur@exemple.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="full_name">Nom complet *</Label>
                    <Input
                      id="full_name"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      placeholder="+243 123 456 789"
                    />
                  </div>
                  <div>
                    <Label htmlFor="organization">Organisation</Label>
                    <Input
                      id="organization"
                      value={newUser.organization}
                      onChange={(e) => setNewUser({ ...newUser, organization: e.target.value })}
                      placeholder="Nom de l'organisation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Rôle</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: "admin" | "moderator" | "user") =>
                        setNewUser({ ...newUser, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utilisateur</SelectItem>
                        <SelectItem value="moderator">Modérateur</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddUser} className="w-full">
                    Créer l'utilisateur
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Voir les permissions
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Matrice des Permissions par Rôle</DialogTitle>
                <DialogDescription>
                  Détail des accès et permissions pour chaque rôle utilisateur
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {Object.entries(rolePermissions).map(([roleKey, roleData]) => {
                  const RoleIcon = roleData.icon;
                  return (
                    <Card key={roleKey} className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <RoleIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{roleData.label}</h3>
                          <p className="text-sm text-muted-foreground">{roleData.description}</p>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded border ${roleData.style}`}>
                          {roleKey}
                        </span>
                      </div>
                      <div className="space-y-2 mt-4">
                        {roleData.permissions.map((perm, idx) => (
                          <div key={idx} className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/50">
                            {perm.allowed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            )}
                            <span className={`text-sm ${perm.allowed ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {perm.action}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{users.length} utilisateurs</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredUsers.map((user) => {
            const role = getUserRole(user);
            const badge = getRoleBadge(role);

            return (
              <Card key={user.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {user.full_name || "Utilisateur"}
                        </h3>
                        <div className="flex items-center gap-1">
                          {badge.icon && <badge.icon className="w-3 h-3" />}
                          <span
                            className={`text-xs px-2 py-1 rounded border ${badge.style}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span>{user.email}</span>
                        </div>

                        {user.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>📱 {user.phone}</span>
                          </div>
                        )}

                        {user.organization && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>🏢 {user.organization}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Inscrit le{" "}
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {user.id !== currentUserId && (
                      <>
                        <Select
                          value={role}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>Utilisateur</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="moderator">
                              <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                <span>Modérateur</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-red-500" />
                                <span>Admin</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Dialog open={selectedUserId === user.id} onOpenChange={(open) => setSelectedUserId(open ? user.id : null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Settings className="h-4 w-4" />
                              Permissions
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Gérer les permissions de {user.full_name}</DialogTitle>
                              <DialogDescription>
                                Sélectionnez les permissions individuelles pour cet utilisateur
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 mt-4">
                              {permissions.map((permission) => {
                                const isEnabled = hasPermission(user, permission.code);
                                return (
                                  <div key={permission.code} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                    <div className="flex items-center h-5">
                                      <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(e) => handlePermissionToggle(user.id, permission.code, e.target.checked)}
                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-sm font-medium text-foreground cursor-pointer">
                                        {permission.label}
                                      </label>
                                      {permission.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {permission.description}
                                        </p>
                                      )}
                                    </div>
                                    {isEnabled ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}

                    {user.id === currentUserId && (
                      <span className="text-sm text-muted-foreground px-3 py-2 bg-muted rounded">
                        Vous
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucun utilisateur trouvé
            </h3>
            <p className="text-muted-foreground">
              Aucun utilisateur ne correspond à votre recherche
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Utilisateurs;
