import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedRoles = ["owner", "admin", "procurement_manager", "procurement_officer"];
const portalRoles = ["primary_contact", "contributor"];

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export default {
 async fetch(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response({ error: "Método não permitido." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return response({ error: "Sessão inválida." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL") || "https://procplus-enterprise.vercel.app";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return response({ error: "Sessão inválida." }, 401);

    const body = await request.json();
    const action = String(body.action || "");
    const supplierId = String(body.supplierId || "");
    if (!supplierId) return response({ error: "Fornecedor obrigatório." }, 400);

    const { data: supplier, error: supplierError } = await service
      .from("suppliers")
      .select("id,organization_id,legal_name,trading_name")
      .eq("id", supplierId)
      .single();
    if (supplierError || !supplier) return response({ error: "Fornecedor não encontrado." }, 404);

    const { data: membership } = await service
      .from("organization_members")
      .select("role,active")
      .eq("organization_id", supplier.organization_id)
      .eq("user_id", authData.user.id)
      .eq("active", true)
      .maybeSingle();
    if (!membership || !allowedRoles.includes(membership.role)) {
      return response({ error: "Sem permissão para gerir o acesso deste fornecedor." }, 403);
    }

    if (action === "invite" || action === "resend") {
      const email = String(body.email || "").trim().toLowerCase();
      const role = portalRoles.includes(body.role) ? body.role : "primary_contact";
      if (!email || !email.includes("@")) return response({ error: "E-mail inválido." }, 400);

      const { data: existingAccess } = await service
        .from("supplier_portal_users")
        .select("id,user_id,active,profiles(email)")
        .eq("supplier_id", supplierId);
      const linked = (existingAccess || []).find((item: any) =>
        item.profiles?.email?.toLowerCase() === email
      );
      if (linked?.active) return response({ error: "Este representante já tem acesso activo." }, 409);

      const { data: currentInvitation } = await service
        .from("supplier_portal_invitations")
        .select("id")
        .eq("supplier_id", supplierId)
        .eq("email", email)
        .eq("status", "pending")
        .maybeSingle();
      const invitationValues = {
          organization_id: supplier.organization_id,
          supplier_id: supplierId,
          email,
          role,
          status: "pending",
          invited_by: authData.user.id,
          invited_at: new Date().toISOString(),
          last_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          accepted_at: null,
          accepted_by: null,
      };
      const invitationQuery = currentInvitation
        ? service.from("supplier_portal_invitations").update(invitationValues).eq("id", currentInvitation.id)
        : service.from("supplier_portal_invitations").insert(invitationValues);
      const { data: invitation, error: invitationError } = await invitationQuery.select().single();
      if (invitationError) throw invitationError;

      const { error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/set-password?portal=supplier`,
        data: {
          account_type: "supplier",
          supplier_id: supplierId,
          supplier_name: supplier.trading_name || supplier.legal_name,
        },
      });
      if (inviteError && !/already.*registered/i.test(inviteError.message)) {
        await service.from("supplier_portal_invitations")
          .update({ status: "cancelled" }).eq("id", invitation.id);
        throw inviteError;
      }

      return response({
        ok: true,
        message: inviteError
          ? "O representante já possui uma conta. O acesso ficará disponível ao iniciar sessão."
          : "Convite enviado com sucesso.",
      });
    }

    if (action === "cancel") {
      const { error } = await service.from("supplier_portal_invitations")
        .update({ status: "cancelled" })
        .eq("id", body.invitationId)
        .eq("supplier_id", supplierId)
        .eq("status", "pending");
      if (error) throw error;
      return response({ ok: true, message: "Convite cancelado." });
    }

    if (action === "suspend" || action === "activate") {
      const { error } = await service.from("supplier_portal_users")
        .update({ active: action === "activate" })
        .eq("id", body.accessId)
        .eq("supplier_id", supplierId);
      if (error) throw error;
      return response({
        ok: true,
        message: action === "activate" ? "Acesso reactivado." : "Acesso suspenso.",
      });
    }

    return response({ error: "Acção desconhecida." }, 400);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Erro interno." }, 400);
  }
 }
};
