document.addEventListener("DOMContentLoaded", async () => {
  const p = await NC.guard();
  if (!p) return;
  const quizId = new URLSearchParams(location.search).get("quiz");
  let quiz = null,
    questions = [],
    answers = {},
    seen = new Set(),
    index = 0,
    started = Date.now(),
    remaining = 0,
    tick = null,
    attemptId = null,
    submitting = false;
  const $ = (id) => document.getElementById(id);
  const fallback = [
    {
      id: "demo1",
      question_text: "What is the SI unit of force?",
      options: ["Joule", "Newton", "Watt", "Pascal"],
      correct_answer: "Newton",
      explanation: "The newton (N) is the SI derived unit of force.",
      hint: "Think of the unit named after a scientist.",
    },
  ];
  if (window.sb && quizId) {
    const { data: q } = await window.sb
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .single();
    quiz = q;
    if (q) {
      const { data: qs } = await window.sb
        .from("questions")
        .select("*")
        .eq("quiz_id", q.id)
        .order("position");
      questions = qs || [];
    }
  }
  if (!quiz) {
    quiz = {
      title: "Preview Quiz — Demo",
      subject: "Science",
      duration_minutes: 15,
      positive_marks: 1,
      negative_marks: 0,
    };
    questions = fallback;
  }
  questions = questions.map((q) => ({
    ...q,
    options: Array.isArray(q.options)
      ? q.options
      : typeof q.options === "string"
        ? JSON.parse(q.options)
        : [],
  }));
  $("quizTitle").textContent = quiz.title;
  $("questionSubject").textContent = quiz.subject || "PRACTICE";
  $("positiveMarks").textContent = quiz.positive_marks ?? 1;
  $("negativeMarks").textContent = quiz.negative_marks ?? 0;
  remaining = (quiz.duration_minutes || 15) * 60;
  // One attempt per student per quiz: resume only an in-progress attempt.
  // If already submitted (or abandoned), never create a new attempt.
  if (window.sb && quizId) {
    const { data: existingAttempts, error: existingError } = await window.sb
      .from("quiz_attempts")
      .select("*")
      .eq("quiz_id", quizId)
      .eq("student_id", p.id)
      .order("started_at", { ascending: false });

    if (existingError) {
      NC.toast("Could not verify your quiz attempt. Please try again.");
      location.replace("quizzes.html");
      return;
    }

    const priorSubmitted = (existingAttempts || []).find(a => a.status === "submitted");
    if (priorSubmitted) {
      NC.toast("You have already attempted this quiz. A second attempt is not allowed.");
      location.replace(`analysis.html?attempt=${encodeURIComponent(priorSubmitted.id)}`);
      return;
    }

    const priorAttempt = (existingAttempts || []).find(a => a.status === "in_progress");
    if (priorAttempt) {
      attemptId = priorAttempt.id;
      answers = priorAttempt.answers || {};
      remaining = Math.max(
        0,
        Math.min(
          remaining,
          Math.floor(
            (new Date(priorAttempt.started_at).getTime() +
              (quiz.duration_minutes || 15) * 60000 - Date.now()) / 1000,
          ),
        ),
      );
    } else if ((existingAttempts || []).some(a => a.status === "abandoned")) {
      NC.toast("You have already used your attempt for this quiz.");
      location.replace("quizzes.html");
      return;
    }
  }
  function saveLocal() {
    try {
      localStorage.setItem(
        "nc-quiz-" + (quizId || "demo"),
        JSON.stringify({ answers, seen: [...seen], index, started, remaining }),
      );
    } catch {}
  }
  try {
    const saved = JSON.parse(
      localStorage.getItem("nc-quiz-" + (quizId || "demo")) || "null",
    );
    if (saved && !attemptId) {
      answers = saved.answers || answers;
      seen = new Set(saved.seen || []);
      index = Math.min(saved.index || 0, questions.length - 1);
      started = saved.started || started;
      remaining = Math.min(remaining, saved.remaining || remaining);
    }
  } catch {}
  async function saveRemote() {
    saveLocal();
    if (window.sb && attemptId) {
      await window.sb
        .from("quiz_attempts")
        .update({ answers, updated_at: new Date().toISOString() })
        .eq("id", attemptId);
    }
    $("autosaveStatus").textContent = "Saved just now";
    setTimeout(
      () =>
        ($("autosaveStatus").textContent = "Your answers save automatically."),
      1600,
    );
  }
  if (window.sb && quizId && !attemptId) {
    const { data: a, error: createAttemptError } = await window.sb
      .from("quiz_attempts")
      .insert({
        quiz_id: quizId,
        student_id: p.id,
        status: "in_progress",
        started_at: new Date().toISOString(),
        answers: {},
      })
      .select()
      .single();
    if (createAttemptError || !a) {
      // A concurrent tab/device may have created the attempt first.
      const { data: racedAttempts } = await window.sb
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_id", quizId)
        .eq("student_id", p.id)
        .order("started_at", { ascending: false });
      const racedSubmitted = (racedAttempts || []).find(x => x.status === "submitted");
      const racedInProgress = (racedAttempts || []).find(x => x.status === "in_progress");
      if (racedSubmitted) {
        location.replace(`analysis.html?attempt=${encodeURIComponent(racedSubmitted.id)}`);
        return;
      }
      if (racedInProgress) {
        attemptId = racedInProgress.id;
        answers = racedInProgress.answers || {};
      } else {
        NC.toast("Could not start this quiz. Please return to the quiz list and try again.");
        location.replace("quizzes.html");
        return;
      }
    } else {
      attemptId = a.id;
    }
  }
  function render() {
    if (!questions.length) {
      $("questionText").textContent =
        "No questions have been added to this quiz yet.";
      return;
    }
    const q = questions[index];
    seen.add(index);
    $("questionLabel").textContent = `QUESTION ${index + 1}`;
    $("questionCount").textContent = `${index + 1} / ${questions.length}`;
    $("progressText").textContent =
      `Question ${index + 1} of ${questions.length}`;
    $("questionText").textContent = q.question_text || q.question || "Question";
    $("hintText").textContent =
      q.hint ||
      q.explanation ||
      "Read the question carefully and eliminate options that do not fit.";
    $("hintText").classList.add("hidden");
    $("hintToggle").textContent = "Need a hint?";
    $("options").innerHTML = (q.options || [])
      .map((o, i) => {
        const label = typeof o === "string" ? o : o.label || o.text || o.value;
        const value = typeof o === "string" ? o : o.value || label;
        return `<button class="option-row ${answers[index] === value ? "selected" : ""}" data-answer="${NC.escape(value)}"><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${NC.escape(label)}</span><i>${answers[index] === value ? "✓" : ""}</i></button>`;
      })
      .join("");
    $("options")
      .querySelectorAll("[data-answer]")
      .forEach((b) =>
        b.addEventListener("click", () => {
          answers[index] = b.dataset.answer;
          render();
          saveRemote();
        }),
      );
    $("previousButton").disabled = index === 0;
    $("nextButton").textContent =
      index === questions.length - 1 ? "Review answers →" : "Next question →";
    renderPalette();
    saveLocal();
  }
  function renderPalette() {
    $("paletteCount").textContent = `${questions.length} questions`;
    $("paletteGrid").innerHTML = questions
      .map(
        (q, i) =>
          `<button class="palette-number ${answers[i] !== undefined ? "attempted" : seen.has(i) ? "visited" : ""} ${i === index ? "current" : ""}" data-jump="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`,
      )
      .join("");
    $("paletteGrid")
      .querySelectorAll("[data-jump]")
      .forEach((b) =>
        b.addEventListener("click", () => {
          index = Number(b.dataset.jump);
          render();
          closePalette();
        }),
      );
  }
  $("previousButton").addEventListener("click", () => {
    if (index > 0) {
      index--;
      render();
    }
  });
  $("nextButton").addEventListener("click", () => {
    if (index < questions.length - 1) {
      index++;
      render();
    } else openSubmit();
  });
  $("hintToggle").addEventListener("click", () => {
    $("hintText").classList.toggle("hidden");
    $("hintToggle").textContent = $("hintText").classList.contains("hidden")
      ? "Need a hint?"
      : "Hide hint";
  });
  function openPalette() {
    $("questionPalette").classList.add("open");
    $("paletteScrim").classList.add("show");
  }
  function closePalette() {
    $("questionPalette").classList.remove("open");
    $("paletteScrim").classList.remove("show");
  }
  $("paletteToggle").addEventListener("click", openPalette);
  $("paletteClose").addEventListener("click", closePalette);
  $("paletteScrim").addEventListener("click", closePalette);
  function openSubmit() {
    const missing = questions.length - Object.keys(answers).length;
    $("submitSummary").textContent =
      `You have answered ${Object.keys(answers).length} of ${questions.length} questions. ${missing ? missing + " will remain unanswered." : "All questions have an answer."}`;
    $("confirmModal").classList.remove("hidden");
  }
  $("submitQuiz").addEventListener("click", openSubmit);
  $("cancelSubmit").addEventListener("click", () =>
    $("confirmModal").classList.add("hidden"),
  );
  $("confirmSubmit").addEventListener("click", submit);
  async function submit() {
    if (submitting) return;
    submitting = true;
    $("confirmSubmit").disabled = true;
    $("confirmSubmit").textContent = "Submitting…";
    let score = 0,
      correct = 0,
      wrong = 0,
      unanswered = 0;
    const snapshot = [];
    questions.forEach((q, i) => {
      const correctValue = q.correct_answer ?? q.answer ?? q.correct_option;
      const selected = answers[i];
      const ok =
        selected !== undefined && String(selected) === String(correctValue);
      if (selected === undefined) unanswered++;
      else if (ok) {
        correct++;
        score += Number(quiz.positive_marks ?? 1);
      } else {
        wrong++;
        score -= Number(quiz.negative_marks ?? 0);
      }
      snapshot.push({
        question_id: q.id,
        question_text: q.question_text || q.question,
        options: q.options,
        correct_answer: correctValue,
        explanation: q.explanation || "",
        selected_answer: selected ?? null,
        is_correct: ok,
        marks_awarded:
          selected === undefined
            ? 0
            : ok
              ? Number(quiz.positive_marks ?? 1)
              : -Number(quiz.negative_marks ?? 0),
      });
    });
    const payload = {
      quiz_id: quizId,
      student_id: p.id,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      score,
      correct_count: correct,
      incorrect_count: wrong,
      unanswered_count: unanswered,
      elapsed_seconds: Math.round((Date.now() - started) / 1000),
      answers: snapshot,
    };
    let id = attemptId;
    if (window.sb && quizId) {
      let res;
      if (attemptId)
        res = await window.sb
          .from("quiz_attempts")
          .update(payload)
          .eq("id", attemptId)
          .select("id")
          .single();
      else
        res = await window.sb
          .from("quiz_attempts")
          .insert(payload)
          .select("id")
          .single();
      if (res.error) {
        NC.toast("Could not submit yet. Your answers remain saved; try again.");
        submitting = false;
        $("confirmSubmit").disabled = false;
        $("confirmSubmit").textContent = "Try again";
        return;
      }
      id = res.data?.id;
    }
    try {
      localStorage.setItem(
        "nc-result-" + (id || "demo"),
        JSON.stringify({
          ...payload,
          quiz_title: quiz.title,
          subject: quiz.subject,
        }),
      );
      localStorage.removeItem("nc-quiz-" + (quizId || "demo"));
    } catch {}
    location.href = `analysis.html?attempt=${encodeURIComponent(id || "demo")}`;
  }
  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  function timer() {
    if (remaining <= 0) {
      clearInterval(tick);
      submit();
      return;
    }
    remaining--;
    $("timer").textContent = fmt(remaining);
    if (remaining < 60) $("timer").classList.add("timer-warning");
  }
  $("timer").textContent = fmt(remaining);
  tick = setInterval(timer, 1000);
  render();
});
