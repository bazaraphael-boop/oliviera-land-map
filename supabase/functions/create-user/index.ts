import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

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
      throw new Error(`Erreur lors de la création de l'utilisateur: ${createError.message}`);
    }

    if (!newUser.user) {
      throw new Error("Utilisateur non créé");
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

    // Générer le lien de réinitialisation de mot de passe
    const { data: resetData, error: resetError } = await supabaseClient.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify`,
      },
    });

    if (resetError) {
      console.error("Erreur génération lien:", resetError);
    }

    // Envoyer l'email de bienvenue avec Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    const magicLink = resetData?.properties?.action_link || "";

    try {
      await resend.emails.send({
        from: "Gestion Foncière <onboarding@resend.dev>",
        to: [email],
        subject: "Bienvenue - Confirmez votre inscription",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
              Bienvenue dans l'application de gestion foncière
            </h1>
            
            <p style="color: #555; font-size: 16px;">
              Bonjour ${full_name},
            </p>
            
            <p style="color: #555; font-size: 16px;">
              Votre compte a été créé avec le rôle <strong>${role}</strong>.
            </p>
            
            <p style="color: #555; font-size: 16px;">
              Pour activer votre compte et définir votre mot de passe, cliquez sur le lien ci-dessous :
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;
                        font-weight: bold;">
                Activer mon compte
              </a>
            </div>
            
            <p style="color: #888; font-size: 14px;">
              Ce lien est valide pendant 24 heures. Si vous n'avez pas demandé cette inscription, 
              vous pouvez ignorer cet email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px; text-align: center;">
              Gestion Foncière Muanda © ${new Date().getFullYear()}
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Erreur envoi email:", emailError);
      // Ne pas échouer complètement si l'email n'est pas envoyé
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Utilisateur créé avec succès. Un email de confirmation a été envoyé.",
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
        },
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
