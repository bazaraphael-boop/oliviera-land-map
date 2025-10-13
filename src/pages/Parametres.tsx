import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  organization: string;
}

const Parametres = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    organization: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        navigate("/login");
        return;
      }

      setUser(user);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);
        setProfileForm({
          full_name: profileData.full_name || "",
          email: profileData.email || user.email || "",
          phone: profileData.phone || "",
          organization: profileData.organization || "",
        });
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          organization: profileForm.organization,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profil mis à jour avec succès");
      checkAuthAndLoadProfile();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      toast.success("Mot de passe modifié avec succès");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du changement de mot de passe");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Paramètres</h1>
            <p className="text-muted-foreground">
              Gérez votre profil et vos préférences
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList>
              <TabsTrigger value="profile">
                <User className="w-4 h-4 mr-2" />
                Profil
              </TabsTrigger>
              <TabsTrigger value="security">
                <Lock className="w-4 h-4 mr-2" />
                Sécurité
              </TabsTrigger>
              <TabsTrigger value="preferences">
                <SettingsIcon className="w-4 h-4 mr-2" />
                Préférences
              </TabsTrigger>
            </TabsList>

            {/* Profil */}
            <TabsContent value="profile">
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">
                  Informations personnelles
                </h2>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="full_name">Nom complet</Label>
                      <Input
                        id="full_name"
                        value={profileForm.full_name}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, full_name: e.target.value })
                        }
                        placeholder="Votre nom complet"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileForm.email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        L'email ne peut pas être modifié
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, phone: e.target.value })
                        }
                        placeholder="+243 XXX XXX XXX"
                      />
                    </div>

                    <div>
                      <Label htmlFor="organization">Organisation</Label>
                      <Input
                        id="organization"
                        value={profileForm.organization}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, organization: e.target.value })
                        }
                        placeholder="Nom de votre organisation"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={saving}>
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? "Enregistrement..." : "Enregistrer les modifications"}
                    </Button>
                  </div>
                </form>
              </Card>
            </TabsContent>

            {/* Sécurité */}
            <TabsContent value="security">
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">
                  Changer le mot de passe
                </h2>
                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                  <div>
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      placeholder="Minimum 8 caractères"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">
                      Confirmer le nouveau mot de passe
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Retapez le mot de passe"
                      required
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={saving}>
                      <Lock className="w-4 h-4 mr-2" />
                      {saving ? "Modification..." : "Changer le mot de passe"}
                    </Button>
                  </div>
                </form>
              </Card>
            </TabsContent>

            {/* Préférences */}
            <TabsContent value="preferences">
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">
                  Préférences de l'application
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Recevoir des notifications pour les nouvelles ventes
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Activer
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">Langue</p>
                      <p className="text-sm text-muted-foreground">
                        Langue de l'interface
                      </p>
                    </div>
                    <select className="px-3 py-2 rounded-md border border-border bg-background">
                      <option>Français</option>
                      <option>English</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">Devise</p>
                      <p className="text-sm text-muted-foreground">
                        Devise par défaut pour les prix
                      </p>
                    </div>
                    <select className="px-3 py-2 rounded-md border border-border bg-background">
                      <option>USD</option>
                      <option>CDF</option>
                      <option>EUR</option>
                    </select>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Parametres;
