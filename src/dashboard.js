import { firebaseReady, watchAuth, teacherSignIn, teacherSignOut, dbRef, dbGet, dbSet, dbUpdate, dbRemove, dbPush, dbWatch, timestamp } from "./firebase.js";

const $ = id => document.getElementById(id);
const loginPanel=$("login-panel"), dashboardPanel=$("dashboard-panel"), notice=$("firebase-notice");
let teacher=null, stopSessions=null, stopPlayers=null, stopResults=null, stopAttempts=null, stopQuestionBanks=null, selectedSession=null, sessionCache=[], bankCache=[], bankDraft=[], sessionsLoadVersion=0;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const setStatus=(id,msg)=>{if($(id))$(id).textContent=msg;};
const statusClass=s=>["waiting","running","ended"].includes(s)?s:"ended";
const formatDate=v=>v?new Date(typeof v==="number"?v:Date.parse(v)).toLocaleString():"—";
const studentUrl=id=>{const u=new URL("./",window.location.href);u.searchParams.set("session",id);return u.toString();};
const safeName=v=>String(v||"").trim().slice(0,70);

if(!firebaseReady){notice.classList.remove("hidden");loginPanel.classList.add("hidden");}
else{
  $("login-form").addEventListener("submit",async e=>{
    e.preventDefault();setStatus("login-status","Signing in…");
    try{await teacherSignIn($("login-email").value.trim(),$("login-password").value);setStatus("login-status","");}
    catch(err){setStatus("login-status",err.message||"Unable to sign in.");}
  });
  $("logout-button").addEventListener("click",()=>teacherSignOut());
  watchAuth(user=>{
    teacher=user;
    const isTeacher=Boolean(user&&!user.isAnonymous);
    loginPanel.classList.toggle("hidden",isTeacher);
    dashboardPanel.classList.toggle("hidden",!isTeacher);
    $("logout-button").classList.toggle("hidden",!isTeacher);
    $("teacher-email").textContent=isTeacher?user.email:"";
    if(isTeacher){watchSessions();watchQuestionBanks();}else stopWatching();
  });
}


function watchQuestionBanks(){
  if(stopQuestionBanks)stopQuestionBanks();
  stopQuestionBanks=dbWatch("teacherSessions/"+teacher.uid+"/questionBanks",snap=>{
    const value=snap.val()||{};
    bankCache=Object.entries(value).map(([id,bank])=>({id,...bank})).sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    renderQuestionBanks();
  },err=>setStatus("bank-status",err.message));
}
function normalizeBankQuestion(raw, subject, topic){
  const q=String(raw.q??raw.question??"").trim();
  const answers=Array.isArray(raw.a)?raw.a:(Array.isArray(raw.answers)?raw.answers:[raw.answer1??raw.optiona??raw.choicea,raw.answer2??raw.optionb??raw.choiceb,raw.answer3??raw.optionc??raw.choicec,raw.answer4??raw.optiond??raw.choiced]);
  const a=answers.map(v=>String(v??"").trim());
  while(a.length>2&&!a[a.length-1])a.pop();
  if(a.some(v=>!v))throw new Error("Answer choices cannot contain blank gaps. Fill each choice or remove unused choices at the end.");
  if(new Set(a.map(v=>v.toLowerCase())).size!==a.length)throw new Error("Answer choices must be different from one another.");
  const suppliedCorrect=raw.correct??raw.correctAnswer??raw.answer;
  if(suppliedCorrect===undefined||suppliedCorrect===null||String(suppliedCorrect).trim()==="")throw new Error("Every question must specify its correct answer (A–D or 1–4).");
  let correct=suppliedCorrect;
  if(typeof correct==="string"){
    const value=correct.trim().toUpperCase();
    correct=/^[A-D]$/.test(value)?value.charCodeAt(0)-65:/^[1-4]$/.test(value)?Number(value)-1:Number(value);
  }
  if(!q||a.length<2||a.length>4||!Number.isInteger(Number(correct))||Number(correct)<0||Number(correct)>=a.length)throw new Error("Each question needs text, 2–4 answers, and a valid correct answer.");
  return {topic:String(raw.topic||topic||subject||"General").trim(),grade:String(raw.grade||"Mixed"),q,a,correct:Number(correct),effect:String(raw.effect||"GRAMMAR POWER!").trim(),explanation:String(raw.explanation||"").trim(),sourceQuote:String(raw.sourceQuote||raw.source_quote||"").trim(),sourceSection:String(raw.sourceSection||raw.source_section||"").trim(),confidence:String(raw.confidence||"").trim(),reviewRequired:Boolean(raw.reviewRequired),approved:Boolean(raw.approved)};
}
function parseQuestionCsv(source){
  source=String(source).replace(/^\uFEFF/,"");
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'&&quoted&&source[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell="";}else cell+=c;}
  if(quoted)throw new Error("CSV contains an unclosed quotation mark. Check the question or answer text and try again.");
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw new Error("CSV needs a header row and at least one question.");
  const headers=rows.shift().map(v=>v.trim().toLowerCase().replace(/[ _-]+/g,""));
  if(headers.some(key=>!key))throw new Error("CSV headers cannot be blank.");
  if(new Set(headers).size!==headers.length)throw new Error("CSV contains duplicate column headers. Rename each header so it is unique.");
  return rows.map(values=>Object.fromEntries(headers.map((key,i)=>[key,values[i]??""])));
}
function updateBankDraftCount(){
  setStatus("bank-draft-count",bankDraft.length+" questions in draft");
  const preview=$("bank-draft-preview");
  if(!preview)return;
  preview.innerHTML=bankDraft.map((q,i)=>`<article class="draft-question">
    ${q.reviewRequired?`<b>Question ${i+1} — teacher review required</b>
      <label>Question<input class="review-field" data-draft-index="${i}" data-draft-field="q" value="${escapeHtml(q.q)}"></label>
      <div class="review-options">${[0,1,2,3].map(n=>`<label>Answer ${"ABCD"[n]}<input class="review-field" data-draft-index="${i}" data-draft-answer="${n}" value="${escapeHtml(q.a[n]||"")}" placeholder="Answer ${"ABCD"[n]}"></label>`).join("")}</div>
      <label>Correct answer<select class="review-field" data-draft-index="${i}" data-draft-field="correct">${["A","B","C","D"].map((letter,n)=>`<option value="${n}" ${q.correct===n?"selected":""}>${letter}</option>`).join("")}</select></label>
      <label>Explanation<textarea class="review-field" data-draft-index="${i}" data-draft-field="explanation" rows="2">${escapeHtml(q.explanation||"")}</textarea></label>
      <label>Exact source evidence<textarea class="review-field" data-draft-index="${i}" data-draft-field="sourceQuote" rows="2">${escapeHtml(q.sourceQuote||"")}</textarea></label>
      <label>Source section<input class="review-field" data-draft-index="${i}" data-draft-field="sourceSection" value="${escapeHtml(q.sourceSection||"")}"></label>
      <small>AI confidence: ${escapeHtml(q.confidence||"not provided")} • Source quote is checked against the uploaded document.</small>
      <label class="review-check"><input type="checkbox" data-review-index="${i}" ${q.approved?"checked":""}> I verified the correct answer, explanation, and source evidence.</label>`: `<b>${i+1}. ${escapeHtml(q.q)}</b><small>Correct answer: ${escapeHtml(q.a[q.correct])}</small>${q.explanation?`<small>${escapeHtml(q.explanation)}</small>`:""}`}
  </article>`).join("");
}
function renderQuestionBanks(){
  const select=$("session-bank"),current=select.value;
  select.innerHTML='<option value="">Built-in Grammar Questions</option>'+bankCache.map(b=>'<option value="'+escapeHtml(b.id)+'">'+escapeHtml(b.subject+" • "+b.topic+" ("+(b.questions?.length||0)+")")+'</option>').join("");
  if(bankCache.some(b=>b.id===current))select.value=current;
  $("bank-list").innerHTML=bankCache.length?bankCache.map(b=>'<div class="bank-row" data-bank="'+escapeHtml(b.id)+'"><div><b>'+escapeHtml(b.subject||"Subject")+' • '+escapeHtml(b.topic||"Untitled topic")+'</b><small>'+(b.questions?.length||0)+' questions</small></div><div><button class="button ghost" data-bank-action="load">Edit</button><button class="button ghost" data-bank-action="delete">Delete</button></div></div>').join(""):'<div class="empty">No saved question sets yet.</div>';
}
$("bank-load-file").addEventListener("click",async()=>{
  const file=$("bank-file").files?.[0];if(!file){setStatus("bank-status","Choose a .JSON or .CSV file first.");return;}
  try{
    const source=await file.text();let raw;
    if(file.name.toLowerCase().endsWith(".json")){const parsed=JSON.parse(source);raw=Array.isArray(parsed)?parsed:parsed.questions;}
    else raw=parseQuestionCsv(source);
    if(!Array.isArray(raw)||!raw.length)throw new Error("No question records found in this file.");
    if(raw.length>300)throw new Error("This question set contains "+raw.length+" questions. The limit is 300; split the file into smaller sets.");
    const subject=$("bank-subject").value.trim(),topic=$("bank-topic").value.trim();
    const imported=raw.map(item=>normalizeBankQuestion(item,subject,topic));
    bankDraft=imported;updateBankDraftCount();setStatus("bank-status","Loaded "+imported.length+" questions. Review the draft, then save the question set.");
  }catch(error){setStatus("bank-status",error.message||"Could not read this file.");}
});
$("manual-question-form").addEventListener("submit",e=>{
  e.preventDefault();
  if(bankDraft.length>=300){setStatus("bank-status","A question set can contain up to 300 questions. Save this set or clear the draft before adding more.");return;}
  try{
    const item=normalizeBankQuestion({q:$("bank-q").value,a:[$("bank-a1").value,$("bank-a2").value,$("bank-a3").value],correct:Number($("bank-correct").value),grade:$("bank-grade").value},$("bank-subject").value,$("bank-topic").value);
    bankDraft.push(item);updateBankDraftCount();$("manual-question-form").reset();setStatus("bank-status","Question added to draft.");
  }catch(error){setStatus("bank-status",error.message);}
});
$("bank-save").addEventListener("click",async()=>{
  if(!teacher)return;
  const subject=$("bank-subject").value.trim(),topic=$("bank-topic").value.trim();
  if(!subject||!topic||!bankDraft.length){setStatus("bank-status","Enter a subject, topic, and at least one question.");return;}
  try{bankDraft=bankDraft.map(q=>normalizeBankQuestion(q,subject,topic));}
  catch(error){setStatus("bank-status",error.message);return;}
  const pendingReview=bankDraft.filter(q=>q.reviewRequired&&!q.approved).length;
  if(pendingReview){setStatus("bank-status","Please approve all "+pendingReview+" source-based questions before saving.");return;}
  if(bankDraft.length>300){setStatus("bank-status","A question set can contain up to 300 questions.");return;}
  const id=$("bank-edit-id").value||dbPush("teacherSessions/"+teacher.uid+"/questionBanks").key;
  const existing=bankCache.find(b=>b.id===id);
  try{
    await dbSet("teacherSessions/"+teacher.uid+"/questionBanks/"+id,{subject,topic,questions:bankDraft,createdAt:existing?.createdAt||Date.now(),updatedAt:Date.now()});
    $("bank-edit-id").value=id;setStatus("bank-status","Saved "+bankDraft.length+" questions. You can now select this set when creating a session.");
  }catch(error){setStatus("bank-status",error.message||"Could not save the question set.");}
});
$("bank-clear").addEventListener("click",()=>{bankDraft=[];$("bank-edit-id").value="";updateBankDraftCount();setStatus("bank-status","Draft cleared.");});

$("bank-draft-preview").addEventListener("input",e=>{
  const field=e.target.closest("[data-draft-index]");if(!field)return;
  const item=bankDraft[Number(field.dataset.draftIndex)];if(!item)return;
  if(field.dataset.draftAnswer!==undefined){item.a[Number(field.dataset.draftAnswer)]=field.value;}
  else if(field.dataset.draftField==="correct")item.correct=Number(field.value);
  else item[field.dataset.draftField]=field.value;
  item.approved=false;
  const approval=$("bank-draft-preview").querySelector('input[data-review-index="'+field.dataset.draftIndex+'"]');
  if(approval)approval.checked=false;
});
$("bank-draft-preview").addEventListener("change",e=>{
  const box=e.target.closest("input[data-review-index]");if(!box)return;
  const index=Number(box.dataset.reviewIndex),item=bankDraft[index];if(!item)return;
  if(box.checked){
    try{
      normalizeBankQuestion(item,$("bank-subject").value,$("bank-topic").value);
      const compact=s=>String(s||"").toLowerCase().replace(/\\s+/g," ").trim();
      if(!item.sourceQuote||!compact($("docx-source").value).includes(compact(item.sourceQuote)))throw new Error("The source evidence must exactly match the uploaded Word lesson.");
      if(!item.explanation.trim())throw new Error("Add an explanation before approval.");
      item.approved=true;setStatus("bank-status","Question "+(index+1)+" approved.");
    }catch(error){box.checked=false;item.approved=false;setStatus("bank-status","Question "+(index+1)+": "+error.message);}
  }else{item.approved=false;setStatus("bank-status","Approval removed; this question cannot be saved yet.");}
});
$("docx-extract").addEventListener("click",async()=>{
  const file=$("docx-file").files?.[0];
  const status=$("docx-status");
  if(!file){setStatus("docx-status","Please choose a .DOCX Word document first.");return;}
  if(!/\.docx$/i.test(file.name)){setStatus("docx-status","This file is not a .DOCX document. Save it as Word Document (.docx) and try again.");return;}
  if(file.size>10*1024*1024){setStatus("docx-status","This Word document is larger than 10 MB. Please use a smaller file.");return;}
  setStatus("docx-status","Starting Word reader…");
  const loadMammoth=()=>new Promise((resolve,reject)=>{
    if(window.mammoth?.extractRawText)return resolve(window.mammoth);
    const urls=["https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js","https://unpkg.com/mammoth@1.8.0/mammoth.browser.min.js","https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js"];
    let index=0;
    const tryNext=()=>{
      if(window.mammoth?.extractRawText)return resolve(window.mammoth);
      if(index>=urls.length)return reject(new Error("The Word-reading library could not load. Check your internet connection, disable script-blocking extensions for this site, then refresh."));
      const script=document.createElement("script");script.src=urls[index++];script.async=true;
      script.onload=()=>window.mammoth?.extractRawText?resolve(window.mammoth):tryNext();
      script.onerror=tryNext;document.head.appendChild(script);
    };
    tryNext();
  });
  try{
    if(status)status.textContent="Loading Word document reader…";
    const mammoth=await loadMammoth();
    if(status)status.textContent="Reading "+file.name+"…";
    const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    const source=String(result.value||"").replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
    if(source.length<80)throw new Error("Very little readable text was found. Make sure this is a text-based .DOCX file, not a scanned image or legacy .DOC file.");
    if(source.length>60000)throw new Error("The extracted lesson is longer than 60,000 characters. Split it into smaller Word documents.");
    $("docx-source").value=source;
    if(!$("bank-topic").value.trim())$("bank-topic").value=file.name.replace(/\.docx$/i,"").replace(/[_-]+/g," ");
    setStatus("docx-status","Success: read "+source.length.toLocaleString()+" characters from "+file.name+".");
  }catch(error){
    console.error("Word document import failed:",error);
    setStatus("docx-status","Could not read Word document: "+(error.message||"Unknown error"));
  }
});
$("docx-copy-prompt").addEventListener("click",async()=>{
  const source=$("docx-source").value.trim();
  if(!source){setStatus("docx-status","Read a Word document first.");return;}
  const prompt=`Act as a careful educational assessment writer. Use ONLY the lesson source below. Create 10 multiple-choice questions suitable for the teacher's selected grade. Each question must have 3 or 4 distinct answer choices and exactly one defensible correct answer. Do not use outside facts or invent details. For every question include: q, a (array of choices), correct (A/B/C/D), explanation (brief reason), sourceQuote (an exact verbatim sentence or phrase copied from the source that supports the answer), sourceSection (heading if identifiable), confidence ("high" or "medium"). Avoid ambiguous questions and distractors that could also be correct. If the source does not support enough questions, create fewer rather than guessing. Return ONLY valid JSON in this shape: {"questions":[{"q":"...","a":["...","...","..."],"correct":"A","explanation":"...","sourceQuote":"Exact words from source","sourceSection":"...","confidence":"high"}]}.\n\nLESSON SOURCE:\n${source}`;
  try{await navigator.clipboard.writeText(prompt);setStatus("docx-status","Prompt copied. Open ChatGPT, paste it, then paste the returned JSON below.");}
  catch(error){$("docx-json").value=prompt;setStatus("docx-status","Clipboard access was blocked. The prompt has been placed in the JSON box; copy it manually.");}
});
$("docx-import-json").addEventListener("click",()=>{
  try{
    const parsed=JSON.parse($("docx-json").value.trim());
    const raw=Array.isArray(parsed)?parsed:parsed.questions;
    if(!Array.isArray(raw)||!raw.length)throw new Error("The JSON must contain a non-empty questions array.");
    if(raw.length>50)throw new Error("Import up to 50 generated questions at a time.");
    const source=$("docx-source").value.trim();
    if(!source)throw new Error("Read a Word document first so source evidence can be checked.");
    const compact=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
    const sourceText=compact(source);
    const imported=raw.map((item,index)=>{
      const quote=String(item.sourceQuote||item.source_quote||"").trim();
      if(!quote||!sourceText.includes(compact(quote)))throw new Error("Question "+(index+1)+": its sourceQuote is missing or is not an exact match in the Word document. Regenerate or correct the quote.");
      const q=normalizeBankQuestion({...item,reviewRequired:true,approved:false},$("bank-subject").value.trim(),$("bank-topic").value.trim());
      if(!q.explanation)throw new Error("Question "+(index+1)+": add an explanation before review.");
      return q;
    });
    if(bankDraft.length+imported.length>300)throw new Error("The draft limit is 300 questions. Save or clear some questions first.");
    bankDraft.push(...imported);updateBankDraftCount();
    setStatus("bank-status","Added "+imported.length+" questions for teacher review. Verify each correct answer and approve every item before saving.");
    $("bank-draft-preview").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){setStatus("bank-status",error.message||"Could not import generated questions.");}
});

$("bank-list").addEventListener("click",async e=>{
  const button=e.target.closest("button[data-bank-action]");if(!button)return;
  const id=button.closest("[data-bank]").dataset.bank,bank=bankCache.find(b=>b.id===id);if(!bank)return;
  if(button.dataset.bankAction==="load"){
    $("bank-edit-id").value=id;$("bank-subject").value=bank.subject||"";$("bank-topic").value=bank.topic||"";
    bankDraft=(bank.questions||[]).map(q=>({...q,a:[...q.a]}));updateBankDraftCount();setStatus("bank-status","Loaded saved set for editing.");
    window.scrollTo({top:$("bank-subject").getBoundingClientRect().top+window.scrollY-100,behavior:"smooth"});
  }else if(confirm("Delete this question set? Existing sessions that already copied it will remain unchanged.")){
    await dbRemove("teacherSessions/"+teacher.uid+"/questionBanks/"+id);
    if($("bank-edit-id").value===id){$("bank-edit-id").value="";bankDraft=[];updateBankDraftCount();}
  }
});
updateBankDraftCount();

function stopWatching(){if(stopSessions)stopSessions();if(stopPlayers)stopPlayers();if(stopResults)stopResults();if(stopAttempts)stopAttempts();if(stopQuestionBanks)stopQuestionBanks();stopSessions=stopPlayers=stopResults=stopAttempts=stopQuestionBanks=null;}
function watchSessions(){
  if(stopSessions)stopSessions();
  stopSessions=dbWatch("teacherSessions/"+teacher.uid,snap=>{
    const index=snap.val()||{};
    loadSessions(Object.keys(index).filter(id=>id!=="questionBanks").map(id=>({id,...index[id]})));
  },err=>setStatus("create-status",err.message));
}
async function loadSessions(entries){
  // Ignore older Firebase snapshots if a newer update arrives while reads are pending.
  const loadVersion=++sessionsLoadVersion;
  const loaded=await Promise.all(entries.map(async entry=>{
    try{
      const snap=await dbGet("sessions/"+entry.id+"/public");
      return snap.exists()?{id:entry.id,...snap.val()}:null;
    }catch(error){
      console.warn("Could not refresh session "+entry.id,error);
      return null;
    }
  }));
  if(loadVersion!==sessionsLoadVersion||!teacher)return;
  sessionCache=loaded.filter(Boolean).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  renderSessions();
  if(selectedSession){const fresh=sessionCache.find(s=>s.id===selectedSession.id);if(fresh)selectedSession={...selectedSession,...fresh};renderDetail();}
}
function renderSessions(){
  const q=$("session-search").value.trim().toLowerCase(),filter=$("session-filter").value;
  const list=sessionCache.filter(s=>(filter==="all"||s.status===filter)&&(!q||[s.title,s.grade,s.subject,s.topic,s.section].join(" ").toLowerCase().includes(q)));
  $("session-count").textContent=String(sessionCache.length);
  $("sessions-list").innerHTML=list.length?list.map(s=>`
    <article class="session-card" data-id="${escapeHtml(s.id)}">
      <div class="session-top"><div><b>${escapeHtml(s.title||"Untitled session")}</b><div class="session-sub">${escapeHtml(s.grade||"")}${s.section?" • "+escapeHtml(s.section):""}${s.subject?" • "+escapeHtml(s.subject):""} • ${escapeHtml(s.topic||"General grammar")}<br>${formatDate(s.createdAt)}</div></div><span class="status-pill ${statusClass(s.status)}">${escapeHtml(s.status||"waiting").toUpperCase()}</span></div>
      <div class="session-card-actions"><button class="button ghost" data-action="open">Open / Manage</button><button class="button ghost" data-action="rename">Rename</button><button class="button ghost" data-action="delete">Delete</button></div>
    </article>`).join(""):'<div class="empty">No sessions match this filter.</div>';
}
$("session-search").addEventListener("input",renderSessions);$("session-filter").addEventListener("change",renderSessions);
$("sessions-list").addEventListener("click",async e=>{
  const button=e.target.closest("button[data-action]");if(!button)return;
  const card=button.closest("[data-id]"),s=sessionCache.find(x=>x.id===card.dataset.id);if(!s)return;
  if(button.dataset.action==="open")openSession(s);
  if(button.dataset.action==="rename")await renameSession(s);
  if(button.dataset.action==="delete")await deleteSession(s);
});
$("session-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!teacher)return;
  const title=safeName($("session-title").value);if(!title)return;
  setStatus("create-status","Creating session…");
  try{
    const id=dbPush("sessions").key,now=Date.now();
    const bank=bankCache.find(item=>item.id===$("session-bank").value);const data={teacherId:teacher.uid,title,grade:$("session-grade").value,section:safeName($("session-section").value),subject:bank?.subject||"",topic:bank?.topic||safeName($("session-topic").value)||"General grammar",mode:$("session-mode").value,timeLimitMinutes:Number($("session-minutes").value),questionIntervalSeconds:Number($("session-interval").value),difficulty:$("session-difficulty").value,allowLateJoin:$("session-late-join").checked,status:"waiting",createdAt:now,updatedAt:now,joinCode:Math.random().toString(36).slice(2,8).toUpperCase()};if(bank)data.questions=bank.questions;
    await dbSet("sessions/"+id+"/public",data);
    await dbSet("teacherSessions/"+teacher.uid+"/"+id,{title,status:"waiting",createdAt:now});
    $("session-title").value="";setStatus("create-status","Session created. Open it below to display the QR code.");
    openSession({id,...data});
  }catch(err){setStatus("create-status",err.message||"Could not create session.");}
});
async function renameSession(s){
  const title=prompt("Rename this session:",s.title||"");if(title===null)return;
  const clean=safeName(title);if(!clean)return;
  await dbUpdate("sessions/"+s.id+"/public",{title:clean,updatedAt:Date.now()});
  await dbUpdate("teacherSessions/"+teacher.uid+"/"+s.id,{title:clean});
}
async function deleteSession(s){
  if(!confirm("Permanently delete this session, its student roster, and its results?"))return;
  await dbRemove("sessions/"+s.id);await dbRemove("teacherSessions/"+teacher.uid+"/"+s.id);
  if(selectedSession?.id===s.id){selectedSession=null;$("session-detail").classList.add("hidden");}
}
function openSession(s){
  selectedSession=s;$("session-detail").classList.remove("hidden");renderDetail();
  if(stopPlayers)stopPlayers();if(stopResults)stopResults();if(stopAttempts)stopAttempts();
  stopPlayers=dbWatch("sessions/"+s.id+"/players",snap=>{selectedSession.players=snap.val()||{};renderPlayers();},err=>console.warn(err));
  stopResults=dbWatch("sessions/"+s.id+"/results",snap=>{selectedSession.results=snap.val()||{};renderReport();},err=>console.warn(err));
  stopAttempts=dbWatch("sessions/"+s.id+"/attempts",snap=>{selectedSession.attempts=snap.val()||{};renderReport();},err=>console.warn(err));
  $("session-detail").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderDetail(){
  const s=selectedSession;if(!s)return;
  $("detail-title").textContent=s.title||"Session details";
  $("detail-meta").textContent=[s.grade,s.section,s.subject,s.topic,s.mode==="endless"?"Endless Survival":"Fixed Waves",s.timeLimitMinutes+" min",s.status].filter(Boolean).join(" • ");
  const link=studentUrl(s.id);$("detail-link").value=link;
  $("session-share").classList.toggle("hidden",s.status==="ended");
  $("detail-qr").innerHTML="";if(window.QRCode&&s.status!=="ended")new QRCode($("detail-qr"),{text:link,width:150,height:150,colorDark:"#10243c",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
  const actions=[];
  if(s.status==="waiting")actions.push('<button class="button primary" data-detail-action="start">Start session</button>','<button class="button ghost" data-detail-action="edit">Edit settings</button>');
  if(s.status==="running")actions.push('<button class="button primary" data-detail-action="end">End session</button>');
  actions.push('<button class="button ghost" data-detail-action="copy">Copy student link</button>');
  $("detail-actions").innerHTML=actions.join("");
  renderPlayers();renderReport();
}
$("detail-actions").addEventListener("click",async e=>{
  const b=e.target.closest("button[data-detail-action]");if(!b||!selectedSession)return;
  const s=selectedSession,action=b.dataset.detailAction;
  if(action==="start"){await dbUpdate("sessions/"+s.id+"/public",{status:"running",startedAt:Date.now(),updatedAt:Date.now()});await dbUpdate("teacherSessions/"+teacher.uid+"/"+s.id,{status:"running"});}
  if(action==="end"){if(confirm("End this game session? Students will be notified, the battle will stop, and their final results will be saved.")){await dbUpdate("sessions/"+s.id+"/public",{status:"ended",endedAt:Date.now(),updatedAt:Date.now()});await dbUpdate("teacherSessions/"+teacher.uid+"/"+s.id,{status:"ended"});}}
  if(action==="copy"){await navigator.clipboard.writeText(studentUrl(s.id));alert("Student link copied.");}
  if(action==="edit")await editSession(s);
});
async function editSession(s){
  const title=prompt("Session title:",s.title||"");if(title===null)return;
  const grade=prompt("Grade:",s.grade||"Grade 10");if(grade===null)return;
  const topic=prompt("Topic:",s.topic||"");if(topic===null)return;
  const section=prompt("Class / section:",s.section||"");if(section===null)return;
  const mode=prompt("Mode: endless or fixed",s.mode||"endless");if(mode===null)return;
  const minutes=Number(prompt("Time limit in minutes (5–90):",String(s.timeLimitMinutes||10)));if(!Number.isFinite(minutes)||minutes<5||minutes>90)return alert("Enter a time limit from 5 to 90 minutes.");
  const interval=Number(prompt("Question interval in seconds (30, 45, 60, 90):",String(s.questionIntervalSeconds||45)));if(![30,45,60,90].includes(interval))return alert("Choose 30, 45, 60, or 90 seconds.");
  const difficulty=prompt("Difficulty: easy, normal, hard",s.difficulty||"normal");if(difficulty===null)return;
  const allowLateJoin=confirm("Allow students to join after the game starts? Press OK for Yes, Cancel for No.");
  if(!["endless","fixed"].includes(mode)||!["easy","normal","hard"].includes(difficulty))return alert("Please use a valid mode and difficulty.");
  const clean=safeName(title);if(!clean)return;
  const updated={title:clean,grade:safeName(grade),topic:safeName(topic),section:safeName(section),mode,timeLimitMinutes:minutes,questionIntervalSeconds:interval,difficulty,allowLateJoin,updatedAt:Date.now()};
  await dbUpdate("sessions/"+s.id+"/public",updated);
  await dbUpdate("teacherSessions/"+teacher.uid+"/"+s.id,{title:clean});
}
$("close-detail").addEventListener("click",()=>{$("session-detail").classList.add("hidden");selectedSession=null;if(stopPlayers)stopPlayers();if(stopResults)stopResults();if(stopAttempts)stopAttempts();});
function renderPlayers(){
  const players=Object.entries(selectedSession?.players||{});$("player-count").textContent=String(players.length);
  $("players-list").innerHTML=players.length?players.map(([uid,p])=>`
    <div class="player-row" data-player="${escapeHtml(uid)}"><div><b>${escapeHtml(p.name||"Unnamed student")}</b><small>${escapeHtml(p.classSection||"No class")} • Joined ${formatDate(p.joinedAt)}</small></div><div class="player-actions"><button class="button ghost" data-player-action="edit">Fix details</button><button class="button ghost" data-player-action="remove">Remove</button></div></div>`).join(""):'<div class="empty">No students have joined yet.</div>';
}
$("players-list").addEventListener("click",async e=>{
  const b=e.target.closest("button[data-player-action]");if(!b||!selectedSession)return;
  const row=b.closest("[data-player]"),uid=row.dataset.player,p=selectedSession.players?.[uid];if(!p)return;
  if(b.dataset.playerAction==="edit"){
    const name=prompt("Correct student name:",p.name||"");if(name===null)return;
    const cls=prompt("Correct class / section:",p.classSection||"");if(cls===null)return;
    await dbUpdate("sessions/"+selectedSession.id+"/players/"+uid,{name:safeName(name),classSection:safeName(cls),editedByTeacher:true,updatedAt:Date.now()});
  }else if(confirm("Remove this student from the roster and block this device from rejoining this session?")){await dbSet("sessions/"+selectedSession.id+"/blockedPlayers/"+uid,true);await dbRemove("sessions/"+selectedSession.id+"/players/"+uid);}
});
function buildPlayerPerformance(){
  const roster=selectedSession?.players||{};
  const attempts=Object.values(selectedSession?.attempts||{});
  const results=selectedSession?.results||{};
  const stats={};
  Object.entries(roster).forEach(([uid,p])=>{stats[uid]={uid,name:p.name||"Student",classSection:p.classSection||"",answered:0,correct:0,incorrect:0,completed:Boolean(results[uid]),result:results[uid]||null};});
  attempts.forEach(a=>{
    const uid=a.playerId;
    if(!uid)return;
    stats[uid]??={uid,name:a.playerName||"Student",classSection:a.classSection||"",answered:0,correct:0,incorrect:0,completed:Boolean(results[uid]),result:results[uid]||null};
    stats[uid].answered++;
    if(a.correct)stats[uid].correct++;else stats[uid].incorrect++;
  });
  Object.values(stats).forEach(p=>{
    if(!p.answered&&p.result){
      p.answered=Number(p.result.questionsAnswered)||0;
      p.correct=Number(p.result.correctAnswers)||0;
      p.incorrect=Number(p.result.incorrectAnswers)||Math.max(0,p.answered-p.correct);
    }
    p.accuracy=p.answered?Math.round(p.correct/p.answered*100):0;
  });
  return Object.values(stats).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderReport(){
  const roster=selectedSession?.players||{};
  const players=buildPlayerPerformance();
  const completed=players.filter(p=>p.completed).length;
  const answered=players.reduce((n,p)=>n+p.answered,0);
  const correct=players.reduce((n,p)=>n+p.correct,0);
  const accuracy=answered?Math.round(correct/answered*100):0;
  const active=players.filter(p=>p.answered>0&&!p.completed).length;
  $("report-summary").innerHTML=[["Students",players.length],["Answered",answered],["Correct",correct],["Accuracy",accuracy+"%"],["Completed",completed],["In progress",active]].map(([label,value])=>'<div class="metric"><strong>'+escapeHtml(value)+'</strong><small>'+label+'</small></div>').join("");
  $("report-list").innerHTML=players.length?players.map(p=>'<div class="report-row"><div><b>'+escapeHtml(p.name)+'</b><small>'+escapeHtml(p.classSection||"No class")+" • "+(p.completed?"Completed":p.answered?"In progress":"Not started")+'</small></div><b>'+p.correct+' / '+p.answered+'</b><small>'+p.incorrect+' wrong • '+p.accuracy+'% accuracy</small></div>').join(""):'<div class="empty">Students will appear when they join.</div>';
  const attempts=Object.values(selectedSession?.attempts||{});
  const topics={}; const misses={};
  attempts.forEach(a=>{const topic=a.topic||"Uncategorized";topics[topic]??={total:0,correct:0};topics[topic].total++;if(a.correct)topics[topic].correct++;else{const key=a.question||"Unknown question";misses[key]=(misses[key]||0)+1;}});
  const topicRows=Object.entries(topics).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total)).map(([topic,v])=>'<div class="report-row"><div><b>'+escapeHtml(topic)+'</b><small>'+v.total+' attempts</small></div><b>'+Math.round(v.correct/v.total*100)+'%</b><small>'+v.correct+' correct</small></div>');
  const missedRows=Object.entries(misses).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([q,n])=>'<div class="report-row"><div><b>'+escapeHtml(q)+'</b><small>Most commonly missed</small></div><b>'+n+'</b><small>wrong</small></div>');
  $("topic-analysis").innerHTML=topicRows.length?topicRows.join("")+(missedRows.length?'<p class="muted">Most commonly missed questions</p>'+missedRows.join(""):''):'<div class="empty">Topic and question analysis will appear as students answer questions.</div>';
}
$("export-report").addEventListener("click",()=>{
  const roster=selectedSession?.players||{};
  const players=buildPlayerPerformance();
  const rows=[["Student","Class/Section","Questions answered","Correct","Incorrect","Accuracy","Completed","Kills","Waves","Outcome"],...players.map(p=>[p.name,p.classSection,p.answered,p.correct,p.incorrect,p.accuracy+"%",p.completed?"Yes":"No",p.result?.kills??"",p.result?.wave??"",p.result?(p.result.won?"Victory":"Defeat"):""])];
  const attempts=Object.values(selectedSession?.attempts||{});
  rows.push([],["QUESTION ATTEMPTS"],["Student","Class/Section","Topic","Question","Selected answer","Correct answer","Correct","Boss question"],...attempts.map(x=>[roster[x.playerId]?.name||x.playerName,roster[x.playerId]?.classSection||x.classSection,x.topic,x.question,x.selectedAnswer,x.correctAnswer,x.correct?"Yes":"No",x.isBoss?"Yes":"No"]));
  const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="grammar-defenders-report.csv";a.click();URL.revokeObjectURL(url);
});
