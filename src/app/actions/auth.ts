"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { roleHome } from "@/lib/auth/roles";
import { digestEmailActionValue } from "@/lib/auth/email-action-state";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import {
  expiredPasswordSetupCookieOptions,
  PASSWORD_SETUP_FLOW_COOKIE,
  PASSWORD_SETUP_GRANT_COOKIE,
  type PasswordSetupFlow,
} from "@/lib/auth/password-setup-grant";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";
import { authorizePublicAuth, isRateLimitError, neutralRecoveryMessage, publicAuthMessage, recordAuthEmailRequest, recordAuthOperationalAlert } from "@/lib/auth/public-auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  next: z.string().optional(),
});

const registerSchema = loginSchema
  .omit({
    next: true,
  })
  .extend({
    fullName: z.string().min(2, "Enter your full name."),
    role: z.enum(["guest", "owner"]).default("guest"),
  });

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email."),
});

const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
  flow: z.enum(["invitation", "recovery"]),
});

export type AuthActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  correlationId?: string;
  retryAfterSeconds?: number;
};

function toFormErrors(error: z.ZodError): AuthActionState {
  return {
    ok: false,
    errors: error.flatten().fieldErrors,
  };
}

async function getRoleForCurrentUser(): Promise<UserRole> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "guest";
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{
      role: UserRole;
    }>();

  return profile?.role ?? "guest";
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return toFormErrors(parsed.error);
  }

  const decision = await authorizePublicAuth("login", formData, parsed.data.email);
  if (!decision.allowed) return { ok: false, message: publicAuthMessage(decision.code), correlationId: decision.correlationId };

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: decision.captchaToken },
  });

  if (error) {
    if (isRateLimitError(error)) await recordAuthOperationalAlert("auth_rate_limited", decision.correlationId);
    return {
      ok: false,
      message: isRateLimitError(error) ? "Too many attempts. Please wait before trying again." : "Email or password is incorrect.",
      correlationId: decision.correlationId,
      ...(isRateLimitError(error) ? { retryAfterSeconds: 60 } : {}),
    };
  }

  if (!user?.id) {
    return {
      ok: false,
      message: "Unable to verify your account. Please try again.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      email: string | null;
      role: UserRole;
    }>();

  if (profileError) {
    return {
      ok: false,
      message: "We couldn't complete sign-in. Please try again.",
      correlationId: decision.correlationId,
    };
  }

  const role = profile?.role ?? "guest";

  const { data: preference } = await supabase
    .from("user_workspace_preferences")
    .select("default_landing_page,updated_at")
    .eq("profile_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ default_landing_page: string | null; updated_at: string }>();

  const destination = resolvePostLoginDestination({
    nextPath: parsed.data.next,
    savedLanding: preference?.default_landing_page,
    role,
    roleDefault: roleHome[role],
  });

  revalidatePath("/", "layout");
  redirect(destination);
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return toFormErrors(parsed.error);
  }

  const decision = await authorizePublicAuth("signup", formData, parsed.data.email);
  if (!decision.allowed) return { ok: false, message: publicAuthMessage(decision.code), correlationId: decision.correlationId };

  const supabase = await createClient();

  const { email, password, fullName, role } = parsed.data;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: decision.captchaToken,
      data: {
        full_name: fullName,
        role,
      },
    },
  });

  if (error) {
    if (isRateLimitError(error)) await recordAuthOperationalAlert("auth_rate_limited", decision.correlationId);
    return {
      ok: false,
      message: isRateLimitError(error) ? "Too many requests. Please wait before trying again." : "We couldn't complete that request. Please try again.",
      correlationId: decision.correlationId,
      ...(isRateLimitError(error) ? { retryAfterSeconds: 60 } : {}),
    };
  }

  await recordAuthEmailRequest("confirmation", email, decision.correlationId);

  return {
    ok: true,
    message: "Account created. Check your email to confirm your sign-in.",
    correlationId: decision.correlationId,
  };
}

export async function signOutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut({ scope: "local" });

  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return toFormErrors(parsed.error);
  }

  const decision = await authorizePublicAuth("recovery", formData, parsed.data.email);
  if (!decision.allowed) return decision.code === "RECIPIENT_SUPPRESSED"
    ? { ok: true, message: neutralRecoveryMessage, correlationId: decision.correlationId }
    : { ok: false, message: publicAuthMessage(decision.code), correlationId: decision.correlationId };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  const { data: request } = profile
    ? await admin
        .from("auth_recovery_requests")
        .insert({
          auth_user_id: profile.id,
          recipient_digest: digestEmailActionValue(normalizedEmail),
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single()
    : { data: null };
  const recoveryBinding = request
    ? `&recovery_request=${encodeURIComponent(request.id)}`
    : "";

  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail,
    {
      redirectTo: `${origin}/auth/callback?next=/update-password${recoveryBinding}`,
      captchaToken: decision.captchaToken,
    },
  );
  if (request)
    await admin
      .from("auth_recovery_requests")
      .update({
        status: error ? "failed" : "emailed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .eq("status", "pending");

  if (isRateLimitError(error)) await recordAuthOperationalAlert("auth_rate_limited", decision.correlationId);

  if (!error && profile) await recordAuthEmailRequest("recovery", normalizedEmail, decision.correlationId);

  return {
    ok: !isRateLimitError(error),
    message: isRateLimitError(error) ? "Too many requests. Please wait before trying again." : neutralRecoveryMessage,
    correlationId: decision.correlationId,
    ...(isRateLimitError(error) ? { retryAfterSeconds: 60 } : {}),
  };
}

export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return toFormErrors(parsed.error);
  }

  const store = await cookies();
  const grantToken = store.get(PASSWORD_SETUP_GRANT_COOKIE)?.value;
  const cookieFlow = store.get(PASSWORD_SETUP_FLOW_COOKIE)?.value;
  const flow: PasswordSetupFlow = parsed.data.flow;
  if (!grantToken || cookieFlow !== flow) {
    return {
      ok: false,
      message: "This password setup link is invalid, expired, or already used.",
    };
  }

  const supabase = await createClient();
  const claim = await supabase.rpc(
    "claim_password_setup_grant" as never,
    {
      p_grant_token: grantToken,
      p_flow: flow,
    } as never,
  );
  if (claim.error || !claim.data) {
    return {
      ok: false,
      message: "This password setup link is invalid, expired, or already used.",
    };
  }
  const grantId = claim.data as string;

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    await supabase.rpc(
      "fail_claimed_password_setup_grant" as never,
      { p_grant_id: grantId, p_grant_token: grantToken } as never,
    );
  }
  const completion = error
    ? { data: false, error }
    : await supabase.rpc(
        "password_setup_grant_completed" as never,
        {
          p_grant_id: grantId,
          p_grant_token: grantToken,
          p_flow: flow,
        } as never,
      );
  store.set(PASSWORD_SETUP_GRANT_COOKIE, "", expiredPasswordSetupCookieOptions);
  store.set(PASSWORD_SETUP_FLOW_COOKIE, "", expiredPasswordSetupCookieOptions);
  if (completion.error || completion.data !== true) {
    return {
      ok: false,
      message: "This password setup link is invalid, expired, or already used.",
    };
  }

  const destination =
    flow === "invitation"
      ? "/dashboard"
      : roleHome[await getRoleForCurrentUser()];

  revalidatePath("/", "layout");
  redirect(destination);
}
