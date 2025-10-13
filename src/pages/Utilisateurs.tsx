import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Shield, User, Mail, Calendar } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  organization: string;
  created_at: string;
  roles?: { role: string }[];
}

const Utilisateurs = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    checkAuthAndLoadUsers();
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

      // Combiner les données
      const usersWithRoles = (profilesData || []).map((profile) => ({
        ...profile,
        roles: rolesData?.filter((r) => r.user_id === profile.id) || [],
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
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

  const getUserRole = (user: UserProfile) => {
    if (!user.roles || user.roles.length === 0) return "user";
    return user.roles[0].role;
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      admin: "bg-red-500/10 text-red-500 border-red-500/20",
      moderator: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      user: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    const labels = {
      admin: "Administrateur",
      moderator: "Modérateur",
      user: "Utilisateur",
    };
    return {
      style: styles[role as keyof typeof styles] || styles.user,
      label: labels[role as keyof typeof labels] || "Utilisateur",
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gestion des Utilisateurs
          </h1>
          <p className="text-muted-foreground">
            Gérez les utilisateurs et leurs permissions
          </p>
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
                        <span
                          className={`text-xs px-2 py-1 rounded border ${badge.style}`}
                        >
                          {badge.label}
                        </span>
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
