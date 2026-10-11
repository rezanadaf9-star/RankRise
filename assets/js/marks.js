document.addEventListener("DOMContentLoaded",async()=>{
 const p=await NC.guard();if(!p)return;
 const rows=await NC.rows("academic_marks",q=>q.eq("student_id",p.id).eq("published",true).order("exam_date",{ascending:false}));
 const box=document.getElementById("marksList");
 if(!rows.length){box.innerHTML='<div class="empty-state">No published marks yet. Your admin will publish exam results here.</div>';return;}
 const total=rows.reduce((s,r)=>s+Number(r.marks_obtained||0),0),full=rows.reduce((s,r)=>s+Number(r.full_marks||0),0);
 document.getElementById("marksSummary").innerHTML=`<div class="stat-card"><span>Published subjects</span><strong>${rows.length}</strong></div><div class="stat-card"><span>Overall percentage</span><strong>${full?Math.round(total/full*1000)/10:0}%</strong></div><div class="stat-card"><span>Best class rank</span><strong>${Math.min(...rows.map(r=>r.class_rank||Infinity))===Infinity?"—":Math.min(...rows.map(r=>r.class_rank||Infinity))}</strong></div>`;
 box.innerHTML=rows.map(r=>`<article class="mark-row"><div><strong>${NC.escape(r.exam_name||"Exam")} · ${NC.escape(r.subject||"Subject")}</strong><small>${r.exam_date?new Date(r.exam_date).toLocaleDateString():"Published result"}</small></div><div class="mark-score"><strong>${r.marks_obtained} <small>/ ${r.full_marks}</small></strong><span>${r.full_marks?Math.round(r.marks_obtained/r.full_marks*1000)/10:0}%</span></div><span class="rank-pill">Rank #${r.class_rank||"—"}</span></article>`).join("");
});
