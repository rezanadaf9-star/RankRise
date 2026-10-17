document.addEventListener("DOMContentLoaded", async () => {
  const p = await NC.guard();
  if (!p) return;
  if (p.role !== "admin") {
    location.replace("../dashboard.html");
    return;
  }
  const panel = document.getElementById("adminPanel"),
    notice = document.getElementById("adminNotice");
  notice.textContent =
    "Admin access verified. Student account creation is performed securely through the Supabase Edge Function.";
  const tabs = [...document.querySelectorAll("[data-admin-tab]")];
  async function openTab(tab) {
    tabs.forEach((b) =>
      b.classList.toggle("active", b.dataset.adminTab === tab),
    );
    if (tab === "overview") {
      const [s, q, a] = await Promise.all([
        NC.rows("profiles", (x) => x.eq("role", "student")),
        NC.rows("quizzes"),
        NC.rows("quiz_attempts"),
      ]);
      panel.innerHTML = `<div class="stat-grid"><div class="stat-card"><span>Students</span><strong>${s.length}</strong></div><div class="stat-card"><span>Quizzes</span><strong>${q.length}</strong></div><div class="stat-card"><span>Attempts</span><strong>${a.length}</strong></div></div><div class="leaderboard-card"><h3>Quick start</h3><p class="muted">Create student accounts first, then build quizzes and publish marks.</p></div>`;
    }
    if (tab === "students") {
      panel.innerHTML = `<div class="leaderboard-card"><div class="section-heading"><div><h2>Student accounts</h2><p class="muted">Create private accounts for students.</p></div></div><form id="createStudentForm" class="admin-form"><label>Full name<input name="full_name" required placeholder="e.g. Nida Rahman"></label><div class="form-grid"><label>Class<select name="class_name"><option value="10">Class 10</option><option value="12">Class 12</option></select></label><label>Roll number<input name="roll_number" placeholder="Optional"></label></div><label>Phone number (optional)<input name="phone" inputmode="tel" placeholder="Student/parent phone"></label><label>Profile photo<input name="photo" type="file" accept="image/*"></label><button class="button primary" type="submit">Create student account</button><p id="studentResult" class="form-message"></p></form><div id="studentCredentials"></div></div><div class="leaderboard-card"><h3>Existing students</h3><div id="studentTable" class="attempt-list">Loading…</div></div>`;
      document
        .getElementById("createStudentForm")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.currentTarget,
            fd = new FormData(f),
            result = document.getElementById("studentResult");
          result.textContent = "Creating securely…";
          const photo = f.elements.photo.files[0];
          let photoBase64 = null;
          if (photo) {
            photoBase64 = await new Promise((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.onerror = reject;
              r.readAsDataURL(photo);
            });
          }
          const {
            data: { session },
          } = await window.sb.auth.getSession();
          const resp = await fetch(
            `${window.SUPABASE_CONFIG.url}/functions/v1/Create-Student`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
                apikey: window.SUPABASE_CONFIG.anonKey,
              },
              body: JSON.stringify({
                full_name: fd.get("full_name"),
                class_name: fd.get("class_name"),
                roll_number: fd.get("roll_number"),
                phone: fd.get("phone"),
                photo_base64: photoBase64,
              }),
            },
          );
          const out = await resp
            .json()
            .catch(() => ({ error: "Could not read server response" }));
          if (!resp.ok) {
            result.textContent = out.error || "Account creation failed.";
            return;
          }
          result.textContent = "Student account created.";
          const msg = `Welcome to RankRise!\\nWebsite: ${location.origin}${location.pathname.replace(/admin\/index\.html$/, "")}\\nStudent ID: ${out.student_id}\\nPassword: ${out.password}\\nClass: ${out.class_name}\\nPlease keep your login details private.`;
          document.getElementById("studentCredentials").innerHTML =
            `<div class="credential-card"><p class="eyebrow">SAVE THESE ONCE</p><h3>${NC.escape(out.full_name)}</h3><p>Student ID</p><code>${NC.escape(out.student_id)}</code><p>Temporary password</p><code>${NC.escape(out.password)}</code><button class="button secondary full" id="copyCredentials">Copy WhatsApp message</button><p class="muted">This password will not be shown again.</p></div>`;
          document
            .getElementById("copyCredentials")
            .addEventListener("click", async () => {
              await navigator.clipboard.writeText(msg);
              NC.toast("Credential message copied.");
            });
          f.reset();
          loadStudents();
        });
      async function loadStudents() {
        const rows = await NC.rows("profiles", (q) =>
          q.eq("role", "student").order("full_name"),
        );
        document.getElementById("studentTable").innerHTML =
          rows
            .map(
              (s) =>
                `<div class="attempt-row"><span class="rank-avatar">${NC.escape(NC.initials(s.full_name))}</span><span><strong>${NC.escape(s.full_name)}</strong><small>ID: ${NC.escape(s.student_id || "—")} · Class ${NC.escape(s.class_name || "10")}</small></span><span class="status-pill">${s.status || "active"}</span></div>`,
            )
            .join("") ||
          '<div class="empty-state">No students created yet.</div>';
      }
      loadStudents();
    }
    if (tab === "quizzes") {
      panel.innerHTML = `<div class="leaderboard-card"><h2>Create a quiz</h2><p class="muted">Enter questions manually as JSON, or import a CSV/Excel file. You can also import a Google Sheet using its published CSV link.</p><form id="quizCreateForm" class="admin-form"><label>Quiz title<input name="title" required placeholder="Science Quiz 01"></label><label>Subject<select name="subject">${NC.subjects.map((s) => `<option>${s.name}</option>`).join("")}</select></label><div class="form-grid"><label>Duration (minutes)<input name="duration_minutes" type="number" min="1" value="15" required></label><label>Positive marks per correct answer<input name="positive_marks" type="number" min="0" step="0.25" value="1" required></label><label>Negative marks per wrong answer<input name="negative_marks" type="number" min="0" step="0.25" value="1" required></label></div><div class="import-box" style="border:1px solid var(--line,#dfe4ee);border-radius:14px;padding:16px;margin:16px 0;display:grid;gap:12px"><h3 style="margin:0">Import questions</h3><p class="muted" style="margin:0">Required columns: Question Number, Question, Option A, Option B, Option C, Option D, Correct Option. Correct Option can be A, B, C or D. Optional Explanation column is supported.</p><label>Upload CSV or Excel file<input id="quizImportFile" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label><button class="button secondary" type="button" id="downloadQuizTemplate">Download CSV template</button><label>Google Sheets published CSV URL<input id="googleSheetUrl" type="url" placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"></label><button class="button secondary" type="button" id="importGoogleSheet">Import Google Sheet CSV</button><p id="quizImportMessage" class="form-message" aria-live="polite"></p></div><label>Questions JSON<textarea name="questions_json" rows="9" placeholder='[{"question_text":"...","options":["Option A","Option B","Option C","Option D"],"correct_answer":"Option B","explanation":"..."}]' required></textarea></label><p class="muted">Imported questions will appear here for review. You can edit the JSON before creating the quiz.</p><label class="check-label"><input type="checkbox" name="published"> Publish immediately</label><button class="button primary">Create quiz</button><p id="quizCreateMessage" class="form-message" aria-live="polite"></p></form></div>`;
      const form = document.getElementById("quizCreateForm"),
        jsonInput = form.elements.questions_json,
        importMsg = document.getElementById("quizImportMessage");
      const escText = (x) => String(x ?? "").trim();
      function normalizeRows(rows) {
        if (!rows.length) throw Error("The file has no question rows.");
        const clean = rows.filter((r) => r.some((v) => escText(v) !== ""));
        const first = clean[0].map((v) =>
          escText(v)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ""),
        );
        const aliases = {
          number: [
            "questionnumber",
            "questionno",
            "qno",
            "number",
            "no",
            "srno",
            "serialnumber",
          ],
          question: ["question", "questiontext", "questions"],
          a: ["optiona", "a", "option1", "choicea"],
          b: ["optionb", "b", "option2", "choiceb"],
          c: ["optionc", "c", "option3", "choicec"],
          d: ["optiond", "d", "option4", "choiced"],
          correct: [
            "correctoption",
            "correctanswer",
            "answerkey",
            "answer",
            "correct",
          ],
          explanation: ["explanation", "solution", "rationale"],
        };
        const findIndex = (key) =>
          first.findIndex((h) => aliases[key].includes(h));
        let idx = {};
        Object.keys(aliases).forEach((k) => (idx[k] = findIndex(k)));
        const hasHeaders =
          idx.question >= 0 &&
          idx.a >= 0 &&
          idx.b >= 0 &&
          idx.c >= 0 &&
          idx.d >= 0 &&
          idx.correct >= 0;
        if (!hasHeaders) {
          idx = {
            number: 0,
            question: 1,
            a: 2,
            b: 3,
            c: 4,
            d: 5,
            correct: 6,
            explanation: 7,
          };
        }
        const data = hasHeaders ? clean.slice(1) : clean;
        const output = [];
        data.forEach((r, i) => {
          const val = (k) => (idx[k] >= 0 ? escText(r[idx[k]]) : "");
          const question = val("question"),
            opts = [val("a"), val("b"), val("c"), val("d")],
            answerRaw = val("correct")
              .toUpperCase()
              .replace(/[^A-D]/g, "");
          if (!question && !opts.some(Boolean) && !val("correct")) return;
          if (
            !question ||
            opts.some((o) => !o) ||
            !answerRaw ||
            !"ABCD".includes(answerRaw[0])
          )
            throw Error(
              `Row ${i + (hasHeaders ? 2 : 1)} needs a question, all four options, and a correct option A/B/C/D.`,
            );
          output.push({
            question_text: question,
            options: opts,
            correct_answer: opts["ABCD".indexOf(answerRaw[0])],
            explanation: val("explanation"),
          });
        });
        if (!output.length)
          throw Error(
            "No valid questions were found. Check the column headers and rows.",
          );
        return output;
      }
      function parseCsv(text) {
        const rows = [];
        let row = [],
          cell = "",
          quoted = false;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if (c === '"' && quoted && text[i + 1] === '"') {
            cell += '"';
            i++;
          } else if (c === '"') {
            quoted = !quoted;
          } else if (c === "," && !quoted) {
            row.push(cell);
            cell = "";
          } else if ((c === "\n" || c === "\r") && !quoted) {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(cell);
            if (row.some((v) => String(v).trim())) rows.push(row);
            row = [];
            cell = "";
          } else cell += c;
        }
        row.push(cell);
        if (row.some((v) => String(v).trim())) rows.push(row);
        return rows;
      }
      function setImported(rows) {
        const questions = normalizeRows(rows);
        jsonInput.value = JSON.stringify(questions, null, 2);
        importMsg.textContent = `Imported ${questions.length} question${questions.length === 1 ? "" : "s"}. Review the questions below, then create the quiz.`;
      }
      document
        .getElementById("quizImportFile")
        .addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          importMsg.textContent = "Reading file…";
          try {
            let rows;
            if (/\.csv$/i.test(file.name)) {
              rows = parseCsv(await file.text());
            } else {
              if (!window.XLSX)
                throw Error(
                  "Excel import library did not load. Please try CSV instead.",
                );
              const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
              rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
                header: 1,
                defval: "",
              });
            }
            setImported(rows);
          } catch (err) {
            importMsg.textContent =
              err.message || "Could not import this file.";
          }
        });
      document
        .getElementById("downloadQuizTemplate")
        .addEventListener("click", () => {
          const csv =
            'Question Number,Question,Option A,Option B,Option C,Option D,Correct Option,Explanation\n1,"What is the SI unit of force?",Joule,Newton,Watt,Pascal,B,"The newton is the SI unit of force."\n';
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }),
            url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = "rankrise-quiz-template.csv";
          a.click();
          URL.revokeObjectURL(url);
        });
      document
        .getElementById("importGoogleSheet")
        .addEventListener("click", async () => {
          const url = document.getElementById("googleSheetUrl").value.trim();
          if (!url) {
            importMsg.textContent =
              "Paste a published Google Sheets CSV link first.";
            return;
          }
          if (!/docs\.google\.com\/spreadsheets\//i.test(url)) {
            importMsg.textContent = "Please use a Google Sheets URL.";
            return;
          }
          importMsg.textContent = "Fetching sheet…";
          try {
            const resp = await fetch(url);
            if (!resp.ok)
              throw Error(
                "Could not fetch the sheet. Publish it to the web as CSV and try again.",
              );
            setImported(parseCsv(await resp.text()));
          } catch (err) {
            importMsg.textContent =
              err.message ||
              "Could not import the Google Sheet. Make sure it is published as CSV and accessible without signing in.";
          }
        });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.currentTarget,
          fd = new FormData(f),
          msg = document.getElementById("quizCreateMessage");
        let questions;
        try {
          questions = JSON.parse(fd.get("questions_json"));
          if (!Array.isArray(questions) || !questions.length) throw Error();
          questions = questions.map((x, i) => {
            if (
              !x.question_text ||
              !Array.isArray(x.options) ||
              x.options.length !== 4 ||
              !x.correct_answer
            )
              throw Error(
                `Question ${i + 1} must include text, four options, and a correct answer.`,
              );
            return { ...x, position: i + 1 };
          });
        } catch (err) {
          msg.textContent =
            err.message || "Questions must be a valid non-empty JSON array.";
          return;
        }
        msg.textContent = "Creating quiz…";
        const { data: q, error } = await window.sb
          .from("quizzes")
          .insert({
            title: fd.get("title"),
            subject: fd.get("subject"),
            duration_minutes: Number(fd.get("duration_minutes")),
            positive_marks: Number(fd.get("positive_marks")),
            negative_marks: Number(fd.get("negative_marks")),
            published: fd.get("published") === "on",
            question_count: questions.length,
            created_by: p.id,
          })
          .select()
          .single();
        if (error) {
          msg.textContent = error.message;
          return;
        }
        const payload = questions.map((x, i) => ({
          question_text: x.question_text,
          options: x.options,
          correct_answer: x.correct_answer,
          explanation: x.explanation || "",
          position: i + 1,
          quiz_id: q.id,
        }));
        const { error: qe } = await window.sb.from("questions").insert(payload);
        msg.textContent = qe
          ? "Quiz created, but questions failed to save: " + qe.message
          : `Quiz created with ${questions.length} questions.`;
        if (!qe) {
          f.reset();
          jsonInput.value = "";
          importMsg.textContent = "";
        }
      });
    }
    if (tab === "marks") {
      panel.innerHTML = `<div class="leaderboard-card"><h2>Academic marks</h2><p class="muted">Save one record per exam, class, student and subject. Saving never publishes automatically. Use Publish Results to publish all saved subjects for every student in the selected exam and class.</p><form id="marksForm" class="admin-form"><label>Exam name<input name="exam_name" required placeholder="Half Yearly Examination"></label><div class="form-grid"><label>Class<select name="class_name"><option value="10">Class 10</option><option value="12">Class 12</option></select></label><label>Subject<select name="subject">${NC.subjects.map((s) => `<option>${s.name}</option>`).join("")}</select></label></div><label>Student<select name="student_id" id="marksStudent" required></select></label><div class="form-grid"><label>Marks obtained<input name="marks_obtained" type="number" min="0" step="0.5" required></label><label>Full marks<input name="full_marks" type="number" min="1" step="0.5" value="100" required></label></div><label>Exam date<input name="exam_date" type="date"></label><button class="button primary" type="submit">Save / Update Subject Marks</button><p id="marksMessage" class="form-message" aria-live="polite"></p></form></div><div class="leaderboard-card"><div class="section-heading"><div><h2>Saved results</h2><p class="muted">Records for the selected examination and class.</p></div><button id="publishAllMarks" class="button primary" type="button">Publish Results</button></div><div id="savedMarksMessage" class="form-message" aria-live="polite"></div><div id="savedMarksList" class="attempt-list">Loading saved results…</div></div>`;
      const students = await NC.rows("profiles", (q) => q.eq("role", "student"));
      const studentSelect = document.getElementById("marksStudent");
      studentSelect.innerHTML = students.map((s) => `<option value="${s.id}" data-class="${NC.escape(String(s.class_name || "10"))}">${NC.escape(s.full_name)} · ${NC.escape(s.student_id || "")}</option>`).join("");
      const form = document.getElementById("marksForm");
      const savedList = document.getElementById("savedMarksList");
      const message = document.getElementById("savedMarksMessage");
      const currentKey = () => ({ exam_name: form.elements.exam_name.value.trim(), class_name: form.elements.class_name.value });
      async function refreshSaved() {
        const key = currentKey();
        if (!key.exam_name) { savedList.textContent = "Enter an exam name to view saved results."; return; }
        savedList.textContent = "Loading…";
        const { data, error } = await window.sb.from("academic_marks").select("id,exam_name,class_name,subject,student_id,marks_obtained,full_marks,exam_date,published").eq("exam_name", key.exam_name).eq("class_name", key.class_name).order("subject");
        if (error) { savedList.textContent = "Could not load saved results: " + error.message; return; }
        if (!data || !data.length) { savedList.textContent = "No marks saved for this exam and class yet."; return; }
        savedList.innerHTML = data.map((r) => `<div class="attempt-item"><div><strong>${NC.escape(r.profiles?.full_name || "Student")} · ${NC.escape(r.subject)}</strong><small>${NC.escape(r.profiles?.student_id || "")} · ${r.exam_date || "No exam date"}</small></div><div><strong>${r.marks_obtained} / ${r.full_marks}</strong><small>${r.published ? "Published" : "Saved · Unpublished"}</small></div></div>`).join("");
      }
      form.elements.exam_name.addEventListener("change", refreshSaved);
      form.elements.class_name.addEventListener("change", refreshSaved);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form), msg = document.getElementById("marksMessage");
        const examName = String(fd.get("exam_name")).trim();
        const className = String(fd.get("class_name"));
        const studentId = String(fd.get("student_id"));
        const subject = String(fd.get("subject"));
        const marks = Number(fd.get("marks_obtained"));
        const full = Number(fd.get("full_marks"));
        if (!examName || !studentId || !subject || marks < 0 || full <= 0 || marks > full) { msg.textContent = "Check the exam, student, subject and marks. Marks cannot exceed full marks."; return; }
        msg.textContent = "Saving…";
        const { error } = await window.sb.from("academic_marks").upsert({
          exam_name: examName, class_name: className, subject, student_id: studentId,
          marks_obtained: marks, full_marks: full, exam_date: fd.get("exam_date") || null,
          published: false, entered_by: p.id,
        }, { onConflict: "exam_name,class_name,subject,student_id" });
        msg.textContent = error ? "Save failed: " + error.message : "Marks saved. Re-saving this student/subject updates the existing record; it does not create a duplicate.";
        if (!error) await refreshSaved();
      });
      document.getElementById("publishAllMarks").addEventListener("click", async () => {
        const key = currentKey();
        if (!key.exam_name) { message.textContent = "Enter the exam name first."; return; }
        if (!confirm(`Publish ALL saved subjects for ALL students in ${key.exam_name} · Class ${key.class_name}?`)) return;
        message.textContent = "Publishing all saved results…";
        const { data: rows, error: readError } = await window.sb.from("academic_marks").select("id").eq("exam_name", key.exam_name).eq("class_name", key.class_name);
        if (readError) { message.textContent = "Could not check saved results: " + readError.message; return; }
        if (!rows || !rows.length) { message.textContent = "No saved results to publish for this exam and class."; return; }
        const { error } = await window.sb.from("academic_marks").update({ published: true }).eq("exam_name", key.exam_name).eq("class_name", key.class_name);
        message.textContent = error ? "Publish failed: " + error.message : `Published ${rows.length} subject-result record(s) for all students in this exam and class.`;
        if (!error) await refreshSaved();
      });
      await refreshSaved();
    }
    if (tab === "settings") {
      panel.innerHTML = `<div class="leaderboard-card"><h2>Website settings</h2><form id="settingsForm" class="admin-form"><label>Website URL<input name="website_url" placeholder="https://your-site.example"></label><label>Display name<input name="site_name" value="RankRise"></label><button class="button primary">Save settings</button><p id="settingsMessage" class="form-message"></p></form></div>`;
      const rows = await NC.rows("app_settings");
      const s = rows[0] || {};
      document.querySelector('[name="website_url"]').value =
        s.website_url || "";
      document.querySelector('[name="site_name"]').value =
        s.site_name || "RankRise";
      document
        .getElementById("settingsForm")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const { error } = await window.sb
            .from("app_settings")
            .upsert({
              id: 1,
              website_url: fd.get("website_url"),
              site_name: fd.get("site_name"),
              updated_by: p.id,
            });
          document.getElementById("settingsMessage").textContent = error
            ? error.message
            : "Settings saved.";
        });
    }
  }
  tabs.forEach((b) =>
    b.addEventListener("click", () => openTab(b.dataset.adminTab)),
  );
  openTab("overview");
});
