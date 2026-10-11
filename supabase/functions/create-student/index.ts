// Deploy with Supabase CLI. Set secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// The service-role key must never be shipped to the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0] || "")
    .join("")
    .toUpperCase();
const random4 = () =>
  String((crypto.getRandomValues(new Uint32Array(1))[0] % 9000) + 1000);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("PROJECT_URL")!,
    anon = Deno.env.get("PROJECT_ANON_KEY")!,
    service = Deno.env.get("PROJECT_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Authentication required" }, 401);
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return json({ error: "Invalid session" }, 401);
  const admin = createClient(url, service);
  const { data: profile } = await admin
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || profile.status !== "active")
    return json({ error: "Admin access required" }, 403);
  try {
    const body = await req.json();
    const full_name = String(body.full_name || "").trim();
    const class_name = String(body.class_name || "10");
    const roll_number = String(body.roll_number || "").trim() || null;
    const phone = String(body.phone || "").trim() || null;
    if (!full_name || !["10", "12"].includes(class_name))
      return json({ error: "A full name and valid class are required." }, 400);
    const init = initials(full_name);
    if (init.length < 2)
      return json(
        {
          error: "Please enter first and last name to generate the student ID.",
        },
        400,
      );
    const prefix = `26NC${class_name}${init}`;
    let student_id = prefix;
    for (let n = 0; n < 4; n++) {
      const { data: exists } = await admin
        .from("profiles")
        .select("id")
        .eq("student_id", student_id)
        .maybeSingle();
      if (!exists) break;
      student_id = `${prefix}${n + 2}`;
    }
    const password = `${init}@${random4()}`;
    const auth_email = `${student_id.toLowerCase()}@students.nazarcreates.invalid`;
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: auth_email,
        password,
        email_confirm: true,
        user_metadata: { full_name, student_id },
      });
    if (createError || !created.user)
      return json(
        { error: createError?.message || "Could not create Auth user." },
        400,
      );
    let photo_url: string | null = null;
    if (
      typeof body.photo_base64 === "string" &&
      body.photo_base64.startsWith("data:image/")
    ) {
      const match = body.photo_base64.match(
        /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/,
      );
      if (match) {
        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        const ext = match[1].split("/")[1].replace("jpeg", "jpg");
        const path = `${created.user.id}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("student-photos")
          .upload(path, bytes, { contentType: match[1], upsert: true });
        if (!upErr) {
          const { data } = admin.storage
            .from("student-photos")
            .getPublicUrl(path);
          photo_url = data.publicUrl;
        }
      }
    }
    const { error: profileError } = await admin
      .from("profiles")
      .insert({
        id: created.user.id,
        full_name,
        student_id,
        auth_email,
        class_name,
        roll_number,
        phone,
        photo_url,
        role: "student",
        status: "active",
      });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.message }, 400);
    }
    return json({ full_name, student_id, password, class_name });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      500,
    );
  }
});
