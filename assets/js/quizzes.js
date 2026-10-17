document.addEventListener("DOMContentLoaded", async () => {
  const p = await NC.guard();
  if (!p) return;
  let selected = "";
  let filter = "all";
  const grid = document.getElementById("subjectGrid"),
    list = document.getElementById("quizList");
  grid.innerHTML = NC.subjects
    .map(
      (s) =>
        `<button class="subject-card ${s.tint}" data-subject="${NC.escape(s.name)}"><span class="subject-icon">${s.icon}</span><span><strong>${NC.escape(s.name)}</strong><small>${s.desc}</small></span><b>→</b></button>`,
    )
    .join("");
  async function showQuizzes() {
    document.getElementById("quizListTitle").textContent =
      selected || "Choose a subject";
    if (!selected) {
      list.innerHTML =
        '<div class="empty-state">Select a subject to see its quizzes.</div>';
      return;
    }
    const qs = await NC.rows("quizzes", (q) =>
      q
        .eq("subject", selected)
        .eq("published", true)
        .order("created_at", { ascending: false }),
    );
    const now = Date.now();
    const attempts = window.sb
      ? await NC.rows("quiz_attempts", (q) => q.eq("student_id", p.id))
      : [];
    const attemptByQuiz = new Map(attempts.map((a) => [a.quiz_id, a]));
    let filtered = qs.filter(
      (q) =>
        filter === "all" ||
        (filter === "active" &&
          (!q.starts_at || new Date(q.starts_at).getTime() <= now) &&
          (!q.ends_at || new Date(q.ends_at).getTime() >= now)) ||
        (filter === "upcoming" &&
          q.starts_at &&
          new Date(q.starts_at).getTime() > now),
    );
    if (filter === "completed" && window.sb) {
      filtered = qs.filter((q) => {
        const attempt = attemptByQuiz.get(q.id);
        return attempt && attempt.status !== "in_progress";
      });
    }
    if (!filtered.length) {
      list.innerHTML =
        '<div class="empty-state">No quizzes in this section yet. Check back soon.</div>';
      return;
    }
    list.innerHTML = filtered
      .map(
        (q) =>
          (() => {
            const attempt = attemptByQuiz.get(q.id);
            const used = attempt && attempt.status !== "in_progress";
            const upcoming = q.starts_at && new Date(q.starts_at) > new Date();
            const label = used ? (attempt.status === "submitted" ? "Attempted" : "Attempt used") : attempt ? "Resume →" : upcoming ? "Upcoming" : "Start →";
            return `<article class="quiz-list-card"><div class="quiz-card-icon">✦</div><div class="quiz-card-main"><strong>${NC.escape(q.title)}</strong><p>${Number(q.question_count || 0) || "—"} questions · ${q.duration_minutes || 15} min · +${q.positive_marks ?? 1} / −${q.negative_marks ?? 0}</p><span class="status-pill">${used ? "Completed" : upcoming ? "Upcoming" : attempt ? "In progress" : "Active"}</span></div><button class="button primary compact" data-start="${q.id}" ${used || upcoming ? "disabled" : ""}>${label}</button></article>`;
          })(),
      )
      .join("");
    list
      .querySelectorAll("[data-start]")
      .forEach((b) =>
        b.addEventListener(
          "click",
          () =>
            (location.href = `quiz.html?quiz=${encodeURIComponent(b.dataset.start)}`),
        ),
      );
  }
  grid.querySelectorAll("[data-subject]").forEach((b) =>
    b.addEventListener("click", () => {
      selected = b.dataset.subject;
      grid
        .querySelectorAll(".subject-card")
        .forEach((x) => x.classList.toggle("selected", x === b));
      showQuizzes();
      document
        .querySelector(".quiz-list-section")
        .scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  );
  document.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((x) => x.classList.toggle("active", x === b));
      showQuizzes();
    }),
  );
  const qs = new URLSearchParams(location.search);
  if (qs.get("subject")) {
    selected = qs.get("subject");
  }
  await showQuizzes();
});
