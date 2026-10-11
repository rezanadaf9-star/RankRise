(() => {
  const cfg = window.SUPABASE_CONFIG || {};
  const configured = cfg.url && !cfg.url.includes("YOUR_PROJECT") && cfg.anonKey && !cfg.anonKey.includes("YOUR_SUPABASE");
  window.sb = (window.supabase && configured) ? window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  window.NC = {
    subjects: [
      {name:"Science", icon:"⚗", tint:"mint", desc:"Physics, chemistry & biology"},
      {name:"Social Science", icon:"◎", tint:"peach", desc:"History, geography & civics"},
      {name:"Mathematics", icon:"∑", tint:"lavender", desc:"Practice with confidence"},
      {name:"Urdu", icon:"ع", tint:"rose", desc:"Language & literature"},
      {name:"Hindi", icon:"अ", tint:"gold", desc:"Grammar & literature"},
      {name:"English", icon:"Aa", tint:"blue", desc:"Grammar, reading & writing"}
    ],
    async session(redirect = true) {
      if (!window.sb) return null;
      const {data:{session}, error} = await window.sb.auth.getSession();
      if (error) console.error(error);
      if (redirect && !session && !location.pathname.endsWith("index.html") && location.pathname !== "/") location.replace(this.rootPath() + "index.html");
      return session;
    },
    rootPath() { return location.pathname.includes("/admin/") ? "../" : ""; },
    async profile() {
      const session = await this.session();
      if (!session || !window.sb) return null;
      const {data,error} = await window.sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (error) console.warn(error.message);
      if (data && data.status === "disabled") { await window.sb.auth.signOut(); location.replace(this.rootPath()+"index.html"); return null; }
      return data;
    },
    initials(name="Student") { return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase() || "S"; },
    escape(s="") { return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); },
    toast(message) {
      let el=document.getElementById("toast");
      if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.append(el);}
      el.textContent=message; el.classList.add("show"); clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.classList.remove("show"),3000);
    },
    async signOut() { if(window.sb) await window.sb.auth.signOut(); location.replace(this.rootPath()+"index.html"); },
    async guard() {
      const session=await this.session();
      if(!session) return null;
      const profile=await this.profile();
      if(!profile) return null;
      document.querySelectorAll("#studentName,#topStudentName,#profileMenuName").forEach(e=>e.textContent=profile.full_name||"Student");
      document.querySelectorAll("#avatarInitials").forEach(e=>e.textContent=this.initials(profile.full_name));
      document.querySelectorAll("[data-logout]").forEach(e=>e.addEventListener("click",()=>this.signOut()));
      const menu=document.getElementById("sidebar"),scrim=document.getElementById("menuScrim");
      document.getElementById("menuToggle")?.addEventListener("click",()=>{menu?.classList.toggle("open");scrim?.classList.toggle("show");});
      scrim?.addEventListener("click",()=>{menu?.classList.remove("open");scrim.classList.remove("show");});
      const pm=document.getElementById("profileMenu");
      document.getElementById("profileToggle")?.addEventListener("click",()=>pm?.classList.toggle("hidden"));
      return profile;
    },
    async rows(table, query) {
      if(!window.sb) return [];
      let q=window.sb.from(table).select("*");
      if(query) q=query(q);
      const {data,error}=await q;
      if(error){console.warn(table,error.message);return [];}
      return data||[];
    }
  };
  if(document.getElementById("bootScreen") && !window.sb) {
    document.getElementById("bootScreen").classList.add("hidden");
    const m=document.getElementById("loginMessage"); if(m)m.textContent="Add your Supabase URL and key in assets/js/supabase-config.js to connect this site.";
  }
})();
