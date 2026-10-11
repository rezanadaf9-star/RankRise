document.addEventListener("DOMContentLoaded",async()=>{
 const p=await NC.guard();if(!p)return;
 const h=new Date().getHours();document.getElementById("greetingTime").textContent=h<12?"GOOD MORNING":h<17?"GOOD AFTERNOON":"GOOD EVENING";
 document.getElementById("todayDate").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
 document.getElementById("studentName").textContent=p.full_name||"Student";
 async function renderPodium(attemptsId, ranksId, cumulative=false){
  const box=document.getElementById(attemptsId), list=document.getElementById(ranksId);
  if(!window.sb){return;}
  const {data,error}=await window.sb.rpc(cumulative?"get_cumulative_leaderboard":"get_latest_quiz_leaderboard",{p_class:p.class_name||"10"});
  if(error||!data?.length){box.innerHTML='<div class="podium-empty">Your class leaderboard will appear when quiz results are available.</div>';return;}
  const sorted=[...data].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,3);
  const order=[sorted[1],sorted[0],sorted[2]].filter(Boolean);
  box.innerHTML=order.map((s,i)=>{const rank=s.rank||data.indexOf(s)+1, cls=rank===1?"first":rank===2?"second":"third";return `<div class="podium-place ${cls}"><div class="podium-person"><div class="podium-avatar">${s.photo_url?`<img src="${NC.escape(s.photo_url)}" alt="">`:NC.escape(NC.initials(s.full_name))}</div>${rank===1?'<img class="crown" src="assets/images/crown.png" alt="">':""}<span class="podium-rank">${rank===1?"1st":rank===2?"2nd":"3rd"}</span><strong>${NC.escape(s.full_name||"Student")}${s.id===p.id?' <em>You</em>':""}</strong><b>${Math.round(s.score||0)}</b></div></div>`}).join("");
  list.innerHTML=data.filter(s=>(s.rank||data.indexOf(s)+1)>3).slice(0,12).map((s,i)=>`<div class="rank-row ${s.id===p.id?"is-you":""}"><span class="rank-number">${s.rank||i+4}</span><span class="rank-avatar">${NC.escape(NC.initials(s.full_name))}</span><span class="rank-name">${NC.escape(s.full_name||"Student")}${s.id===p.id?' <em>You</em>':""}</span><strong>${Math.round(s.score||0)}</strong></div>`).join("");
 }
 await Promise.all([renderPodium("latestPodium","latestRanks"),renderPodium("cumulativePodium","cumulativeRanks",true)]);
});
