import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  phone?: string;
  organization?: string;
  role: "admin" | "moderator" | "user";
  permissions?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Vérifier que l'utilisateur actuel est admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Non autorisé");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: currentUser }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !currentUser) {
      throw new Error("Non autorisé");
    }

    // Vérifier le rôle admin
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc(
      "is_admin",
      { _user_id: currentUser.id }
    );

    if (adminError || !isAdmin) {
      throw new Error("Accès refusé - Administrateurs uniquement");
    }

    const {
      email,
      full_name,
      phone,
      organization,
      role,
      permissions,
    }: CreateUserRequest = await req.json();

    // Générer un mot de passe temporaire
    const tempPassword = crypto.randomUUID();

    // Créer l'utilisateur avec l'API Admin
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false, // L'utilisateur devra confirmer son email
      user_metadata: {
        full_name,
        phone: phone || "",
        organization: organization || "",
      },
    });

    if (createError) {
      console.error("Erreur création utilisateur:", createError);
      
      // Gérer spécifiquement l'erreur d'email existant
      let errorMessage = createError.message;
      let statusCode = 500;
      
      if (createError.message.includes("already been registered")) {
        errorMessage = "Cet email est déjà enregistré dans le système";
        statusCode = 422;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: statusCode,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non créé" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Assigner le rôle
    const { error: roleError } = await supabaseClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role,
      });

    if (roleError) {
      console.error("Erreur attribution rôle:", roleError);
      // Ne pas échouer complètement si le rôle n'est pas assigné
    }

    // Assigner les permissions si fournies
    if (permissions && permissions.length > 0) {
      const permissionInserts = permissions.map((permissionCode) => ({
        user_id: newUser.user!.id,
        permission_code: permissionCode,
      }));

      const { error: permError } = await supabaseClient
        .from("user_permissions")
        .insert(permissionInserts);

      if (permError) {
        console.error("Erreur attribution permissions:", permError);
      }
    }

    console.log("Utilisateur créé avec succès:", newUser.user.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Utilisateur créé avec succès.",
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
        },
        tempPassword: tempPassword,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Erreur dans create-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
