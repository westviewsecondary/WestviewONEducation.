
(() => {
  "use strict";
  const cfg = window.ONEEDUCATION_CONFIG;
  const sb = window.supabase?.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const todayISO = new Date().toISOString().slice(0,10);
  const PERIODS = [
    {n:1,label:"Period 1",time:"08:40–09:40"},
    {n:2,label:"Period 2",time:"09:45–10:45"},
    {n:3,label:"Period 3",time:"11:00–12:00"},
    {n:4,label:"Period 4",time:"12:05–13:20"},
    {n:5,label:"Period 5",time:"14:00–15:00"}
  ];
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
  const SUBJECTS = [
    ["English","GS","core"],["Mathematics","GM","core"],["Combined Science","SC","core"],
    ["Biology","BI","gcse"],["Chemistry","CH","gcse"],["Physics","PH","gcse"],
    ["History","HI","gcse"],["Geography","GE","gcse"],["French","FR","gcse"],["German","DE","gcse"],
    ["Spanish","SP","gcse"],["Computer Science","CS","gcse"],["Business","BU","gcse"],["Film Studies","FS","gcse"],
    ["Art & Design","AR","gcse"],["3D Design","3D","gcse"],["GCSE PE","PE","gcse"],
    ["Food Preparation & Nutrition","FN","gcse"],["Music","MU","gcse"],["Drama","DR","gcse"],
    ["Religious Studies","RS","gcse"],["Design & Technology","DT","gcse"],["Child Development","CD","gcse"]
  ];
  const HOUSE_META = {
    Brunel:"#7a5ba7", Nightingale:"#2f7f68", Seacole:"#b36b3b", Turing:"#4169a5"
  };
  const state = {
    preview:false, live:false, schoolStatus:"open", students:[], tutorGroups:[], houses:[],
    classes:[], rooms:[], behaviourReasons:[], behaviour:[], housePoints:[], examWindows:[],
    exams:[], communities:[], communityPosts:[], emergencies:[], covers:[], timetable:[],
    attendance:[], restrictions:[], classMemberships:[], importResults:[], staffMembers:[], classSchedule:[], staffDuties:[], calendarEvents:[], staffProfile:null, calendarCursor:null
  };

  function toast(message, error=false){
    const el=$("#toast"); el.textContent=message; el.className="toast show"+(error?" error":"");
    clearTimeout(toast.t); toast.t=setTimeout(()=>el.className="toast",3200);
  }
  function randomCode(){
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s=""; crypto.getRandomValues(new Uint32Array(8)).forEach(n=>s+=chars[n%chars.length]);
    return `OE-${s.slice(0,4)}-${s.slice(4)}`;
  }
  function randomCandidate(){
    return String(Math.floor(1000+Math.random()*9000));
  }
  function id(){ return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }
  function fullName(s){ return `${s.first_name} ${s.last_name}`; }
  function byId(list, value){ return list.find(x=>String(x.id)===String(value)); }
  function houseName(student){ return byId(state.houses, student.house_id)?.name || student.house_name || "—"; }
  function tutorName(student){ return byId(state.tutorGroups, student.tutor_group_id)?.code || student.tutor_code || "—"; }
  function classDisplay(c){ return c?.display_name || c?.name || c?.class_name || "Class"; }
  function fmtDate(v){ if(!v)return "—"; return new Date(v+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }

  function seedPreview(){
    state.preview=true; state.live=false; state.schoolStatus="open";
    state.houses=[
      {id:"h1",name:"Brunel"},{id:"h2",name:"Nightingale"},{id:"h3",name:"Seacole"},{id:"h4",name:"Turing"}
    ];
    state.tutorGroups=[
      {id:"t1",code:"11MWR",year_group:11,tutor_name:"M. Wright",room:"A01"},
      {id:"t2",code:"11GLK",year_group:11,tutor_name:"G. Lake",room:"A02"},
      {id:"t3",code:"11TRS",year_group:11,tutor_name:"T. Ross",room:"A03"},
      {id:"t4",code:"11RJN",year_group:11,tutor_name:"R. Jones",room:"A04"}
    ];
    const names = {
      t2:[["Amelia","Carter"],["Noah","Bennett"],["Freya","Collins"],["Oliver","Hart"],["Isla","Morgan"],["Leo","Davies"],["Ruby","Fletcher"],["Oscar","Hughes"],["Maya","Roberts"],["Archie","Walker"]],
      t3:[["Sophie","Ellis"],["Harry","Cole"],["Evie","Turner"],["George","Parker"],["Lily","James"],["Theo","Morris"],["Grace","Ward"],["Alfie","Price"],["Chloe","Reed"],["Lucas","Bailey"]],
      t4:[["Emily","Cooper"],["Jack","Mitchell"],["Poppy","Green"],["Charlie","Wood"],["Maisie","Adams"],["Henry","Brooks"],["Florence","Hill"],["Arthur","Bell"],["Millie","Cook"],["Finley","Gray"]]
    };
    let si=0;
    state.students=[];
    Object.entries(names).forEach(([tid,arr])=>arr.forEach((n,i)=>{
      state.students.push({id:`s${++si}`,first_name:n[0],last_name:n[1],year_group:11,tutor_group_id:tid,house_id:`h${(si%4)+1}`,candidate_number:String(4100+si),status:"active"});
    }));
    state.rooms = makeRooms();
    state.classes = [];
    [["English","GS",5],["Mathematics","GM",5],["Combined Science","SC",5]].forEach(([sub,prefix,count])=>{
      for(let n=1;n<=count;n++) state.classes.push({id:id(),display_name:`11${prefix}${n} ${sub}`,subject:sub,subject_code:prefix,year_group:11,set_number:n,room_code:roomFor(sub,n)});
    });
    SUBJECTS.filter(x=>x[2]==="gcse").forEach(([sub,prefix])=>{
      const count=["History","Geography"].includes(sub)?2:1;
      for(let n=1;n<=count;n++) state.classes.push({id:id(),display_name:`11${prefix}${count===2?(n===1?"A":"B"):"1"} ${sub}`,subject:sub,subject_code:prefix,year_group:11,set_number:n,room_code:roomFor(sub,n)});
    });
    state.classes.forEach(c=>c.student_count=0);
    state.students.forEach((s,idx)=>{
      s.class_ids=[];
      ["English","Mathematics","Combined Science"].forEach(sub=>{
        const options=state.classes.filter(c=>c.subject===sub);
        const c=options[idx%options.length]; s.class_ids.push(c.id); c.student_count++;
      });
      const optionPool=state.classes.filter(c=>!["English","Mathematics","Combined Science"].includes(c.subject));
      const pickedSubjects=new Set();
      for(let k=0;k<4;k++){
        let c=optionPool[(idx*4+k*5)%optionPool.length];
        let guard=0; while(pickedSubjects.has(c.subject)&&guard++<20) c=optionPool[(optionPool.indexOf(c)+1)%optionPool.length];
        pickedSubjects.add(c.subject); s.class_ids.push(c.id); c.student_count++;
      }
    });
    state.behaviourReasons=[
      {id:"br1",name:"Uniform",points:3},{id:"br2",name:"Disruption",points:2},{id:"br3",name:"Late to lesson",points:1},
      {id:"br4",name:"Defiance",points:4},{id:"br5",name:"Unsafe behaviour",points:5},{id:"br6",name:"Homework not completed",points:1}
    ];
    state.restrictions=[];
    state.behaviour=[
      {id:id(),student_id:"s6",reason:"Uniform",points:3,created_at:todayISO+"T10:15:00"},
      {id:id(),student_id:"s14",reason:"Late to lesson",points:1,created_at:todayISO+"T09:50:00"}
    ];
    state.housePoints=[
      {id:id(),student_id:"s3",reason:"Excellent contribution",points:2,created_at:todayISO+"T09:00:00"},
      {id:id(),student_id:"s22",reason:"Helping another student",points:3,created_at:todayISO+"T10:30:00"}
    ];
    state.communities = [
      ...state.tutorGroups.map(t=>({id:"ct"+t.id,type:"tutor",ref_id:t.id,name:t.code+" Community"})),
      ...state.classes.map(c=>({id:"cc"+c.id,type:"class",ref_id:c.id,name:classDisplay(c)}))
    ];
    state.communityPosts=[
      {id:id(),community_id:"ctt2",title:"Welcome back",body:"Please check your timetable before Monday tutor time.",created_at:todayISO+"T08:00:00"}
    ];
    state.examWindows=[
      {id:"ew1",start_date:"2026-11-09",end_date:"2026-11-13",exam_type:"Mock 2",year_group:11},
      {id:"ew2",start_date:"2027-02-08",end_date:"2027-02-12",exam_type:"Mock 3",year_group:11}
    ];
    state.exams=[
      {id:id(),exam_date:"2026-11-09",start_time:"09:00",exam_type:"Mock 2",subject:"English",paper:"English Language Paper 1",duration_minutes:105,room_code:"HALL"},
      {id:id(),exam_date:"2026-11-10",start_time:"09:00",exam_type:"Mock 2",subject:"Mathematics",paper:"Mathematics Paper 1",duration_minutes:90,room_code:"HALL"},
      {id:id(),exam_date:"2026-11-11",start_time:"13:30",exam_type:"Mock 2",subject:"Combined Science",paper:"Science Paper",duration_minutes:90,room_code:"HALL"}
    ];
    state.emergencies=[
      {id:id(),student_id:"s8",type:"Truancy",severity:"high",status:"open",details:"Not arrived at Period 3."},
      {id:id(),student_id:"s16",type:"Medical",severity:"medium",status:"open",details:"Reported to medical room."},
      {id:id(),student_id:"s25",type:"Pastoral",severity:"low",status:"monitoring",details:"Requested tutor check-in."}
    ];
    state.covers=[
      {id:id(),date:todayISO,period:3,class_name:"11GS3 English",absent_teacher:"A. Foster",cover_teacher:"J. Mills",room_code:"A13",status:"Assigned"},
      {id:id(),date:todayISO,period:4,class_name:"11GEA Geography",absent_teacher:"S. King",cover_teacher:"Unassigned",room_code:"A21",status:"Open"}
    ];
    buildPreviewTimetable();
  }

  function makeRooms(){
    const rooms=[];
    const defs=[
      ["A","English & Humanities"],["B","Mathematics"],["C","Science"],["D","Languages"],
      ["E","Arts"],["F","Technology"],["G","Business & Computing"],["H","General Teaching"]
    ];
    defs.forEach(([b,name])=>{ for(let i=1;i<=6;i++) rooms.push({id:id(),code:`${b}${String(i).padStart(2,"0")}`,name:`${name} ${i}`,building:`${b} Block`,capacity:i===6?20:32,type:i===6?"Small group":"Classroom"}); });
    rooms.push(
      {id:id(),code:"P01-GYM",name:"Gym",building:"P01",capacity:60,type:"PE"},
      {id:id(),code:"P01-EQ",name:"Equipment Room",building:"P01",capacity:8,type:"PE support"},
      {id:id(),code:"P02-HALL",name:"Sports Hall",building:"P02",capacity:120,type:"PE"},
      {id:id(),code:"P02-OFF",name:"PE Office",building:"P02",capacity:10,type:"Office"},
      {id:id(),code:"HALL",name:"Main Hall",building:"Central",capacity:240,type:"Exam / assembly"}
    );
    return rooms;
  }
  function roomFor(subject,n=1){
    const map={English:"A",History:"A",Geography:"A",Mathematics:"B","Combined Science":"C",Biology:"C",Chemistry:"C",Physics:"C",French:"D",German:"D",Spanish:"D","Art & Design":"E","3D Design":"E",Music:"E",Drama:"E","Food Preparation & Nutrition":"F","Design & Technology":"F","Computer Science":"G",Business:"G","Film Studies":"G","Religious Studies":"H","Child Development":"H","GCSE PE":"P"};
    const b=map[subject]||"H"; if(b==="P") return n%2?"P01-GYM":"P02-HALL";
    return `${b}${String(((n*3)%6)+1).padStart(2,"0")}`;
  }
  function buildPreviewTimetable(){
    state.timetable=[];
    state.students.forEach((s,idx)=>{
      const classes=s.class_ids.map(cid=>byId(state.classes,cid)).filter(Boolean);
      DAYS.forEach((day,di)=>PERIODS.forEach((p,pi)=>{
        const c=classes[(di*5+pi+idx)%classes.length];
        state.timetable.push({id:id(),student_id:s.id,day_of_week:di+1,period:p.n,class_id:c.id,class_name:classDisplay(c),room_code:c.room_code,subject:c.subject});
      }));
    });
  }

  async function loadLive(){
    try{
      const requests = [
        ["houses","houses","*"],["tutorGroups","tutor_groups","*"],["students","students","*"],["classMemberships","class_memberships","*"],
        ["classes","class_groups","*"],["rooms","rooms","*"],["behaviourReasons","behaviour_reasons","*"],["attendance","attendance_marks","*"],["restrictions","lesson_restrictions","*"],
        ["behaviour","behaviour_events","*"],["housePoints","house_points","*"],["examWindows","exam_windows","*"],
        ["exams","exams","*"],["communities","communities","*"],["communityPosts","community_posts","*"],
        ["emergencies","emergency_alerts","*"],["covers","cover_arrangements","*"],["timetable","student_timetable","*"]
      ];
      for(const [key,table,cols] of requests){
        const {data,error}=await sb.from(table).select(cols).limit(5000);
        if(error) throw error; state[key]=data||[];
      }
      state.students.forEach(st=>st.class_ids=state.classMemberships.filter(cm=>String(cm.student_id)===String(st.id)).map(cm=>cm.class_group_id));
      const {data:settings,error:se}=await sb.from("school_settings").select("*").eq("id",1).maybeSingle();
      if(se) throw se; state.schoolStatus=settings?.school_status||"open";
      state.live=true; state.preview=false;
    }catch(e){
      console.warn("Live data unavailable, using preview:",e);
      seedPreview(); toast("Database tables not ready yet — opened preview mode.", true);
    }
  }

  async function openStaff(preview=false){
    $("#staffGate").hidden=true; $("#studentPortal").hidden=true; $("#app").hidden=false;
    if(preview) seedPreview(); else await loadLive();
    renderAll();
  }
  async function refreshLive(){
    if(state.live) await loadLive(); renderAll();
  }

  function renderAll(){
    renderDashboard(); renderStudents(); renderImportTutors(); renderSelects(); renderClasses(); renderTutors();
    renderBehaviour(); renderHouses(); renderRooms(); renderEmergencies(); renderCover(); renderExams(); renderCommunities(); renderCalendar();
  }
  function renderDashboard(){
    $("#metricStudents").textContent=state.students.filter(s=>s.status!=="left").length;
    const marks=state.attendance.filter(a=>a.attendance_date===todayISO);
    const present=marks.filter(a=>["present","late"].includes(a.mark)).length;
    $("#metricAttendance").textContent=marks.length?Math.round(present/marks.length*100)+"%":"Not taken";
    $("#metricBehaviour").textContent=state.behaviour.filter(b=>(b.created_at||"").slice(0,10)===todayISO).reduce((a,b)=>a+(+b.points||0),0);
    $("#metricCover").textContent=state.covers.filter(c=>c.status==="Open"||c.status==="open").length;
    const status=state.schoolStatus;
    const b=$("#closureBanner"); b.className="status-banner "+(status==="open"?"":status);
    b.querySelector("b").textContent=status==="open"?"School is open":status==="closing"?"School is closing":"School is closed";
    b.querySelector("small").textContent=status==="open"?"Registers are available and attendance can be recorded.":"Registers are locked. Attendance will not be written.";
    $(".status-dot").style.background=status==="open"?"#2e9b70":status==="closing"?"#c88714":"#b43b46";
    $("#schoolStatusMini").textContent=status[0].toUpperCase()+status.slice(1);
    $("#attendanceLock").textContent=status==="open"?"Registers open":"Registers locked";
    $("#attendanceLock").classList.toggle("locked",status!=="open");
    $("#todayTimeline").innerHTML=`
      <div class="timeline-item"><b>08:25</b><span class="timeline-dot"></span><div><b>Tutor time</b><small>08:25–08:40</small></div></div>
      ${PERIODS.map(p=>`<div class="timeline-item"><b>${p.time.split("–")[0]}</b><span class="timeline-dot"></span><div><b>${p.label}</b><small>${p.time}</small></div></div>`).join("")}`;
    const issues=[
      ...state.emergencies.filter(e=>!["resolved","cancelled"].includes(e.status)).slice(0,3).map(e=>({tag:e.type,text:`${fullName(byId(state.students,e.student_id)||{first_name:"Student",last_name:""})} · ${e.details||""}`,cls:e.severity==="high"?"red":"amber"})),
      ...state.covers.filter(c=>String(c.status).toLowerCase()==="open").slice(0,2).map(c=>({tag:"Cover",text:`${c.class_name||"Class"} · Period ${c.period}`,cls:"amber"}))
    ];
    $("#attentionList").innerHTML=issues.length?issues.map(i=>`<div class="attention-item"><span class="tag ${i.cls}">${esc(i.tag)}</span><p>${esc(i.text)}</p></div>`).join(""):`<div class="empty-state">Nothing urgent right now.</div>`;
  }

  function renderStudents(){
    const q=($("#studentSearch")?.value||"").toLowerCase(), yr=$("#studentYearFilter")?.value||"";
    const rows=state.students.filter(s=>(!yr||String(s.year_group)===yr)&&(!q||fullName(s).toLowerCase().includes(q)));
    $("#studentsBody").innerHTML=rows.map(s=>`<tr><td><b>${esc(fullName(s))}</b></td><td>Year ${s.year_group}</td><td>${esc(tutorName(s))}</td><td>${esc(houseName(s))}</td><td>${esc(s.candidate_number||"—")}</td><td><span class="tag green">${esc(s.status||"active")}</span></td></tr>`).join("")||`<tr><td colspan="6"><div class="empty-state">No students found.</div></td></tr>`;
  }
  function renderImportTutors(){
    const yr=+$("#importYear").value;
    const list=state.tutorGroups.filter(t=>+t.year_group===yr);
    $("#importTutor").innerHTML=list.map(t=>`<option value="${esc(t.id)}">${esc(t.code)} · ${esc(t.tutor_name||"Tutor")}</option>`).join("") || `<option value="">No Year ${yr} tutor groups yet</option>`;
  }
  function fillStudentSelect(selector){
    const el=$(selector); if(!el)return;
    el.innerHTML=state.students.map(s=>`<option value="${esc(s.id)}">${esc(fullName(s))} · ${esc(tutorName(s))}</option>`).join("");
  }
  function renderSelects(){
    ["#behStudent","#houseStudent","#ttStudent"].forEach(fillStudentSelect);
    $("#behReason").innerHTML=state.behaviourReasons.map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${r.points} BP</option>`).join("");
    $("#registerClass").innerHTML=`<option value="">Choose class…</option>`+state.classes.map(c=>`<option value="${esc(c.id)}">${esc(classDisplay(c))}</option>`).join("");
    $("#examClassFilter").innerHTML=`<option value="">All classes</option>`+state.classes.filter(c=>+c.year_group===11).map(c=>`<option value="${esc(c.id)}">${esc(classDisplay(c))}</option>`).join("");
    $("#singleSubject").innerHTML=SUBJECTS.map(s=>`<option value="${esc(s[0])}">${esc(s[0])}</option>`).join("");
  }
  function renderClasses(){
    $("#classesBody").innerHTML=state.classes.filter(c=>+c.year_group===11).map(c=>`<tr><td><b>${esc(classDisplay(c))}</b></td><td>${esc(c.subject||"—")}</td><td>Year ${c.year_group}</td><td>${esc(c.set_number||"—")}</td><td>${esc(c.room_code||"—")}</td><td>${esc(c.student_count??"—")}</td></tr>`).join("");
  }
  function renderTutors(){
    $("#tutorCards").innerHTML=state.tutorGroups.map(t=>{
      const count=state.students.filter(s=>String(s.tutor_group_id)===String(t.id)).length;
      return `<article class="tutor-card"><span class="tag">Year ${t.year_group}</span><div class="big">${esc(t.code)}</div><small>${esc(t.tutor_name||"Tutor not assigned")} · ${esc(t.room||"Room TBC")}</small><footer><span>${count} students</span><button class="text-btn" data-open-community="${esc(t.id)}">Community →</button></footer></article>`;
    }).join("");
  }
  function renderBehaviour(){
    $("#behaviourFeed").innerHTML=state.behaviour.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,12).map(e=>{
      const s=byId(state.students,e.student_id); return `<div class="feed-item"><b>${esc(s?fullName(s):"Student")} · ${esc(e.reason||byId(state.behaviourReasons,e.reason_id)?.name||"Behaviour")}</b><p>${+e.points||0} behaviour point${+e.points===1?"":"s"}${e.removal?" · Removal":""}</p></div>`;
    }).join("")||`<div class="empty-state">No behaviour events.</div>`;
  }
  function renderHouses(){
    $("#houseCards").innerHTML=state.houses.map(h=>{
      const studentIds=new Set(state.students.filter(s=>String(s.house_id)===String(h.id)).map(s=>s.id));
      const pts=state.housePoints.filter(p=>studentIds.has(p.student_id)).reduce((a,p)=>a+(+p.points||0),0);
      return `<article class="house-card" style="--house:${HOUSE_META[h.name]||"#666"}"><span>${esc(h.name)} House</span><strong>${pts}</strong><small>house points</small></article>`;
    }).join("");
    $("#houseFeed").innerHTML=state.housePoints.slice().reverse().slice(0,10).map(p=>{const s=byId(state.students,p.student_id);return `<div class="feed-item"><b>+${p.points} · ${esc(s?fullName(s):"Student")}</b><p>${esc(p.reason||"House points")}</p></div>`}).join("")||`<div class="empty-state">No house points yet.</div>`;
  }
  function renderRooms(){
    $("#roomsBody").innerHTML=state.rooms.map(r=>`<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${esc(r.building)}</td><td>${esc(r.capacity)}</td><td>${esc(r.type)}</td></tr>`).join("");
  }
  function renderEmergencies(){
    const groups=state.tutorGroups.filter(t=>+t.year_group===11);
    $("#emergencyBoard").innerHTML=groups.map(t=>{
      const studentIds=new Set(state.students.filter(s=>String(s.tutor_group_id)===String(t.id)).map(s=>s.id));
      const alerts=state.emergencies.filter(e=>studentIds.has(e.student_id)&&e.status!=="resolved");
      return `<section class="emergency-column"><h3>${esc(t.code)} · ${alerts.length} active</h3>${alerts.map(e=>{const s=byId(state.students,e.student_id);return `<div class="emergency-card"><span class="tag ${e.severity==="high"?"red":"amber"}">${esc(e.type)}</span><p class="${e.severity==="high"?"severity-high":""}"><b>${esc(s?fullName(s):"Student")}</b></p><p>${esc(e.details||"")}</p></div>`}).join("")||`<div class="empty-state">No active alerts</div>`}</section>`;
    }).join("");
  }
  function renderCover(){
    $("#coverBody").innerHTML=state.covers.map(c=>`<tr><td>${esc(fmtDate(c.date))}</td><td>Period ${esc(c.period)}</td><td><b>${esc(c.class_name||"—")}</b></td><td>${esc(c.absent_teacher||"—")}</td><td>${esc(c.cover_teacher||"Unassigned")}</td><td>${esc(c.room_code||"—")}</td><td><span class="tag ${String(c.status).toLowerCase()==="open"?"amber":"green"}">${esc(c.status)}</span></td></tr>`).join("")||`<tr><td colspan="7"><div class="empty-state">No cover arrangements.</div></td></tr>`;
  }
  function renderExams(){
    $("#examWindows").innerHTML=state.examWindows.slice().sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(w=>`<div class="feed-item"><b>${esc(w.exam_type)} · Year ${w.year_group}</b><p>${fmtDate(w.start_date)} – ${fmtDate(w.end_date)}</p></div>`).join("")||`<div class="empty-state">No exam windows.</div>`;
    const clsFilter=$("#examClassFilter").value, kind=$("#examKindFilter").value;
    const selectedClass=clsFilter?byId(state.classes,clsFilter):null;
    const rows=state.exams.filter(e=>(!kind||e.exam_type===kind)&&(!selectedClass||String(e.subject).toLowerCase()===String(selectedClass.subject).toLowerCase()));
    $("#examScheduleBody").innerHTML=rows.map(e=>{
      let cls=e.class_name||"All matching classes";
      if(e.class_id) cls=classDisplay(byId(state.classes,e.class_id));
      return `<tr><td>${fmtDate(e.exam_date)}</td><td>${esc((e.start_time||"").slice(0,5)||"—")}</td><td>${esc(cls)}</td><td><b>${esc(e.paper||e.subject||"Exam")}</b><br><small>${esc(e.exam_type||"")}</small></td><td>${esc(e.room_code||"HALL")}</td><td>${esc(e.duration_minutes||"—")} min</td></tr>`;
    }).join("")||`<tr><td colspan="6"><div class="empty-state">No exams scheduled.</div></td></tr>`;
  }
  function renderCommunities(){
    $("#communitySelect").innerHTML=state.communities.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    renderCommunityFeed();
  }
  function renderCommunityFeed(){
    const cid=$("#communitySelect").value;
    $("#communityFeed").innerHTML=state.communityPosts.filter(p=>!cid||String(p.community_id)===String(cid)).slice().reverse().map(p=>`<div class="feed-item"><b>${esc(p.title||"Announcement")}</b><p>${esc(p.body)}</p></div>`).join("")||`<div class="empty-state">No announcements yet.</div>`;
  }
  function renderCalendar(){
    const year=2026, month=8, first=new Date(year,month,1), last=new Date(year,month+1,0);
    let html=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="calendar-cell calendar-head">${d}</div>`).join("");
    let start=(first.getDay()+6)%7; for(let i=0;i<start;i++)html+=`<div class="calendar-cell"></div>`;
    for(let day=1;day<=last.getDate();day++){
      const iso=`${year}-09-${String(day).padStart(2,"0")}`; const events=[];
      state.examWindows.filter(w=>w.start_date===iso).forEach(w=>events.push(`<div class="cal-event exam">${esc(w.exam_type)} starts</div>`));
      html+=`<div class="calendar-cell"><div class="calendar-date">${day}</div>${events.join("")}</div>`;
    }
    $("#calendarGrid").innerHTML=html;
  }

  function getClassStudents(classId){
    if(state.preview) return state.students.filter(s=>(s.class_ids||[]).includes(classId));
    return state.students.filter(s=>(s.class_ids||[]).includes(classId)); // live memberships loaded via RPC register
  }
  async function loadRegister(){
    if(state.schoolStatus!=="open"){ toast("Registers are locked because the school is not Open.",true); return; }
    const classId=$("#registerClass").value; if(!classId){toast("Choose a class first.",true);return}
    let students=[];
    if(state.live){
      const {data,error}=await sb.rpc("get_class_register",{p_class_id:classId,p_date:$("#registerDate").value,p_period:+$("#registerPeriod").value});
      if(error){toast(error.message,true);return} students=(data||[]).map(r=>({...r,id:r.student_id,first_name:r.first_name,last_name:r.last_name,tutor_code:r.tutor_code}));
    }else students=getClassStudents(classId);
    $("#registerList").innerHTML=students.map(s=>`<div class="register-row" data-student="${esc(s.id)}">
      <div class="register-name"><b>${esc(fullName(s))}</b><small>${esc(s.tutor_code||tutorName(s))}</small></div>
      <div class="mark-buttons"><button class="mark-btn present" data-mark="present" title="Present">·</button><button class="mark-btn absent" data-mark="absent" title="Absent">!</button><button class="mark-btn late" data-mark="late" title="Late">L</button></div>
      <button class="expand-btn" title="Reason and notes">⌄</button>
      <div class="absence-details" hidden><div><label>Absence reason</label><select class="absence-reason"><option value="ill">Illness</option><option value="medical">Medical appointment</option><option value="authorised">Authorised absence</option><option value="unauthorised">Unauthorised absence</option><option value="other">Other</option></select></div><div><label>Notes</label><input class="attendance-note" placeholder="Optional note"></div></div>
    </div>`).join("")||`<div class="empty-state">No students in this class.</div>`;
  }
  async function saveMark(row,mark,btn){
    if(state.schoolStatus!=="open"){toast("Attendance is locked while school is closing/closed.",true);return}
    const payload={p_student_id:row.dataset.student,p_class_id:$("#registerClass").value,p_attendance_date:$("#registerDate").value,p_period:+$("#registerPeriod").value,p_mark:mark,p_reason:row.querySelector(".absence-reason")?.value||null,p_notes:row.querySelector(".attendance-note")?.value||null};
    if(state.live){
      const {error}=await sb.rpc("record_attendance_mark",payload); if(error){toast(error.message,true);return}
    }else{
      state.attendance=state.attendance.filter(a=>!(a.student_id===payload.p_student_id&&a.class_id===payload.p_class_id&&a.attendance_date===payload.p_attendance_date&&a.period===payload.p_period));
      state.attendance.push({student_id:payload.p_student_id,class_id:payload.p_class_id,attendance_date:payload.p_attendance_date,period:payload.p_period,mark,reason:payload.p_reason,notes:payload.p_notes});
    }
    row.querySelectorAll(".mark-btn").forEach(x=>x.classList.remove("selected")); btn.classList.add("selected");
    if(mark==="absent") row.querySelector(".absence-details").hidden=false;
    renderDashboard();
  }

  async function runImport(){
    const tutorId=$("#importTutor").value, year=+$("#importYear").value, raw=$("#importNames").value.trim();
    if(!tutorId||!raw){toast("Choose a tutor group and add at least one student name.",true);return}
    const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean); const order=$("#nameOrder").value; const results=[];
    for(const line of lines){
      const clean=line.replace(/,+/g," ").replace(/\s+/g," ").trim(); const parts=clean.split(" ");
      if(parts.length<2) continue;
      const first=order==="first-last"?parts[0]:parts.slice(1).join(" ");
      const last=order==="first-last"?parts.slice(1).join(" "):parts[0];
      if(state.live){
        const {data,error}=await sb.rpc("import_student",{p_first_name:first,p_last_name:last,p_year_group:year,p_tutor_group_id:tutorId});
        if(error){toast(`${first} ${last}: ${error.message}`,true);continue}
        const r=Array.isArray(data)?data[0]:data; results.push(r);
      }else{
        let candidate=randomCandidate(); while(state.students.some(s=>s.candidate_number===candidate))candidate=randomCandidate();
        const student={id:id(),first_name:first,last_name:last,year_group:year,tutor_group_id:tutorId,house_id:state.houses[state.students.length%4]?.id,candidate_number:candidate,status:"active"};
        const eligible=state.classes.filter(c=>+c.year_group===year);
        student.class_ids=[];
        ["English","Mathematics","Combined Science"].forEach(sub=>{const ar=eligible.filter(c=>c.subject===sub); if(ar.length)student.class_ids.push(ar[state.students.length%ar.length].id)});
        const ops=eligible.filter(c=>!["English","Mathematics","Combined Science"].includes(c.subject));
        [...ops].sort(()=>Math.random()-.5).forEach(c=>{if(student.class_ids.length<7&&!student.class_ids.some(cid=>byId(state.classes,cid)?.subject===c.subject))student.class_ids.push(c.id)});
        state.students.push(student);
        const code=randomCode();
        results.push({student_id:student.id,full_name:fullName(student),portal_code:code,candidate_number:candidate,house_name:houseName(student),tutor_code:tutorName(student)});
      }
    }
    state.importResults=results; renderImportResults(); if(state.preview) buildPreviewTimetable();
    if(state.live) await refreshLive(); else renderAll();
    toast(`Imported ${results.length} student${results.length===1?"":"s"}.`);
  }
  function renderImportResults(){
    const rows=state.importResults;
    $("#importResultsPanel").hidden=!rows.length;
    $("#importResultsBody").innerHTML=rows.map(r=>`<tr><td><b>${esc(r.full_name)}</b></td><td>${esc(r.tutor_code||"—")}</td><td>${esc(r.house_name||"—")}</td><td><code>${esc(r.portal_code)}</code></td><td>${esc(r.candidate_number)}</td></tr>`).join("");
  }
  function downloadCodes(){
    if(!state.importResults.length)return;
    const csv=["Student,Tutor,House,Student Login,Candidate Number",...state.importResults.map(r=>[r.full_name,r.tutor_code,r.house_name,r.portal_code,r.candidate_number].map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))].join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="oneeducation-student-codes.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  async function issueBehaviour(){
    const studentId=$("#behStudent").value, reason=byId(state.behaviourReasons,$("#behReason").value), period=+$("#behPeriod").value, removal=$("#behRemoval").checked, notes=$("#behNotes").value;
    if(!studentId||!reason){toast("Choose student and reason.",true);return}
    if(state.live){
      const {error}=await sb.rpc("record_behaviour",{p_student_id:studentId,p_reason_id:reason.id,p_period:period,p_notes:notes||null,p_removal:removal});
      if(error){toast(error.message,true);return}
      await refreshLive();
    }else{
      const eventId=id();
      state.behaviour.push({id:eventId,student_id:studentId,reason:reason.name,points:reason.points,period,notes,removal,created_at:new Date().toISOString(),scheduled_next_period:removal&&period<4?period+1:null});
      if(removal&&period<4) state.restrictions.push({id:id(),student_id:studentId,restriction_date:todayISO,period:period+1,label:"Scheduled to be out of lesson",source_behaviour_event:eventId});
      renderBehaviour(); renderDashboard();
    }
    toast(removal&&period===4?"Removal recorded. No Period 5 restriction was created across lunch.":"Behaviour recorded.");
  }
  async function awardHouse(){
    const studentId=$("#houseStudent").value, points=+$("#housePoints").value, reason=$("#houseReason").value.trim();
    if(state.live){
      const {error}=await sb.from("house_points").insert({student_id:studentId,points,reason}); if(error){toast(error.message,true);return} await refreshLive();
    }else{state.housePoints.push({id:id(),student_id:studentId,points,reason,created_at:new Date().toISOString()});renderHouses()}
    toast(`Awarded ${points} house point${points===1?"":"s"}.`);
  }
  async function setSchoolStatus(status){
    if(state.live){
      const {error}=await sb.rpc("set_school_status",{p_status:status}); if(error){toast(error.message,true);return}
    }
    state.schoolStatus=status; renderDashboard(); toast(`School status changed to ${status}.`);
  }

  async function createClasses(){
    const year=+$("#classYear").value,count=+$("#setCount").value,mode=$("#subjectMode").value,single=$("#singleSubject").value;
    if(state.live){
      const {error}=await sb.rpc("create_class_batch",{p_year_group:year,p_set_count:count,p_mode:mode,p_single_subject:mode==="single"?single:null});
      if(error){toast(error.message,true);return} await refreshLive();
    }else{
      let subs=SUBJECTS;
      if(mode==="core")subs=SUBJECTS.filter(s=>s[2]==="core");
      if(mode==="gcse")subs=SUBJECTS.filter(s=>s[2]==="gcse");
      if(mode==="single")subs=SUBJECTS.filter(s=>s[0]===single);
      subs.forEach(([sub,prefix,type])=>{
        const number=type==="core"?count:(["History","Geography"].includes(sub)?2:1);
        for(let n=1;n<=number;n++){
          if(state.classes.some(c=>+c.year_group===year&&c.subject===sub&&+c.set_number===n))continue;
          state.classes.push({id:id(),display_name:`${year}${prefix}${number===2&&type!=="core"?(n===1?"A":"B"):n} ${sub}`,subject:sub,subject_code:prefix,year_group:year,set_number:n,room_code:roomFor(sub,n),student_count:0});
        }
      }); renderClasses(); renderSelects();
    }
    toast("Classes created.");
  }
  async function createExamWindow(){
    const start=$("#examStart").value,end=$("#examEnd").value,type=$("#examType").value,year=+$("#examYear").value;
    if(!start||!end){toast("Choose start and end dates.",true);return}
    if(type==="Mock 1"&&year!==10){toast("Mock 1 is Year 10 only.",true);return}
    if(state.live){
      const {error}=await sb.rpc("create_exam_window_and_schedule",{p_start_date:start,p_end_date:end,p_exam_type:type,p_year_group:year});
      if(error){toast(error.message,true);return} await refreshLive();
    }else{
      const w={id:id(),start_date:start,end_date:end,exam_type:type,year_group:year};state.examWindows.push(w);
      const core=["English","Mathematics","Combined Science","History","Geography"];
      let d=new Date(start+"T12:00:00"); core.forEach((sub,i)=>{const date=new Date(d);date.setDate(d.getDate()+i);if(date<=new Date(end+"T23:59:59"))state.exams.push({id:id(),exam_date:date.toISOString().slice(0,10),start_time:i%2?"13:30":"09:00",exam_type:type,subject:sub,paper:`${sub} ${type}`,duration_minutes:90,room_code:"HALL"})});
      state.communities.filter(c=>c.type==="class").forEach(c=>state.communityPosts.push({id:id(),community_id:c.id,title:`${type} timetable published`,body:`The ${type} window runs ${fmtDate(start)} to ${fmtDate(end)}. Check your exam timetable for subject dates.`,created_at:new Date().toISOString()}));
      renderExams();renderCalendar();renderCommunityFeed();
    }
    toast(`${type} window created and timetable generated.`);
  }
  function parseCSV(text){
    const lines=text.replace(/\r/g,"").split("\n").filter(Boolean); if(lines.length<2)return[];
    const parse=line=>{let a=[],cur="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===","&&!q){a.push(cur);cur=""}else cur+=ch}a.push(cur);return a.map(x=>x.trim())};
    const head=parse(lines[0]).map(x=>x.toLowerCase()); return lines.slice(1).map(l=>{const vals=parse(l),o={};head.forEach((h,i)=>o[h]=vals[i]??"");return o});
  }
  async function importGcse(){
    const file=$("#gcseCsv").files[0]; if(!file){toast("Choose a GCSE CSV file first.",true);return}
    const rows=parseCSV(await file.text()); let ok=0,fail=0;
    for(const r of rows){
      if(state.live){
        const {error}=await sb.rpc("import_official_gcse_exam",{p_subject:r.subject,p_paper:r.paper,p_exam_date:r.date,p_start_time:r.start_time,p_duration_minutes:+r.duration_minutes,p_board:r.board||null});
        error?fail++:ok++;
      }else{
        state.exams.push({id:id(),subject:r.subject,paper:r.paper,exam_date:r.date,start_time:r.start_time,duration_minutes:+r.duration_minutes,board:r.board,exam_type:"GCSE",room_code:"HALL"});ok++;
      }
    }
    if(state.live)await refreshLive();else renderExams();
    const report=$("#gcseImportReport");report.hidden=false;report.innerHTML=`<b>Import complete</b><p>${ok} official GCSE exam${ok===1?"":"s"} imported${fail?`, ${fail} rejected`:""}. Matching Year 11 classes are linked automatically.</p>`;
  }

  function renderTimetable(studentId, target="#timetableGrid"){
    const entries=state.timetable.filter(t=>String(t.student_id)===String(studentId));
    let html=`<div class="tt-cell tt-head"></div>`+DAYS.map(d=>`<div class="tt-cell tt-head">${d}</div>`).join("");
    PERIODS.forEach(p=>{
      html+=`<div class="tt-cell tt-period"><b>P${p.n}</b><span>${p.time}</span></div>`;
      DAYS.forEach((d,di)=>{
        const e=entries.find(x=>+x.day_of_week===di+1&&+x.period===p.n);
        const restriction=(di===4)?state.restrictions.find(r=>String(r.student_id)===String(studentId)&&String(r.restriction_date).slice(0,10)===todayISO&&+r.period===p.n):null;
        html+=`<div class="tt-cell">${restriction?`<span class="tag red">${esc(restriction.label||"Scheduled to be out of lesson")}</span>`:""}${e?`<b>${esc(e.subject||e.class_name)}</b><span>${esc(e.room_code||"")} · ${esc(e.class_name||"")}</span>`:"<span>—</span>"}</div>`;
      });
    }); $(target).innerHTML=html;
  }

  async function studentLogin(){
    const code=$("#studentCode").value.trim();
    if(!code){toast("Enter a student access code.",true);return}
    try{
      const {data,error}=await sb.rpc("student_portal_snapshot",{p_code:code}); if(error)throw error;
      if(!data||data.error)throw new Error("That student access code was not recognised.");
      showStudentPortal(data);
    }catch(e){ toast(e.message||"Could not sign in.",true); }
  }
  function showStudentPortal(data){
    $("#staffGate").hidden=true;$("#app").hidden=true;$("#studentPortal").hidden=false;
    const s=data.student; $("#portalName").textContent=`Welcome, ${s.first_name}.`;$("#portalMeta").textContent=`Year ${s.year_group} · Read-only student/parent access`;
    $("#portalCandidate").textContent=s.candidate_number||"—";$("#portalTutor").textContent=s.tutor_code||tutorName(s);$("#portalHouse").textContent=s.house_name||houseName(s);
    const ex=(data.exams||[]).slice().sort((a,b)=>String(a.exam_date).localeCompare(String(b.exam_date)))[0];$("#portalNextExam").textContent=ex?fmtDate(ex.exam_date):"None";
    $("#portalClasses").innerHTML=(data.classes||[]).map(c=>`<div class="simple-item"><b>${esc(classDisplay(c))}</b><p>${esc(c.room_code||"Room TBC")}</p></div>`).join("")||`<div class="empty-state">No classes found.</div>`;
    $("#portalNotices").innerHTML=[...(data.notices||[]),...(data.exams||[]).map(e=>({title:`${e.exam_type||"Exam"} · ${e.subject||e.paper}`,body:`${fmtDate(e.exam_date)} at ${(e.start_time||"").slice(0,5)}`}))].map(n=>`<div class="feed-item"><b>${esc(n.title||"Notice")}</b><p>${esc(n.body||"")}</p></div>`).join("");
    state.timetable=data.timetable||[]; renderTimetable(s.id,"#portalTimetable");
  }

  function openModal(title,body,onConfirm){
    $("#modalTitle").textContent=title;$("#modalBody").innerHTML=body;const m=$("#modal");m.showModal();
    $("#modalConfirm").onclick=async ev=>{ev.preventDefault();await onConfirm?.();m.close()};
  }
  function newTutor(){
    openModal("New tutor group",`<label>Code</label><input id="mTutorCode" placeholder="11ABC"><label>Year group</label><select id="mTutorYear"><option>7</option><option>8</option><option>9</option><option>10</option><option selected>11</option></select><label>Tutor name</label><input id="mTutorName" placeholder="A. Teacher"><label>Base room</label><input id="mTutorRoom" placeholder="A05">`,async()=>{
      const row={code:$("#mTutorCode").value.trim().toUpperCase(),year_group:+$("#mTutorYear").value,tutor_name:$("#mTutorName").value.trim(),room:$("#mTutorRoom").value.trim()};
      if(state.live){const {error}=await sb.from("tutor_groups").insert(row);if(error){toast(error.message,true);return}await refreshLive()}else{state.tutorGroups.push({id:id(),...row});renderTutors();renderImportTutors()}
      toast("Tutor group created.");
    });
  }
  function newEmergency(){
    openModal("New emergency alert",`<label>Student</label><select id="mEmerStudent">${state.students.map(s=>`<option value="${s.id}">${esc(fullName(s))} · ${esc(tutorName(s))}</option>`).join("")}</select><label>Type</label><select id="mEmerType"><option>Truancy</option><option>Missing student</option><option>Medical</option><option>Safeguarding</option><option>Pastoral</option><option>Site emergency</option><option>Transport</option></select><label>Severity</label><select id="mEmerSeverity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><label>Details</label><textarea id="mEmerDetails" rows="3"></textarea>`,async()=>{
      const row={student_id:$("#mEmerStudent").value,type:$("#mEmerType").value,severity:$("#mEmerSeverity").value,details:$("#mEmerDetails").value,status:"open"};
      if(state.live){const {error}=await sb.from("emergency_alerts").insert(row);if(error){toast(error.message,true);return}await refreshLive()}else{state.emergencies.push({id:id(),...row});renderEmergencies();renderDashboard()}toast("Emergency alert created.");
    });
  }
  function newCover(){
    openModal("Add cover arrangement",`<label>Date</label><input id="mCoverDate" type="date" value="${todayISO}"><label>Period</label><select id="mCoverPeriod">${PERIODS.map(p=>`<option>${p.n}</option>`).join("")}</select><label>Class</label><select id="mCoverClass">${state.classes.map(c=>`<option value="${esc(c.id)}">${esc(classDisplay(c))}</option>`).join("")}</select><label>Absent teacher</label><input id="mAbsentTeacher"><label>Cover teacher</label><input id="mCoverTeacher" placeholder="Leave blank if unassigned">`,async()=>{
      const c=byId(state.classes,$("#mCoverClass").value);const row={date:$("#mCoverDate").value,period:+$("#mCoverPeriod").value,class_id:c?.id,class_name:classDisplay(c),absent_teacher:$("#mAbsentTeacher").value,cover_teacher:$("#mCoverTeacher").value||"Unassigned",room_code:c?.room_code,status:$("#mCoverTeacher").value?"Assigned":"Open"};
      if(state.live){const {error}=await sb.from("cover_arrangements").insert(row);if(error){toast(error.message,true);return}await refreshLive()}else{state.covers.push({id:id(),...row});renderCover();renderDashboard()}toast("Cover arrangement saved.");
    });
  }


  // ============================= OneEducation v3 =============================
  const PREVIEW_STAFF = [
    ["HT01","Mr Williams","Headteacher","Headteacher",null,1,true],
    ["SLT01","Ms Priya Shah","Deputy Headteacher","SLT",null,1,true],
    ["SLT02","Mr Daniel Mercer","Assistant Headteacher","SLT",null,2,true],
    ["SLT03","Mrs Louise Bennett","Assistant Headteacher","SLT",null,3,true],
    ["ENG01","Mrs Evelyn Foster","Teacher of English","Teacher","English",1,false],
    ["ENG02","Mr Aaron Hughes","Teacher of English","Teacher","English",2,false],
    ["ENG03","Ms Mia Clarke","Teacher of English","Teacher","English",3,false],
    ["ENG04","Mr Nathan Reed","Teacher of English","Teacher","English",4,false],
    ["ENG05","Miss Chloe Barrett","Teacher of English","Teacher","English",5,false],
    ["MAT01","Mr Theo Grant","Teacher of Mathematics","Teacher","Mathematics",1,false],
    ["MAT02","Ms Hannah Cole","Teacher of Mathematics","Teacher","Mathematics",2,false],
    ["MAT03","Mr Adam Turner","Teacher of Mathematics","Teacher","Mathematics",3,false],
    ["MAT04","Mrs Priya Mills","Teacher of Mathematics","Teacher","Mathematics",4,false],
    ["MAT05","Mr Oliver Ward","Teacher of Mathematics","Teacher","Mathematics",5,false],
    ["SCI01","Dr Leah Morgan","Teacher of Science","Teacher","Combined Science",1,false],
    ["SCI02","Mr Samuel King","Teacher of Science","Teacher","Combined Science",2,false],
    ["SCI03","Ms Grace Patel","Teacher of Science","Teacher","Combined Science",3,false],
    ["SCI04","Mr Isaac Bell","Teacher of Science","Teacher","Combined Science",4,false],
    ["SCI05","Ms Ruby Collins","Teacher of Science","Teacher","Combined Science",5,false],
    ["HIS01","Mr Lewis Parker","Teacher of History","Teacher","History",1,false],
    ["GEO01","Ms Amelia Wood","Teacher of Geography","Teacher","Geography",1,false],
    ["BUS01","Mrs Rachel Morgan","Teacher of Business","Teacher","Business",1,false],
    ["FIL01","Mr Jamie Sinclair","Teacher of Film Studies","Teacher","Film Studies",1,false],
    ["PE001","Mr Jordan Ellis","Teacher of PE","Teacher","GCSE PE",1,false]
  ];
  const CORE_SLOTS = {
    A:{
      English:[[1,1,"English Language"],[2,2,"English Literature"],[4,3,"English Language"],[5,4,"English Literature"]],
      Mathematics:[[1,2,"Mathematics"],[2,3,"Mathematics"],[4,4,"Mathematics"],[5,1,"Mathematics"]],
      "Combined Science":[[1,3,"Combined Science"],[3,1,"Combined Science"],[3,4,"Combined Science"],[5,2,"Combined Science"]]
    },
    B:{
      English:[[1,3,"English Language"],[2,4,"English Literature"],[3,2,"English Language"],[5,1,"English Literature"]],
      Mathematics:[[1,1,"Mathematics"],[2,2,"Mathematics"],[4,3,"Mathematics"],[5,4,"Mathematics"]],
      "Combined Science":[[1,4,"Combined Science"],[3,1,"Combined Science"],[4,2,"Combined Science"],[5,3,"Combined Science"]]
    }
  };
  const OPTION_SLOTS = {
    A:[[1,4],[1,5],[2,1],[2,4],[2,5],[3,2],[3,3],[3,5],[4,1],[4,2],[4,5],[5,3],[5,5]],
    B:[[1,2],[1,5],[2,1],[2,3],[2,5],[3,3],[3,4],[3,5],[4,1],[4,4],[4,5],[5,2],[5,5]]
  };
  function stableHash(s){let h=0;for(const ch of String(s))h=((h<<5)-h+ch.charCodeAt(0))|0;return Math.abs(h)}
  function canManageClasses(){return state.preview||["admin","slt"].includes(state.staffProfile?.role)}
  function staffName(c){return byId(state.staffMembers,c?.teacher_id)?.full_name||c?.teacher_name||"Teacher TBC"}
  function ensurePreviewV3(){
    if(!state.staffMembers.length){
      state.staffMembers=PREVIEW_STAFF.map((x,i)=>({id:`staff${i+1}`,staff_code:x[0],full_name:x[1],job_title:x[2],role_type:x[3],subject:x[4],allocation_order:x[5],slt:x[6],on_call_eligible:true,active:true}));
      state.staffProfile={role:"admin",full_name:"Preview Administrator"};
    }
    state.students.forEach(s=>{if(!s.portal_code_display)s.portal_code_display=randomCode()});
    state.classes.forEach(c=>{
      const candidates=state.staffMembers.filter(t=>t.subject===c.subject);
      const teacher=candidates.slice().sort((a,b)=>Math.abs((a.allocation_order||1)-(c.set_number||1))-Math.abs((b.allocation_order||1)-(c.set_number||1)))[0];
      if(teacher){c.teacher_id=teacher.id;c.teacher_name=teacher.full_name}
    });
    if(!state.staffDuties.length){
      state.staffDuties=[
        {id:id(),staff_id:"staff1",week_pattern:"A",day_of_week:1,period:3,duty_type:"On-Call",location:"Whole site"},
        {id:id(),staff_id:"staff2",week_pattern:"A",day_of_week:2,period:4,duty_type:"SLT Removal",location:"Removal room"},
        {id:id(),staff_id:"staff3",week_pattern:"B",day_of_week:3,period:2,duty_type:"On-Call",location:"Whole site"}
      ];
    }
    if(!state.calendarEvents.length){
      state.calendarEvents=state.examWindows.map(w=>({id:`cal${w.id}`,title:`Year ${w.year_group} ${w.exam_type}`,event_date:w.start_date,end_date:w.end_date,category:"exam",details:"Exam window"}));
    }
  }
  function buildPreviewClassSchedule(){
    ensurePreviewV3(); state.classSchedule=[];
    state.classes.forEach(c=>{
      ["A","B"].forEach(w=>{
        const fixed=CORE_SLOTS[w][c.subject];
        if(fixed){fixed.forEach(([d,p,label])=>state.classSchedule.push({id:id(),class_id:c.id,week_pattern:w,day_of_week:d,period:p,lesson_label:label,room_code:c.room_code}));return}
        const slots=OPTION_SLOTS[w],base=stableHash(c.display_name)%slots.length;
        [0,4,8].forEach((off,k)=>{const [d,p]=slots[(base+off+(w==="B"?2:0))%slots.length];state.classSchedule.push({id:id(),class_id:c.id,week_pattern:w,day_of_week:d,period:p,lesson_label:c.subject,room_code:c.room_code})});
      });
    });
  }
  function buildPreviewTimetable(){
    buildPreviewClassSchedule(); state.timetable=[];
    state.students.forEach(s=>{
      ["A","B"].forEach(w=>{
        const occupied=new Set();
        const classes=(s.class_ids||[]).map(cid=>byId(state.classes,cid)).filter(Boolean).sort((a,b)=>{
          const p=x=>x.subject==="English"?1:x.subject==="Mathematics"?2:x.subject==="Combined Science"?3:4;return p(a)-p(b)
        });
        classes.forEach(c=>state.classSchedule.filter(cs=>cs.class_id===c.id&&cs.week_pattern===w).forEach(cs=>{
          const key=`${cs.day_of_week}-${cs.period}`;if(occupied.has(key))return;occupied.add(key);
          state.timetable.push({id:id(),student_id:s.id,week_pattern:w,day_of_week:cs.day_of_week,period:cs.period,class_id:c.id,class_name:classDisplay(c),subject:cs.lesson_label,room_code:cs.room_code});
        }));
        DAYS.forEach((_,di)=>PERIODS.forEach(p=>{const key=`${di+1}-${p.n}`;if(!occupied.has(key))state.timetable.push({id:id(),student_id:s.id,week_pattern:w,day_of_week:di+1,period:p.n,class_id:null,class_name:"Personal Development / Study",subject:"Personal Development / Study",room_code:byId(state.tutorGroups,s.tutor_group_id)?.room||"H01"})}));
      });
    });
  }

  async function loadLive(){
    try{
      const requests=[
        ["houses","houses","*"],["tutorGroups","tutor_groups","*"],["students","students","*"],["classMemberships","class_memberships","*"],
        ["classes","class_groups","*"],["rooms","rooms","*"],["behaviourReasons","behaviour_reasons","*"],["attendance","attendance_marks","*"],["restrictions","lesson_restrictions","*"],
        ["behaviour","behaviour_events","*"],["housePoints","house_points","*"],["examWindows","exam_windows","*"],["exams","exams","*"],
        ["communities","communities","*"],["communityPosts","community_posts","*"],["emergencies","emergency_alerts","*"],["covers","cover_arrangements","*"],
        ["timetable","student_timetable","*"],["staffMembers","staff_members","*"],["classSchedule","class_schedule","*"],["staffDuties","staff_duties","*"],["calendarEvents","calendar_events","*"]
      ];
      for(const [key,table,cols] of requests){const {data,error}=await sb.from(table).select(cols).limit(5000);if(error)throw error;state[key]=data||[]}
      state.students.forEach(st=>st.class_ids=state.classMemberships.filter(cm=>String(cm.student_id)===String(st.id)).map(cm=>cm.class_group_id));
      const {data:settings,error:se}=await sb.from("school_settings").select("*").eq("id",1).maybeSingle();if(se)throw se;state.schoolStatus=settings?.school_status||"open";
      const {data:{user}}=await sb.auth.getUser();
      if(user){const {data:p}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();state.staffProfile=p||{role:"teacher",full_name:user.email}}
      state.live=true;state.preview=false;
    }catch(e){console.warn("Live data unavailable:",e);seedPreview();toast("OneEducation v3 database upgrade is not ready yet — opened preview mode.",true)}
  }
  function renderAll(){
    renderDashboard();renderStudents();renderImportTutors();renderSelects();renderClasses();renderTutors();renderBehaviour();renderHouses();renderRooms();renderEmergencies();renderCover();renderStaff();renderExams();renderCommunities();renderCalendar();
  }
  function renderStudents(){
    const q=($("#studentSearch")?.value||"").toLowerCase(),yr=$("#studentYearFilter")?.value||"";
    const rows=state.students.filter(s=>(!yr||String(s.year_group)===yr)&&(!q||fullName(s).toLowerCase().includes(q)));
    $("#studentsBody").innerHTML=rows.map(s=>`<tr><td><button class="student-link" data-student-profile="${esc(s.id)}">${esc(fullName(s))}</button></td><td>Year ${s.year_group}</td><td>${esc(tutorName(s))}</td><td>${esc(houseName(s))}</td><td>${esc(s.candidate_number||"—")}</td><td><span class="tag green">${esc(s.status||"active")}</span></td><td><button class="secondary mini-btn" data-student-profile="${esc(s.id)}">Profile</button></td></tr>`).join("")||`<tr><td colspan="7"><div class="empty-state">No students found.</div></td></tr>`;
  }
  function renderClasses(){
    $("#classesBody").innerHTML=state.classes.filter(c=>+c.year_group===11).map(c=>`<tr><td><b>${esc(classDisplay(c))}</b></td><td>${esc(c.subject||"—")}</td><td>Year ${c.year_group}</td><td>${esc(c.set_number||"—")}</td><td>${esc(staffName(c))}</td><td>${esc(c.room_code||"—")}</td><td>${esc(c.student_count??"—")}</td></tr>`).join("");
  }
  function renderStaff(){
    const body=$("#staffBody"),sel=$("#staffSelect");if(!body||!sel)return;
    const list=state.staffMembers.filter(s=>s.active!==false).slice().sort((a,b)=>(b.slt?1:0)-(a.slt?1:0)||String(a.full_name).localeCompare(String(b.full_name)));
    body.innerHTML=list.map(s=>`<tr><td><b>${esc(s.full_name)}</b><br><small>${esc(s.staff_code||"")}</small></td><td>${esc(s.job_title||s.role_type)}</td><td>${esc(s.subject||"Leadership")}</td><td>${s.on_call_eligible?'<span class="tag green">Eligible</span>':'—'}</td><td><button class="secondary mini-btn" data-staff-timetable="${esc(s.id)}">Timetable</button></td></tr>`).join("");
    const current=sel.value;sel.innerHTML=list.map(s=>`<option value="${esc(s.id)}">${esc(s.full_name)} · ${esc(s.subject||s.role_type)}</option>`).join("");if(current&&list.some(x=>String(x.id)===String(current)))sel.value=current;
    if(sel.value)renderStaffTimetable(sel.value,$("#staffWeek")?.value||"A");
  }
  function renderStaffTimetable(staffId,week="A"){
    const target=$("#staffTimetable");if(!target)return;const classIds=new Set(state.classes.filter(c=>String(c.teacher_id)===String(staffId)).map(c=>c.id));
    const lessons=state.classSchedule.filter(cs=>cs.week_pattern===week&&classIds.has(cs.class_id));const duties=state.staffDuties.filter(d=>String(d.staff_id)===String(staffId)&&d.week_pattern===week);
    let html=`<div class="tt-cell tt-head"></div>`+DAYS.map(d=>`<div class="tt-cell tt-head">${d}</div>`).join("");
    PERIODS.forEach(p=>{html+=`<div class="tt-cell tt-period"><b>P${p.n}</b><span>${p.time}</span></div>`;DAYS.forEach((_,di)=>{const duty=duties.find(x=>+x.day_of_week===di+1&&+x.period===p.n),le=lessons.find(x=>+x.day_of_week===di+1&&+x.period===p.n),c=le?byId(state.classes,le.class_id):null;html+=`<div class="tt-cell">${duty?`<span class="tag red">${esc(duty.duty_type)}</span><b>${esc(duty.location||"On call")}</b>`:le?`<b>${esc(classDisplay(c))}</b><span>${esc(le.lesson_label)} · ${esc(le.room_code||c?.room_code||"")}</span>`:'<span>—</span>'}</div>`})});target.innerHTML=html;
  }
  function renderTimetable(studentId,target="#timetableGrid",week=null){
    week=week||($("#ttWeek")?.value||"A");const entries=state.timetable.filter(t=>String(t.student_id)===String(studentId)&&String(t.week_pattern||"A")===week);let html=`<div class="tt-cell tt-head"></div>`+DAYS.map(d=>`<div class="tt-cell tt-head">${d}</div>`).join("");
    const todayIndex=(new Date(todayISO+"T12:00:00").getDay()+6)%7;
    PERIODS.forEach(p=>{html+=`<div class="tt-cell tt-period"><b>P${p.n}</b><span>${p.time}</span></div>`;DAYS.forEach((_,di)=>{const e=entries.find(x=>+x.day_of_week===di+1&&+x.period===p.n),restriction=di===todayIndex?state.restrictions.find(r=>String(r.student_id)===String(studentId)&&String(r.restriction_date).slice(0,10)===todayISO&&+r.period===p.n):null,c=e?.class_id?byId(state.classes,e.class_id):null;html+=`<div class="tt-cell">${restriction?`<span class="tag red">${esc(restriction.label||"Scheduled to be out of lesson")}</span>`:""}${e?`<b>${esc(e.subject||e.class_name)}</b><span>${esc(e.room_code||"")}${c?` · ${esc(classDisplay(c))}`:""}</span>${c?`<small>${esc(staffName(c))}</small>`:""}`:'<span>—</span>'}</div>`})});$(target).innerHTML=html;
  }
  function renderEmergencies(){
    const groups=state.tutorGroups.slice().sort((a,b)=>String(a.code).localeCompare(String(b.code)));const active=e=>!["resolved","cancelled"].includes(e.status);
    $("#emergencyBoard").innerHTML=groups.map(t=>{const studentIds=new Set(state.students.filter(s=>String(s.tutor_group_id)===String(t.id)).map(s=>s.id)),alerts=state.emergencies.filter(e=>studentIds.has(e.student_id)&&active(e));return `<section class="emergency-column"><h3>${esc(t.code)} · ${alerts.length} active</h3>${alerts.map(e=>{const s=byId(state.students,e.student_id);return `<div class="emergency-card"><div class="emergency-top"><span class="tag ${e.severity==="high"?"red":"amber"}">${esc(e.type)}</span><span class="tag">${esc(e.status)}</span></div><p class="${e.severity==="high"?"severity-high":""}"><b>${esc(s?fullName(s):"Student")}</b></p><small>${esc(t.code)}</small><p>${esc(e.details||"")}</p><div class="mini-actions"><button class="primary mini-btn" data-emergency-action="resolved" data-emergency-id="${esc(e.id)}">Finish</button><button class="secondary mini-btn" data-emergency-action="cancelled" data-emergency-id="${esc(e.id)}">Cancel alert</button></div></div>`}).join("")||`<div class="empty-state">No active alerts</div>`}</section>`}).join("");
    const hist=state.emergencies.filter(e=>!active(e)).slice().sort((a,b)=>String(b.resolved_at||b.created_at).localeCompare(String(a.resolved_at||a.created_at))).slice(0,12);$("#emergencyHistory").innerHTML=hist.map(e=>{const s=byId(state.students,e.student_id);return `<div class="feed-item"><b>${esc(e.type)} · ${esc(s?fullName(s):"Student")}</b><p><span class="tag ${e.status==="cancelled"?"amber":"green"}">${esc(e.status)}</span> ${esc(e.resolution_note||"")}</p></div>`}).join("")||`<div class="empty-state">No closed alerts yet.</div>`;
  }
  async function closeEmergency(alertId,action){
    openModal(action==="resolved"?"Finish emergency alert":"Cancel emergency alert",`<p class="muted">The alert will leave the active board but remain in history.</p><label>Closing note</label><textarea id="mEmergencyCloseNote" rows="3" placeholder="Optional note"></textarea>`,async()=>{const note=$("#mEmergencyCloseNote").value.trim();if(state.live){const {error}=await sb.rpc("finish_emergency_alert",{p_alert_id:alertId,p_action:action,p_note:note||null});if(error){toast(error.message,true);return}await refreshLive()}else{const e=byId(state.emergencies,alertId);if(e){e.status=action;e.resolved_at=new Date().toISOString();e.resolution_note=note}renderEmergencies();renderDashboard()}toast(action==="resolved"?"Emergency alert finished.":"Emergency alert cancelled.")});
  }
  function examStatusTag(s){const cls=s==="cancelled"||s==="deleted"?"red":s==="delayed"?"amber":"green";return `<span class="tag ${cls}">${esc((s||"scheduled").replace(/^./,x=>x.toUpperCase()))}</span>`}
  function renderExams(){
    $("#examWindows").innerHTML=state.examWindows.slice().sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(w=>`<div class="feed-item"><b>${esc(w.exam_type)} · Year ${w.year_group}</b><p>${fmtDate(w.start_date)} – ${fmtDate(w.end_date)}</p></div>`).join("")||`<div class="empty-state">No exam windows.</div>`;
    const clsFilter=$("#examClassFilter")?.value||"",kind=$("#examKindFilter")?.value||"",showDeleted=$("#showDeletedExams")?.checked,selectedClass=clsFilter?byId(state.classes,clsFilter):null;
    const rows=state.exams.filter(e=>(!kind||e.exam_type===kind)&&(!selectedClass||String(e.subject).toLowerCase()===String(selectedClass.subject).toLowerCase())&&(showDeleted||e.status!=="deleted"));
    $("#examScheduleBody").innerHTML=rows.map(e=>{let cls=e.class_name||"All matching classes";if(e.class_id)cls=classDisplay(byId(state.classes,e.class_id));const actions=e.status==="deleted"?`<button class="secondary mini-btn" data-exam-action="scheduled" data-exam-id="${e.id}">Restore</button>`:`<button class="secondary mini-btn" data-exam-action="delayed" data-exam-id="${e.id}">Delay</button><button class="secondary mini-btn" data-exam-action="cancelled" data-exam-id="${e.id}">Cancel</button><button class="danger mini-btn" data-exam-action="deleted" data-exam-id="${e.id}">Delete</button>`;return `<tr><td>${fmtDate(e.exam_date)}</td><td>${esc((e.start_time||"").slice(0,5)||"—")}</td><td>${esc(cls)}</td><td><b>${esc(e.paper||e.subject||"Exam")}</b><br><small>${esc(e.exam_type||"")}${e.status_note?` · ${esc(e.status_note)}`:""}</small></td><td>${examStatusTag(e.status||"scheduled")}</td><td>${esc(e.room_code||"HALL")}</td><td>${esc(e.duration_minutes||"—")} min</td><td><div class="mini-actions">${actions}</div></td></tr>`}).join("")||`<tr><td colspan="8"><div class="empty-state">No exams scheduled.</div></td></tr>`;
  }
  async function updateExamStatus(examId,status){
    const e=byId(state.exams,examId);if(!e)return;
    if(status==="delayed"){
      const tomorrow=new Date((e.exam_date||todayISO)+"T12:00:00");tomorrow.setDate(tomorrow.getDate()+1);const next=tomorrow.toISOString().slice(0,10);
      openModal("Delay / reschedule exam",`<p><b>${esc(e.paper||e.subject)}</b></p><label>New exam date</label><input id="mExamNewDate" type="date" value="${next}"><label>Reason / student note</label><textarea id="mExamStatusNote" rows="3" placeholder="e.g. Delayed due to site closure"></textarea>`,async()=>applyExamStatus(examId,status,$("#mExamNewDate").value,$("#mExamStatusNote").value.trim()));return;
    }
    const title=status==="cancelled"?"Cancel exam":status==="deleted"?"Delete exam from student view":"Restore exam";
    openModal(title,`<p class="muted">${status==="deleted"?"Students will no longer see this exam. Staff can restore it by showing deleted exams.":status==="cancelled"?"Students will see a Cancelled tag.":"The exam will return to Scheduled."}</p><label>Note</label><textarea id="mExamStatusNote" rows="3"></textarea>`,async()=>applyExamStatus(examId,status,null,$("#mExamStatusNote").value.trim()));
  }
  async function applyExamStatus(examId,status,newDate,note){
    if(state.live){const {error}=await sb.rpc("set_exam_status",{p_exam_id:examId,p_status:status,p_new_date:newDate||null,p_note:note||null});if(error){toast(error.message,true);return}await refreshLive()}else{const e=byId(state.exams,examId);if(e){if(status==="delayed"&&newDate){e.original_exam_date=e.original_exam_date||e.exam_date;e.exam_date=newDate}e.status=status;e.status_note=note||null}renderExams()}toast(`Exam marked ${status}.`);
  }
  function renderCalendar(){
    if(!state.calendarCursor){const n=new Date();state.calendarCursor=new Date(n.getFullYear(),n.getMonth(),1)}const cur=state.calendarCursor,year=cur.getFullYear(),month=cur.getMonth(),first=new Date(year,month,1),last=new Date(year,month+1,0);$("#calendarLabel").textContent=cur.toLocaleDateString("en-GB",{month:"long",year:"numeric"});let html=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="calendar-cell calendar-head">${d}</div>`).join("");let start=(first.getDay()+6)%7;for(let i=0;i<start;i++)html+=`<div class="calendar-cell"></div>`;
    for(let day=1;day<=last.getDate();day++){const iso=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,events=[];state.calendarEvents.filter(e=>e.event_date===iso).forEach(e=>events.push(`<div class="cal-event ${esc(e.category||"school")}">${esc(e.title)}</div>`));state.exams.filter(e=>e.exam_date===iso&&e.status!=="deleted").forEach(e=>events.push(`<div class="cal-event exam">${esc(e.subject)} ${e.status&&e.status!=="scheduled"?`· ${esc(e.status)}`:""}</div>`));state.examWindows.filter(w=>w.start_date===iso).forEach(w=>events.push(`<div class="cal-event exam">${esc(w.exam_type)} starts</div>`));html+=`<button class="calendar-cell calendar-day" data-calendar-day="${iso}"><div class="calendar-date">${day}</div>${events.join("")}</button>`}$("#calendarGrid").innerHTML=html;
    const list=state.calendarEvents.slice().sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date)));$("#calendarEventList").innerHTML=list.map(e=>`<div class="feed-item calendar-list-item"><div><b>${esc(e.title)}</b><p>${fmtDate(e.event_date)}${e.end_date?` – ${fmtDate(e.end_date)}`:""} · ${esc(e.category||"school")}<br>${esc(e.details||"")}</p></div><button class="secondary mini-btn" data-calendar-delete="${esc(e.id)}">Delete</button></div>`).join("")||`<div class="empty-state">No custom events yet. Click a day to add one.</div>`;
  }
  function newCalendarEvent(prefill=todayISO){
    openModal("Add calendar event",`<label>Title</label><input id="mCalTitle" placeholder="Event title"><div class="form-grid two"><div><label>Start date</label><input id="mCalDate" type="date" value="${prefill}"></div><div><label>End date</label><input id="mCalEnd" type="date"></div></div><label>Category</label><select id="mCalCategory"><option value="school">School</option><option value="exam">Exam</option><option value="staff">Staff</option><option value="event">Event</option><option value="closure">Closure</option></select><label>Details</label><textarea id="mCalDetails" rows="3"></textarea>`,async()=>{const row={title:$("#mCalTitle").value.trim(),event_date:$("#mCalDate").value,end_date:$("#mCalEnd").value||null,category:$("#mCalCategory").value,details:$("#mCalDetails").value.trim()||null};if(!row.title||!row.event_date){toast("Add a title and date.",true);return}if(state.live){const {error}=await sb.from("calendar_events").insert(row);if(error){toast(error.message,true);return}await refreshLive()}else{state.calendarEvents.push({id:id(),...row});renderCalendar()}toast("Calendar event added.")});
  }
  async function deleteCalendarEvent(eventId){
    if(state.live){const {error}=await sb.from("calendar_events").delete().eq("id",eventId);if(error){toast(error.message,true);return}await refreshLive()}else{state.calendarEvents=state.calendarEvents.filter(e=>String(e.id)!==String(eventId));renderCalendar()}toast("Calendar event deleted.");
  }
  function updateProfileTargetClasses(){
    const sid=$("#profileStudentId")?.value,subject=$("#profileMoveSubject")?.value,s=byId(state.students,sid),sel=$("#profileTargetClass");if(!s||!sel)return;sel.innerHTML=state.classes.filter(c=>+c.year_group===+s.year_group&&c.subject===subject).map(c=>`<option value="${esc(c.id)}">${esc(classDisplay(c))} · ${esc(staffName(c))}</option>`).join("");
  }
  function openStudentProfile(studentId){
    if($("#modal").open)$("#modal").close();
    const s=byId(state.students,studentId);if(!s)return;const classes=(s.class_ids||[]).map(cid=>byId(state.classes,cid)).filter(Boolean),bp=state.behaviour.filter(e=>String(e.student_id)===String(s.id)).reduce((n,e)=>n+(+e.points||0),0),hp=state.housePoints.filter(e=>String(e.student_id)===String(s.id)).reduce((n,e)=>n+(+e.points||0),0),marks=state.attendance.filter(a=>String(a.student_id)===String(s.id)),present=marks.filter(a=>["present","late"].includes(a.mark)).length,att=marks.length?Math.round(present/marks.length*100)+"%":"No marks",manage=canManageClasses(),subjects=[...new Set(classes.map(c=>c.subject))];
    const login=s.portal_code_display||"Existing secure code — reset to issue/view a new code";$("#modal").classList.add("profile-dialog");$("#modalTitle").textContent=`${fullName(s)} · Student profile`;$("#modalBody").innerHTML=`<input id="profileStudentId" type="hidden" value="${esc(s.id)}"><div class="profile-metrics"><div><span>Year</span><b>${s.year_group}</b></div><div><span>Tutor</span><b>${esc(tutorName(s))}</b></div><div><span>House</span><b>${esc(houseName(s))}</b></div><div><span>Attendance</span><b>${att}</b></div><div><span>Behaviour points</span><b>${bp}</b></div><div><span>House points</span><b>${hp}</b></div></div><div class="profile-grid"><article class="profile-card"><h3>Identity & login</h3><dl><dt>Full name</dt><dd>${esc(fullName(s))}</dd><dt>Candidate number</dt><dd>${esc(s.candidate_number||"—")}</dd><dt>Student login code</dt><dd><code>${esc(login)}</code></dd><dt>Status</dt><dd>${esc(s.status||"active")}</dd></dl>${manage?`<button class="secondary" id="profileResetCode">Reset student login code</button>`:""}</article><article class="profile-card"><h3>Classes</h3>${classes.map(c=>`<div class="profile-class"><b>${esc(classDisplay(c))}</b><span>${esc(staffName(c))} · ${esc(c.room_code||"Room TBC")}</span></div>`).join("")||'<div class="empty-state">No classes</div>'}</article></div>${manage?`<article class="profile-card class-move"><h3>Move student to another set/class</h3><p class="muted">Admin/SLT only. Moving class regenerates Week A and Week B so the target class times appear immediately.</p><div class="toolbar"><select id="profileMoveSubject">${subjects.map(x=>`<option>${esc(x)}</option>`).join("")}</select><select id="profileTargetClass"></select><button id="profileMoveBtn" class="primary">Move class</button></div></article>`:""}<article class="profile-card"><div class="panel-head"><div><h3>Timetable</h3><p>Current student schedule</p></div><select id="profileWeek" class="compact-select"><option value="A">Week A</option><option value="B">Week B</option></select></div><div id="profileTimetable" class="timetable-grid"></div></article>`;$("#modalConfirm").textContent="Close";$("#modalConfirm").onclick=e=>{e.preventDefault();$("#modal").close();$("#modal").classList.remove("profile-dialog")};$("#modal").showModal();
    if(manage){updateProfileTargetClasses();$("#profileMoveSubject").onchange=updateProfileTargetClasses;$("#profileMoveBtn").onclick=()=>moveProfileClass(s.id,$("#profileTargetClass").value);$("#profileResetCode").onclick=()=>resetProfileCode(s.id)}$("#profileWeek").onchange=()=>renderTimetable(s.id,"#profileTimetable",$("#profileWeek").value);renderTimetable(s.id,"#profileTimetable","A");
  }
  async function moveProfileClass(studentId,classId){
    if(!classId)return;if(state.live){const {data,error}=await sb.rpc("move_student_class",{p_student_id:studentId,p_new_class_id:classId});if(error){toast(error.message,true);return}await refreshLive();toast(`Moved to ${data}.`);if($("#modal").open)$("#modal").close();openStudentProfile(studentId)}else{const s=byId(state.students,studentId),target=byId(state.classes,classId);const oldIds=(s.class_ids||[]).filter(cid=>byId(state.classes,cid)?.subject===target.subject);s.class_ids=(s.class_ids||[]).filter(cid=>!oldIds.includes(cid));s.class_ids.push(target.id);state.classes.forEach(c=>c.student_count=state.students.filter(st=>(st.class_ids||[]).includes(c.id)).length);buildPreviewTimetable();renderAll();toast(`Moved to ${classDisplay(target)}.`);if($("#modal").open)$("#modal").close();openStudentProfile(studentId)}
  }
  async function resetProfileCode(studentId){
    if(state.live){const {data,error}=await sb.rpc("reset_student_portal_code",{p_student_id:studentId});if(error){toast(error.message,true);return}const s=byId(state.students,studentId);if(s)s.portal_code_display=data;toast("New student login code generated. The previous code no longer works.");if($("#modal").open)$("#modal").close();openStudentProfile(studentId)}else{const s=byId(state.students,studentId);s.portal_code_display=randomCode();toast("New preview login code generated.");if($("#modal").open)$("#modal").close();openStudentProfile(studentId)}
  }
  function showStudentPortal(data){
    $("#staffGate").hidden=true;$("#app").hidden=true;$("#studentPortal").hidden=false;const s=data.student;$("#portalName").textContent=`Welcome, ${s.first_name}.`;$("#portalMeta").textContent=`Year ${s.year_group} · Read-only student/parent access`;$("#portalCandidate").textContent=s.candidate_number||"—";$("#portalTutor").textContent=s.tutor_code||tutorName(s);$("#portalHouse").textContent=s.house_name||houseName(s);const ex=(data.exams||[]).filter(e=>e.status!=="cancelled").slice().sort((a,b)=>String(a.exam_date).localeCompare(String(b.exam_date)))[0];$("#portalNextExam").textContent=ex?fmtDate(ex.exam_date):"None";$("#portalClasses").innerHTML=(data.classes||[]).map(c=>`<div class="simple-item"><b>${esc(classDisplay(c))}</b><p>${esc(c.teacher_name||"Teacher TBC")} · ${esc(c.room_code||"Room TBC")}</p></div>`).join("")||`<div class="empty-state">No classes found.</div>`;$("#portalNotices").innerHTML=[...(data.notices||[]),...(data.exams||[]).map(e=>({title:`${e.exam_type||"Exam"} · ${e.subject||e.paper} · ${(e.status||"scheduled").toUpperCase()}`,body:`${fmtDate(e.exam_date)} at ${(e.start_time||"").slice(0,5)}${e.status_note?` · ${e.status_note}`:""}`}))].map(n=>`<div class="feed-item"><b>${esc(n.title||"Notice")}</b><p>${esc(n.body||"")}</p></div>`).join("");state.timetable=data.timetable||[];$("#portalWeek").value="A";renderTimetable(s.id,"#portalTimetable","A");$("#portalWeek").onchange=()=>renderTimetable(s.id,"#portalTimetable",$("#portalWeek").value);
  }
  async function createClasses(){
    const year=+$("#classYear").value,count=+$("#setCount").value,mode=$("#subjectMode").value,single=$("#singleSubject").value;
    if(state.live){const {error}=await sb.rpc("create_class_batch",{p_year_group:year,p_set_count:count,p_mode:mode,p_single_subject:mode==="single"?single:null});if(error){toast(error.message,true);return}if(canManageClasses()){for(const fn of ["assign_teachers_to_classes","rebuild_class_schedule","rebuild_all_current_timetables"]){const {error:e}=await sb.rpc(fn);if(e){toast(e.message,true);return}}}await refreshLive()}else{let subs=SUBJECTS;if(mode==="core")subs=SUBJECTS.filter(s=>s[2]==="core");if(mode==="gcse")subs=SUBJECTS.filter(s=>s[2]==="gcse");if(mode==="single")subs=SUBJECTS.filter(s=>s[0]===single);subs.forEach(([sub,prefix,type])=>{const number=type==="core"?count:(["History","Geography"].includes(sub)?2:1);for(let n=1;n<=number;n++){if(state.classes.some(c=>+c.year_group===year&&c.subject===sub&&+c.set_number===n))continue;state.classes.push({id:id(),display_name:`${year}${prefix}${number===2&&type!=="core"?(n===1?"A":"B"):n} ${sub}`,subject:sub,subject_code:prefix,year_group:year,set_number:n,room_code:roomFor(sub,n),student_count:0})}});buildPreviewTimetable();renderAll()}toast("Classes created and timetable schedules refreshed.");
  }
  function openModal(title,body,onConfirm){if($("#modal").open)$("#modal").close();$("#modal").classList.remove("profile-dialog");$("#modalTitle").textContent=title;$("#modalBody").innerHTML=body;const m=$("#modal");$("#modalConfirm").textContent="Save";m.showModal();$("#modalConfirm").onclick=async ev=>{ev.preventDefault();await onConfirm?.();if(m.open)m.close()}}
  // =========================== end OneEducation v3 ============================

  function bind(){
    $$(".gate-tab").forEach(b=>b.onclick=()=>{$$(".gate-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");const stu=b.dataset.gate==="student";$("#staffLoginPane").hidden=stu;$("#studentLoginPane").hidden=!stu});
    const passwordStaffLogin=async()=>{
      const email=$("#staffEmail").value.trim();
      const password=$("#staffPassword").value;
      if(!email||!password){toast("Enter your staff email and password.",true);return}
      const btn=$("#staffPasswordLoginBtn"); const previous=btn.textContent; btn.disabled=true; btn.textContent="Signing in…";
      try{
        const {data,error}=await sb.auth.signInWithPassword({email,password});
        if(error)throw error;
        if(!data.session)throw new Error("Supabase did not return a staff session.");
        toast("Signed in to OneEducation.");
        await openStaff(false);
      }catch(e){toast(e.message||"Could not sign in.",true)}
      finally{btn.disabled=false;btn.textContent=previous}
    };
    $("#staffPasswordLoginBtn").onclick=passwordStaffLogin;
    $("#staffPassword").addEventListener("keydown",e=>{if(e.key==="Enter")passwordStaffLogin()});
    $("#sendMagicLinkBtn").onclick=async()=>{
      const email=$("#staffEmail").value.trim();if(!email){toast("Enter your email.",true);return}
      const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.href.split("#")[0]}});
      if(error){
        const msg=/rate limit/i.test(error.message||"") ? "Supabase email rate limit reached. Use password sign-in instead, or wait before requesting another email." : error.message;
        toast(msg,true);
      } else toast("Secure sign-in link sent. Check your email.");
    };
    $("#staffSignOutBtn").onclick=async()=>{if(state.live)await sb.auth.signOut();location.reload()};
    $("#demoStaffBtn").onclick=()=>openStaff(true); $("#studentLoginBtn").onclick=studentLogin;
    $("#studentLogout").onclick=()=>{location.reload()};
    $$(".nav-item").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
    $$("[data-jump]").forEach(b=>b.onclick=()=>switchView(b.dataset.jump));
    $("#mobileMenu").onclick=()=>$(".sidebar").classList.toggle("open");
    $("#studentSearch").oninput=renderStudents;$("#studentYearFilter").onchange=renderStudents;$("#refreshStudents").onclick=refreshLive;
    $("#importYear").onchange=renderImportTutors;$("#runImport").onclick=runImport;$("#downloadCodes").onclick=downloadCodes;
    $("#previewImport").onclick=()=>{const n=$("#importNames").value.split(/\n+/).filter(x=>x.trim()).length;toast(`${n} row${n===1?"":"s"} ready to import.`)};
    $("#loadRegister").onclick=loadRegister;$("#registerList").onclick=e=>{const row=e.target.closest(".register-row");if(!row)return;if(e.target.matches(".mark-btn"))saveMark(row,e.target.dataset.mark,e.target);if(e.target.matches(".expand-btn")){const d=row.querySelector(".absence-details");d.hidden=!d.hidden}};
    $("#issueBehaviour").onclick=issueBehaviour;$("#awardHouse").onclick=awardHouse;$("#createClasses").onclick=createClasses;
    $$(".status-option").forEach(b=>b.onclick=()=>setSchoolStatus(b.dataset.schoolStatus));
    $("#loadTimetable").onclick=()=>renderTimetable($("#ttStudent").value,"#timetableGrid",$("#ttWeek").value);
    $$(".subtab").forEach(b=>b.onclick=()=>{$$(".subtab").forEach(x=>x.classList.remove("active"));$$(".examtab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#examtab-"+b.dataset.examtab).classList.add("active")});
    const syncExamType=()=>{const mock1=[...$("#examType").options].find(o=>o.value==="Mock 1");if(mock1)mock1.disabled=+$("#examYear").value!==10;if($("#examType").value==="Mock 1"&&+$("#examYear").value!==10)$("#examType").value="Mock 2"};$("#examYear").onchange=syncExamType;syncExamType();
    $("#createExamWindow").onclick=createExamWindow;$("#importGcseCsv").onclick=importGcse;$("#examKindFilter").onchange=renderExams;$("#examClassFilter").onchange=renderExams;
    $("#communitySelect").onchange=renderCommunityFeed;
    $("#postCommunity").onclick=async()=>{const body=$("#communityPost").value.trim(),community_id=$("#communitySelect").value;if(!body)return;if(state.live){const {error}=await sb.from("community_posts").insert({community_id,title:"Announcement",body});if(error){toast(error.message,true);return}await refreshLive()}else{state.communityPosts.push({id:id(),community_id,title:"Announcement",body,created_at:new Date().toISOString()});renderCommunityFeed()}$("#communityPost").value="";toast("Announcement posted.")};
    $("#newTutorBtn").onclick=newTutor;$("#newEmergency").onclick=newEmergency;$("#addCover").onclick=newCover;
    document.addEventListener("click",e=>{const b=e.target.closest("[data-open-community]");if(b){switchView("communities");const c=state.communities.find(x=>x.type==="tutor"&&String(x.ref_id)===String(b.dataset.openCommunity));if(c){$("#communitySelect").value=c.id;renderCommunityFeed()}}});
    $("#quickAdd").onclick=()=>switchView("import");
    $("#ttWeek").onchange=()=>{if($("#ttStudent").value)renderTimetable($("#ttStudent").value,"#timetableGrid",$("#ttWeek").value)};
    $("#staffSelect").onchange=()=>renderStaffTimetable($("#staffSelect").value,$("#staffWeek").value);$("#staffWeek").onchange=()=>renderStaffTimetable($("#staffSelect").value,$("#staffWeek").value);
    $("#showDeletedExams").onchange=renderExams;
    $("#calendarPrev").onclick=()=>{if(!state.calendarCursor)state.calendarCursor=new Date();state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()-1,1);renderCalendar()};
    $("#calendarNext").onclick=()=>{if(!state.calendarCursor)state.calendarCursor=new Date();state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()+1,1);renderCalendar()};
    $("#calendarAdd").onclick=()=>newCalendarEvent(todayISO);
    document.addEventListener("click",e=>{const sp=e.target.closest("[data-student-profile]");if(sp)openStudentProfile(sp.dataset.studentProfile);const st=e.target.closest("[data-staff-timetable]");if(st){switchView("staff");$("#staffSelect").value=st.dataset.staffTimetable;renderStaffTimetable(st.dataset.staffTimetable,$("#staffWeek").value)}const em=e.target.closest("[data-emergency-action]");if(em)closeEmergency(em.dataset.emergencyId,em.dataset.emergencyAction);const ex=e.target.closest("[data-exam-action]");if(ex)updateExamStatus(ex.dataset.examId,ex.dataset.examAction);const day=e.target.closest("[data-calendar-day]");if(day)newCalendarEvent(day.dataset.calendarDay);const del=e.target.closest("[data-calendar-delete]");if(del)deleteCalendarEvent(del.dataset.calendarDelete)});
    $("#registerDate").value=todayISO;$("#examStart").value="2026-11-09";$("#examEnd").value="2026-11-13";
  }
  function switchView(name){
    $$(".view").forEach(v=>v.classList.remove("active"));$("#view-"+name)?.classList.add("active");
    $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===name));
    const title=$(`.nav-item[data-view="${name}"]`)?.textContent.trim()||name;$("#pageTitle").textContent=title;
    $(".sidebar").classList.remove("open");
    if(name==="timetable"&&$("#ttStudent").value)renderTimetable($("#ttStudent").value);
  }

  async function boot(){
    bind();
    try{
      const {data}=await sb.auth.getSession();
      if(data.session) await openStaff(false);
      else seedPreview(); // gives student demo access before staff gate
    }catch(e){ seedPreview(); }
  }
  boot();
})();
