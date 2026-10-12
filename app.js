(()=>{'use strict';
const $=id=>document.getElementById(id),KEY='time-tracker-v1',GOAL_KEY='time-tracker-daily-goal',WEEK_GOAL_KEY='time-tracker-week-goal',MONTH_GOAL_KEY='time-tracker-month-goal',TEMPLATE_KEY='time-tracker-templates';
let editId=null,selectedEntryIds=new Set(),copiedDayEntries=[],s,goal=Number(localStorage.getItem(GOAL_KEY))||8,weekGoal=Number(localStorage.getItem(WEEK_GOAL_KEY))||40,monthGoal=Number(localStorage.getItem(MONTH_GOAL_KEY))||160;
try{s=JSON.parse(localStorage.getItem(KEY))||{entries:[],todos:[]}}catch{s={entries:[],todos:[]}}
if(!s||!Array.isArray(s.entries)||!Array.isArray(s.todos))s={entries:[],todos:[]};
let templates;try{templates=JSON.parse(localStorage.getItem(TEMPLATE_KEY))||[]}catch{templates=[]}if(!Array.isArray(templates))templates=[];const saveTemplates=()=>localStorage.setItem(TEMPLATE_KEY,JSON.stringify(templates));
const AUTO_BACKUP_KEY='time-tracker-auto-backup-v1',AUTO_BACKUP_TIME_KEY='time-tracker-auto-backup-time';
const save=()=>{const raw=JSON.stringify(s);localStorage.setItem(KEY,raw);localStorage.setItem(AUTO_BACKUP_KEY,raw);localStorage.setItem(AUTO_BACKUP_TIME_KEY,new Date().toISOString());updateAutoBackupStatus()};
const updateAutoBackupStatus=()=>{const raw=localStorage.getItem(AUTO_BACKUP_KEY),stamp=localStorage.getItem(AUTO_BACKUP_TIME_KEY);$('autoBackupStatus').textContent=raw?'최근 자동 저장: '+(stamp?new Date(stamp).toLocaleString():'시간 정보 없음')+' · 별도 파일 백업도 권장합니다.':'자동 백업이 아직 없습니다.'};
const downloadBackup=()=>{const raw=localStorage.getItem(AUTO_BACKUP_KEY);if(!raw){alert('다운로드할 자동 백업이 없습니다. 먼저 기록을 저장해 주세요.');return}const a=document.createElement('a'),u=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=u;a.download='time-tracker-auto-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};

const dateStr=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>dateStr(new Date());
updateAutoBackupStatus();
$('day').value=today();$('goalHours').value=goal;$('weekGoal').value=weekGoal;$('monthGoal').value=monthGoal;
const min=t=>{let [h,m]=String(t||'0:0').split(':').map(Number);return h*60+m};
const dur=e=>Math.max(0,min(e.end)-min(e.start));
const fmt=n=>Math.floor(n/60)?Math.floor(n/60)+'시간 '+n%60+'분':n+'분';
const esc=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderRepeatGroups(){
 const groups={};
 s.entries.filter(e=>e.kind==='planned'&&String(e.note||'').startsWith('반복 일정: ')).forEach(e=>{const name=e.note.slice('반복 일정: '.length);(groups[name]??=[]).push(e)});
 const names=Object.keys(groups).sort();
 $('repeatGroups').innerHTML=names.length?names.map(name=>{const items=groups[name].sort((a,b)=>a.date.localeCompare(b.date));return '<div class="repeat-group"><div><b>'+esc(name)+'</b><small>'+items[0].date+' ~ '+items[items.length-1].date+' · '+items.length+'개</small></div><div class="repeat-actions"><button type="button" data-edit-repeat="'+esc(name)+'">기간 수정</button><button type="button" class="delete" data-delete-repeat="'+esc(name)+'">묶음 삭제</button></div></div>'}).join(''):'<p class="muted">생성된 반복 일정이 없습니다.</p>';
}
function renderTemplates(){
 $('templates').innerHTML=templates.length?templates.map(t=>'<div class="template-item"><label class="template-check"><input type="checkbox" data-template-check="'+esc(t.id)+'"><span>'+esc(t.name)+'</span></label><button type="button" class="template-use" data-use-template="'+esc(t.id)+'"><small>'+esc(t.activity)+' · '+t.start+'–'+t.end+' · '+(t.kind==='planned'?'计划':'实际')+'</small></button><button type="button" class="delete" data-delete-template="'+esc(t.id)+'" aria-label="删除模板">×</button></div>').join(''):'<p class="muted">저장한 템플릿이 없습니다. 아래에서 추가해 보세요.</p>';
}
function renderCalendar(){
 const selected=$('day').value||today(),parts=selected.split('-').map(Number),year=parts[0],month=parts[1]-1;
 const first=new Date(year,month,1,12),offset=(first.getDay()+6)%7,daysInMonth=new Date(year,month+1,0).getDate(),cells=[];
 $('calTitle').textContent=year+'년 '+(month+1)+'월';
 for(let n=0;n<offset;n++)cells.push('<span class="calendar-empty"></span>');
 for(let day=1;day<=daysInMonth;day++){
  const ds=dateStr(new Date(year,month,day,12)),entries=s.entries.filter(x=>x.date===ds),actual=entries.filter(x=>x.kind==='actual').reduce((sum,x)=>sum+dur(x),0),achieved=actual>=goal*60,classes=['calendar-day'];
  if(ds===selected)classes.push('selected');if(achieved)classes.push('achieved');else if(entries.length)classes.push('recorded');
  cells.push('<button type="button" class="'+classes.join(' ')+'" data-date="'+ds+'"><span>'+day+'</span><small>'+(entries.length?Math.round(actual/60*10)/10+'h':'')+'</small></button>');
 }
 $('calendar').innerHTML=cells.join('');
}
function render(){
 const date=$('day').value,es=s.entries.filter(e=>e.date===date).sort((a,b)=>a.start.localeCompare(b.start));
 const p=es.filter(e=>e.kind==='planned').reduce((n,e)=>n+dur(e),0),a=es.filter(e=>e.kind==='actual').reduce((n,e)=>n+dur(e),0);
 $('planned').textContent=fmt(p);$('actual').textContent=fmt(a);$('count').textContent=es.length;
 $('entries').innerHTML=es.length?es.map(e=>'<div class="entry"><label class="entry-select"><input type="checkbox" data-entry-check="'+esc(e.id)+'" '+(selectedEntryIds.has(e.id)?'checked':'')+' aria-label="'+esc(e.name)+' 선택"></label><div class="entrymain"><b>'+esc(e.name)+'</b><div class="meta">'+e.start+'–'+e.end+' · '+(e.kind==='planned'?'계획':'실제')+' · '+esc(e.cat||'미분류')+(e.note?' · '+esc(e.note):'')+'</div></div><b class="duration">'+fmt(dur(e))+'</b><button data-edit="'+esc(e.id)+'">수정</button><button class="delete" data-del="'+esc(e.id)+'">삭제</button></div>').join(''):'<p class="muted">기록이 없습니다. 첫 시간을 추가해 보세요.</p>';
 $('selectAllEntries').checked=es.length>0&&es.every(x=>selectedEntryIds.has(x.id));
 const ts=s.todos.filter(t=>t.date===date);
 $('todos').innerHTML=ts.length?ts.map(t=>'<div class="todo '+(t.done?'done':'')+'"><input type="checkbox" data-check="'+esc(t.id)+'" '+(t.done?'checked':'')+'><label>'+esc(t.text)+'</label><button class="delete" data-todo-del="'+esc(t.id)+'">삭제</button></div>').join(''):'<p class="muted">할 일이 없습니다.</p>';
 const goalMinutes=goal*60,percent=goalMinutes?Math.min(100,Math.round(a/goalMinutes*100)):0;
 $('goalLabel').textContent='목표 '+fmt(goalMinutes);$('goalProgress').style.width=percent+'%';
 $('goalMessage').textContent=a>=goalMinutes?'목표 달성! 실제 기록 '+fmt(a):'목표의 '+percent+'% · '+fmt(Math.max(0,goalMinutes-a))+' 남음';
 const groups={};es.forEach(e=>{const k=e.cat||'미분류';groups[k]??={planned:0,actual:0};groups[k][e.kind]+=dur(e)});
 const catRows=Object.entries(groups).map(([k,v])=>{const rate=v.planned?Math.round(v.actual/v.planned*100):null;return '<div class="statrow"><span>'+esc(k)+'</span><span>계획 '+fmt(v.planned)+' · 실제 '+fmt(v.actual)+' · '+(rate===null?'계획 없음':rate+'%')+'</span></div>'});$('comparison').innerHTML='<div class="periodtotal">계획 '+fmt(p)+' · 실제 '+fmt(a)+' · '+(p?Math.round(a/p*100)+'%':'계획 없음')+'</div>'+ (p?'<div class="progress"><div style="width:'+Math.min(100,Math.round(a/p*100))+'%"></div></div>':'')+'<p class="muted">실제 시간 ÷ 계획 시간. 100% 초과는 계획보다 더 기록했다는 뜻입니다.</p>'+ (catRows.length?catRows.join(''):'<p class="muted">비교할 기록이 없습니다.</p>'); $('stats').innerHTML=Object.keys(groups).length?Object.entries(groups).map(([k,v])=>'<div class="statrow"><span>'+esc(k)+'</span><span>계획 '+fmt(v.planned)+' · 실제 '+fmt(v.actual)+'</span></div>').join(''):'<p class="muted">분석할 기록이 없습니다.</p>';
 const selected=new Date(date+'T12:00:00'),weekStart=new Date(selected);weekStart.setDate(selected.getDate()-((selected.getDay()+6)%7));
 let weekRows=[],weekTotal=0,weekPlanned=0;
 for(let n=0;n<7;n++){const d=new Date(weekStart);d.setDate(weekStart.getDate()+n);const ds=dateStr(d),dayEntries=s.entries.filter(x=>x.date===ds),v=dayEntries.filter(x=>x.kind==='actual').reduce((sum,x)=>sum+dur(x),0),pv=dayEntries.filter(x=>x.kind==='planned').reduce((sum,x)=>sum+dur(x),0);weekTotal+=v;weekPlanned+=pv;weekRows.push('<div class="periodrow"><span>'+ds.slice(5)+'</span><span>계획 '+fmt(pv)+' · 실제 '+fmt(v)+' · '+(pv?Math.round(v/pv*100)+'%':'—')+'</span></div>')}
 $('weekStats').innerHTML='<div class="periodtotal">주간 계획 '+fmt(weekPlanned)+' · 실제 '+fmt(weekTotal)+' · '+(weekPlanned?Math.round(weekTotal/weekPlanned*100)+'%':'계획 없음')+'</div>'+weekRows.join('');
 const wg=weekGoal*60,wp=wg?Math.min(100,Math.round(weekTotal/wg*100)):0;$('weekGoalProgress').style.width=wp+'%';$('weekGoalMessage').textContent=weekTotal>=wg?'주간 목표 달성! '+fmt(weekTotal):'주간 목표의 '+wp+'% · '+fmt(Math.max(0,wg-weekTotal))+' 남음';

 const month=date.slice(0,7),me=s.entries.filter(x=>x.date.startsWith(month)&&x.kind==='actual'),monthTotal=me.reduce((sum,x)=>sum+dur(x),0),days=new Set(me.map(x=>x.date)).size;
 $('monthStats').innerHTML='<div class="periodtotal">월간 실제 기록 <b>'+fmt(monthTotal)+'</b></div><div class="periodrow"><span>실제 기록한 날짜</span><b>'+days+'일</b></div><div class="periodrow"><span>기록일 평균</span><b>'+fmt(days?Math.round(monthTotal/days):0)+'</b></div>';
 const mg=monthGoal*60,mp=mg?Math.min(100,Math.round(monthTotal/mg*100)):0;$('monthGoalProgress').style.width=mp+'%';$('monthGoalMessage').textContent=monthTotal>=mg?'월간 목표 달성! '+fmt(monthTotal):'월간 목표의 '+mp+'% · '+fmt(Math.max(0,mg-monthTotal))+' 남음';

 renderCalendar();renderTemplates();renderRepeatGroups();
}
function resetEntryForm(){editId=null;$('entryForm').reset();$('start').value='09:00';$('end').value='10:00';$('saveEntry').textContent='기록 저장';$('cancelEdit').hidden=true}
$('templateForm').onsubmit=e=>{e.preventDefault();const name=$('templateName').value.trim(),activity=$('templateActivity').value.trim(),start=$('templateStart').value,end=$('templateEnd').value;if(!name||!activity||!start||!end||min(end)<=min(start)){alert('템플릿 이름, 활동명과 올바른 시간을 입력해 주세요.');return}templates.push({id:Date.now().toString(),name,activity,start,end,kind:$('templateKind').value,cat:$('templateCat').value.trim()});saveTemplates();$('templateForm').reset();$('templateStart').value='07:00';$('templateEnd').value='08:00';renderTemplates()};
$('entryForm').onsubmit=e=>{
 e.preventDefault();const start=$('start').value,end=$('end').value;
 if(!start||!end||min(end)<=min(start)){alert('종료 시간은 시작 시간보다 늦어야 합니다.');return}
 const item={id:editId||Date.now().toString(),date:$('day').value,name:$('name').value.trim(),start,end,kind:$('kind').value,cat:$('cat').value.trim(),note:$('note').value.trim()};
 if(!item.name){alert('활동 이름을 입력해 주세요.');return}
 const collision=s.entries.some(x=>x.id!==editId&&x.date===item.date&&x.kind===item.kind&&min(item.start)<min(x.end)&&min(item.end)>min(x.start));
 if(collision){alert('같은 날짜의 같은 종류 기록과 시간이 겹칩니다. 시간을 확인해 주세요.');return}
 if(editId){const i=s.entries.findIndex(x=>x.id===editId);if(i>=0)s.entries[i]=item}else s.entries.push(item);
 save();resetEntryForm();render();
};
$('todoForm').onsubmit=e=>{e.preventDefault();const text=$('todoText').value.trim();if(!text)return;s.todos.push({id:Date.now().toString(),date:$('day').value,text,done:false});save();$('todoText').value='';render()};
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='generateRepeat'){
 const start=$('repeatStart').value,end=$('repeatEnd').value,days=[...document.querySelectorAll('[name="repeatDay"]:checked')].map(x=>Number(x.value)),chosen=[...document.querySelectorAll('[data-template-check]:checked')].map(x=>templates.find(t=>t.id===x.dataset.templateCheck)).filter(Boolean);
 if(!start||!end||end<start){alert('시작일과 종료일을 올바르게 선택해 주세요.');return}
 const startDate=new Date(start+'T12:00:00'),endDate=new Date(end+'T12:00:00'),span=Math.round((endDate-startDate)/86400000)+1;
 if(span>90){alert('반복 일정은 한 번에 최대 90일까지 생성할 수 있어요.');return}
 if(!days.length){alert('반복할 요일을 하나 이상 선택해 주세요.');return}
 if(!chosen.length){alert('먼저 반복할 템플릿을 선택해 주세요.');return}
 const plans=[];
 for(let d=new Date(startDate);d<=endDate;d.setDate(d.getDate()+1)){if(!days.includes(d.getDay()))continue;const date=dateStr(d);for(const t of chosen){if(min(t.end)<=min(t.start)){alert('시간이 올바르지 않은 템플릿이 있어요: '+t.name);return}plans.push({id:'repeat-'+date+'-'+t.id,date,name:t.activity,start:t.start,end:t.end,kind:'planned',cat:t.cat||'',note:'반복 일정: '+t.name})}}
 if(!plans.length){alert('선택한 기간에 해당 요일이 없습니다.');return}
 const seen=new Set();
 for(const x of plans){const key=x.date+'|'+x.kind+'|'+x.start+'|'+x.end+'|'+x.name;if(seen.has(key)){alert('중복 템플릿이 있습니다. 선택을 확인해 주세요.');return}seen.add(key);if(s.entries.some(y=>y.date===x.date&&y.kind===x.kind&&min(x.start)<min(y.end)&&min(x.end)>min(y.start))){alert(x.date+'에 기존 계획과 시간이 겹칩니다. 기록을 정리한 뒤 다시 시도해 주세요.');return}}
 if(!confirm(plans.length+'개의 계획 기록을 생성할까요? 실제 기록은 생성하지 않습니다.'))return;
 s.entries.push(...plans);save();$('day').value=start;render();alert(plans.length+'개의 반복 계획을 생성했어요.');
 }
 if(b.id==='batchTemplates'){const chosen=[...document.querySelectorAll('[data-template-check]:checked')].map(x=>templates.find(t=>t.id===x.dataset.templateCheck)).filter(Boolean);if(!chosen.length){alert('먼저 템플릿을 선택해 주세요.');return}const date=$('day').value||today(),newEntries=chosen.map((t,i)=>({id:Date.now().toString()+'-'+i,date,name:t.activity,start:t.start,end:t.end,kind:t.kind,cat:t.cat||'',note:''}));if(newEntries.some(x=>min(x.end)<=min(x.start))){alert('시간이 올바르지 않은 템플릿이 포함되어 있어요. 템플릿 시간을 수정해 주세요.');return}const conflict=newEntries.some((x,i)=>s.entries.some(y=>y.date===date&&y.kind===x.kind&&min(x.start)<min(y.end)&&min(x.end)>min(y.start))||newEntries.slice(0,i).some(y=>y.kind===x.kind&&min(x.start)<min(y.end)&&min(x.end)>min(y.start)));if(conflict){alert('선택한 템플릿이 기존 기록 또는 서로 겹칩니다. 중복을 해결한 뒤 다시 시도해 주세요.');return}if(!confirm('선택한 템플릿 '+newEntries.length+'개를 '+date+'에 추가할까요?'))return;s.entries.push(...newEntries);save();render();alert(newEntries.length+'개 기록을 추가했어요.')}
 if(b.dataset.useTemplate){const t=templates.find(x=>x.id===b.dataset.useTemplate);if(t){resetEntryForm();$('name').value=t.activity;$('start').value=t.start;$('end').value=t.end;$('kind').value=t.kind;$('cat').value=t.cat||'';$('entryForm').scrollIntoView({behavior:'smooth',block:'start'})}}
 if(b.dataset.editRepeat){
 const name=b.dataset.editRepeat,group=s.entries.filter(x=>x.kind==='planned'&&x.note==='반복 일정: '+name);if(!group.length){alert('수정할 반복 일정이 없습니다.');return}
 const oldDates=[...new Set(group.map(x=>x.date))].sort(),start=prompt('새 시작일 (YYYY-MM-DD)',oldDates[0]);if(start===null)return;const end=prompt('새 종료일 (YYYY-MM-DD)',oldDates[oldDates.length-1]);if(end===null)return;
 const valid=v=>/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00').getTime())&&dateStr(new Date(v+'T12:00:00'))===v;
 if(!valid(start)||!valid(end)||end<start){alert('날짜를 YYYY-MM-DD 형식으로 올바르게 입력해 주세요.');return}
 const first=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00'),span=Math.round((last-first)/86400000)+1;if(span>90){alert('수정 범위는 최대 90일까지 가능합니다.');return}
 const dayLabels=['일','월','화','수','목','금','토'],oldDays=[...new Set(oldDates.map(d=>new Date(d+'T12:00:00').getDay()))].sort((a,b)=>a-b),defaultDays=oldDays.map(d=>dayLabels[d]).join(','),dayInput=prompt('반복할 요일을 입력하세요 (일,월,화,수,목,금,토)',defaultDays);if(dayInput===null)return;
 const dayMap={'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6},weekdays=new Set(dayInput.split(/[\\s,，、]+/).filter(Boolean).map(x=>dayMap[x]));if(!weekdays.size||dayInput.split(/[\\s,，、]+/).filter(Boolean).some(x=>dayMap[x]===undefined)){alert('요일은 일,월,화,수,목,금,토 중에서 입력해 주세요.');return}
 const signatures=[...new Map(group.map(x=>[x.name+'|'+x.start+'|'+x.end+'|'+(x.cat||''),{name:x.name,start:x.start,end:x.end,cat:x.cat||''}])).values()];
 for(const t of signatures){const st=prompt(t.name+' 새 시작 시간 (HH:MM)',t.start);if(st===null)return;const en=prompt(t.name+' 새 종료 시간 (HH:MM)',t.end);if(en===null)return;if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(st)||!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(en)||min(en)<=min(st)){alert(t.name+'의 시간이 올바르지 않습니다.');return}t.start=st;t.end=en}
 const oldIds=new Set(group.map(x=>x.id)),proposed=[];
 for(let d=new Date(first);d<=last;d.setDate(d.getDate()+1)){if(!weekdays.has(d.getDay()))continue;const date=dateStr(d);for(const t of signatures)proposed.push({id:'repeat-edit-'+date+'-'+name+'-'+t.start+'-'+t.name,date,name:t.name,start:t.start,end:t.end,kind:'planned',cat:t.cat,note:'반복 일정: '+name})}
 if(!proposed.length){alert('선택한 기간에 해당 요일이 없습니다.');return}
 const collision=proposed.some((x,i)=>s.entries.some(y=>!oldIds.has(y.id)&&y.date===x.date&&y.kind==='planned'&&min(x.start)<min(y.end)&&min(x.end)>min(y.start))||proposed.slice(0,i).some(y=>y.date===x.date&&min(x.start)<min(y.end)&&min(x.end)>min(y.start)));
 if(collision){alert('변경할 일정이 다른 계획과 겹칩니다. 기존 계획을 정리한 뒤 다시 시도해 주세요.');return}
 if(!confirm(name+' 반복 일정을 '+start+'~'+end+' 기간에 새 요일·시간으로 변경할까요? 기존 묶음 기록은 새 일정으로 교체됩니다.'))return;
 s.entries=s.entries.filter(x=>!oldIds.has(x.id));s.entries.push(...proposed);save();$('day').value=start;render();alert(proposed.length+'개의 계획으로 변경했어요.');
 }
 if(b.dataset.deleteRepeat){const name=b.dataset.deleteRepeat,count=s.entries.filter(x=>x.kind==='planned'&&x.note==='반복 일정: '+name).length;if(!confirm('반복 일정 "'+name+'"의 계획 '+count+'개를 모두 삭제할까요?'))return;s.entries=s.entries.filter(x=>!(x.kind==='planned'&&x.note==='반복 일정: '+name));save();render();alert('반복 일정 묶음을 삭제했어요.')}
 if(b.dataset.deleteTemplate){templates=templates.filter(x=>x.id!==b.dataset.deleteTemplate);saveTemplates();renderTemplates()}
 if(b.id==='copyDayEntries'){const date=$('day').value||today();copiedDayEntries=s.entries.filter(x=>x.date===date).map(({name,start,end,kind,cat,note})=>({name,start,end,kind,cat,note}));$('copyDayStatus').textContent=copiedDayEntries.length?date+' 기록 '+copiedDayEntries.length+'개를 복사했어요.':'선택 날짜에 복사할 기록이 없습니다.';return}
 if(b.id==='pasteDayEntries'){if(!copiedDayEntries.length){alert('먼저 복사할 날짜에서 기록 복사를 눌러 주세요.');return}const date=$('day').value||today(),newEntries=copiedDayEntries.map((x,i)=>({...x,id:'copy-'+Date.now()+'-'+i,date}));const invalid=newEntries.some(x=>min(x.end)<=min(x.start));if(invalid){alert('복사한 기록에 올바르지 않은 시간이 포함되어 있어 붙여넣을 수 없습니다.');return}const conflict=newEntries.some((x,i)=>s.entries.some(y=>y.date===date&&y.kind===x.kind&&min(x.start)<min(y.end)&&min(x.end)>min(y.start))||newEntries.slice(0,i).some(y=>y.kind===x.kind&&min(x.start)<min(y.end)&&min(x.end)>min(y.start)));if(conflict){alert('선택 날짜의 기존 기록 또는 복사할 기록끼리 시간이 겹칩니다. 중복을 해결한 뒤 다시 시도해 주세요.');return}if(!confirm(copiedDayEntries.length+'개 기록을 '+date+'에 붙여넣을까요?'))return;s.entries.push(...newEntries);save();render();$('copyDayStatus').textContent='마지막 복사: '+copiedDayEntries.length+'개 기록';alert(newEntries.length+'개 기록을 붙여넣었어요.')}
 if(b.id==='bulkUpdateEntries'){
 const visible=[...document.querySelectorAll('[data-entry-check]')].map(x=>x.dataset.entryCheck),chosen=visible.filter(id=>selectedEntryIds.has(id));if(!chosen.length){alert('수정할 기록을 선택해 주세요.');return}
 const kind=$('bulkKind').value,cat=$('bulkCat').value.trim(),changeCat=cat.length>0;if(!kind&&!changeCat){alert('변경할 기록 종류 또는 분류를 선택·입력해 주세요.');return}
 const updates=s.entries.filter(x=>chosen.includes(x.id)).map(x=>({...x,kind:kind||x.kind,cat:changeCat?cat:x.cat}));
 const chosenSet=new Set(chosen),conflict=updates.some((x,i)=>updates.some((y,j)=>j<i&&x.date===y.date&&x.kind===y.kind&&x.id!==y.id&&min(x.start)<min(y.end)&&min(x.end)>min(y.start))||s.entries.some(y=>!chosenSet.has(y.id)&&y.date===x.date&&y.kind===x.kind&&min(x.start)<min(y.end)&&min(x.end)>min(y.start)));
 if(conflict){alert('변경 후 같은 날짜·종류의 기록 시간이 겹칩니다. 종류를 바꾸거나 기록을 나누어 수정해 주세요.');return}
 const changes=[];if(kind)changes.push(kind==='planned'?'계획':'실제 기록');if(changeCat)changes.push('분류 "'+cat+'"');
 if(!confirm('선택한 '+chosen.length+'개 기록의 '+changes.join(' 및 ')+'을 변경할까요?'))return;
 s.entries=s.entries.map(x=>chosenSet.has(x.id)?{...x,kind:kind||x.kind,cat:changeCat?cat:x.cat}:x);save();$('bulkKind').value='';$('bulkCat').value='';render();alert(chosen.length+'개 기록을 수정했어요.');
 }
 if(b.id==='bulkDeleteEntries'){const visible=[...document.querySelectorAll('[data-entry-check]')].map(x=>x.dataset.entryCheck),chosen=visible.filter(id=>selectedEntryIds.has(id));if(!chosen.length){alert('삭제할 기록을 선택해 주세요.');return}if(!confirm('선택한 '+chosen.length+'개 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;s.entries=s.entries.filter(x=>!chosen.includes(x.id));chosen.forEach(id=>selectedEntryIds.delete(id));save();render();alert(chosen.length+'개 기록을 삭제했어요.')}
 if(b.dataset.edit){const x=s.entries.find(x=>x.id===b.dataset.edit);if(x){editId=x.id;$('day').value=x.date;$('name').value=x.name;$('start').value=x.start;$('end').value=x.end;$('kind').value=x.kind;$('cat').value=x.cat||'';$('note').value=x.note||'';$('saveEntry').textContent='수정 저장';$('cancelEdit').hidden=false;$('entryForm').scrollIntoView({behavior:'smooth',block:'start'})}}
 if(b.dataset.del){if(editId===b.dataset.del)resetEntryForm();s.entries=s.entries.filter(x=>x.id!==b.dataset.del);save();render()}
 if(b.dataset.todoDel){s.todos=s.todos.filter(x=>x.id!==b.dataset.todoDel);save();render()}
 if(b.dataset.date){$('day').value=b.dataset.date;render();document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab==='record'));['record','todo','stats'].forEach(k=>$(k+'Panel').classList.toggle('hidden',k!=='record'));$('recordPanel').scrollIntoView({behavior:'smooth',block:'start'})}
 if(b.id==='calPrev'||b.id==='calNext'){const parts=($('day').value||today()).split('-').map(Number),delta=b.id==='calNext'?1:-1,d=new Date(parts[0],parts[1]-1+delta,1,12);$('day').value=dateStr(d);render()}
 if(b.dataset.tab){document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['record','todo','stats'].forEach(k=>$(k+'Panel').classList.toggle('hidden',k!==b.dataset.tab))}
});
document.addEventListener('change',e=>{if(e.target.dataset.entryCheck){if(e.target.checked)selectedEntryIds.add(e.target.dataset.entryCheck);else selectedEntryIds.delete(e.target.dataset.entryCheck);const visible=[...document.querySelectorAll('[data-entry-check]')];$('selectAllEntries').checked=visible.length>0&&visible.every(x=>x.checked)}if(e.target.id==='selectAllEntries'){document.querySelectorAll('[data-entry-check]').forEach(x=>{x.checked=e.target.checked;if(e.target.checked)selectedEntryIds.add(x.dataset.entryCheck);else selectedEntryIds.delete(x.dataset.entryCheck)})}if(e.target.dataset.check){const t=s.todos.find(x=>x.id===e.target.dataset.check);if(t)t.done=e.target.checked;save();render()}if(e.target.id==='day')render()});
$('cancelEdit').onclick=resetEntryForm;
$('weekGoal').onchange=()=>{const v=Number($('weekGoal').value);if(!Number.isFinite(v)||v<1||v>168){alert('주간 목표는 1~168시간으로 설정해 주세요.');$('weekGoal').value=weekGoal;return}weekGoal=v;localStorage.setItem(WEEK_GOAL_KEY,String(v));render()};$('monthGoal').onchange=()=>{const v=Number($('monthGoal').value);if(!Number.isFinite(v)||v<1||v>744){alert('월간 목표는 1~744시간으로 설정해 주세요.');$('monthGoal').value=monthGoal;return}monthGoal=v;localStorage.setItem(MONTH_GOAL_KEY,String(v));render()};$('goalHours').onchange=()=>{const v=Number($('goalHours').value);if(!Number.isFinite(v)||v<0.5||v>24){alert('목표는 0.5~24시간으로 설정해 주세요.');$('goalHours').value=goal;return}goal=v;localStorage.setItem(GOAL_KEY,String(goal));render()};
function shift(n){const parts=($('day').value||today()).split('-').map(Number),d=new Date(parts[0],parts[1]-1,parts[2],12);d.setDate(d.getDate()+n);$('day').value=dateStr(d);render()}
$('prev').onclick=()=>shift(-1);$('next').onclick=()=>shift(1);$('today').onclick=()=>{$('day').value=today();render()};
let pendingImport=null;
const validDate=v=>typeof v==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00').getTime())&&dateStr(new Date(v+'T12:00:00'))===v;
const validTime=v=>typeof v==='string'&&/^([01]\\d|2[0-3]):[0-5]\\d$/.test(v);
$('downloadBackupNow').onclick=downloadBackup;
$('restorePreviousBackup').onclick=()=>{const raw=localStorage.getItem(AUTO_BACKUP_KEY);if(!raw){alert('이전 자동 저장본이 없습니다.');return}try{const data=JSON.parse(raw);if(!data||!Array.isArray(data.entries)||!Array.isArray(data.todos))throw Error('invalid');if(!confirm('현재 기록을 마지막 자동 저장본으로 복구할까요? 자동 저장 이후 변경 사항은 사라질 수 있습니다.'))return;s={entries:data.entries,todos:data.todos};localStorage.setItem(KEY,raw);resetEntryForm();render();updateAutoBackupStatus();alert('이전 자동 저장본을 복구했습니다.')}catch{alert('자동 저장본을 읽을 수 없습니다. 현재 데이터는 변경하지 않았습니다.')}};
$('importBtn').onclick=()=> $('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;pendingImport=null;try{const data=JSON.parse(await file.text());const validEntry=x=>x&&typeof x==='object'&&typeof x.id==='string'&&validDate(x.date)&&typeof x.name==='string'&&x.name.trim()&&validTime(x.start)&&validTime(x.end)&&min(x.end)>min(x.start)&&['actual','planned'].includes(x.kind)&&(!x.cat||typeof x.cat==='string')&&(!x.note||typeof x.note==='string');const validTodo=x=>x&&typeof x==='object'&&typeof x.id==='string'&&validDate(x.date)&&typeof x.text==='string'&&x.text.trim()&&typeof x.done==='boolean';if(!data||!Array.isArray(data.entries)||!Array.isArray(data.todos)||!data.entries.every(validEntry)||!data.todos.every(validTodo))throw Error('invalid');const ids=[...data.entries.map(x=>x.id),...data.todos.map(x=>x.id)];if(new Set(ids).size!==ids.length)throw Error('duplicate');pendingImport={entries:data.entries,todos:data.todos};const entryMinutes=data.entries.reduce((sum,x)=>sum+dur(x),0),actual=data.entries.filter(x=>x.kind==='actual').length,planned=data.entries.length-actual;$('importPreview').innerHTML='<b>백업 파일 검증 완료</b><p>시간 기록: '+data.entries.length+'개 (실제 '+actual+'개 · 계획 '+planned+'개)</p><p>총 기록 시간: '+fmt(entryMinutes)+'</p><p>할 일: '+data.todos.length+'개 (완료 '+data.todos.filter(x=>x.done).length+'개)</p><p class="muted">복원하면 현재 시간 기록과 할 일이 백업 내용으로 교체됩니다.</p><button type="button" id="confirmImport">이 백업으로 복원</button><button type="button" id="cancelImport">취소</button>'}catch(err){$('importPreview').innerHTML='<p class="import-error">백업 파일 형식이 올바르지 않거나 데이터에 오류가 있습니다. 현재 기록은 변경되지 않았습니다.</p>'}finally{e.target.value=''}};
document.addEventListener('click',e=>{if(e.target.id==='cancelImport'){pendingImport=null;$('importPreview').innerHTML='<p class="muted">복원을 취소했습니다. 현재 기록은 유지됩니다.</p>'}if(e.target.id==='confirmImport'){if(!pendingImport){alert('먼저 올바른 백업 파일을 선택해 주세요.');return}if(!confirm('현재 기록 '+s.entries.length+'개와 할 일 '+s.todos.length+'개를 백업 파일 내용으로 교체할까요?'))return;s={entries:pendingImport.entries,todos:pendingImport.todos};pendingImport=null;save();resetEntryForm();render();$('importPreview').innerHTML='<p>백업 복원을 완료했습니다.</p>';alert('백업을 복원했습니다.')}});

$('csvExport').onclick=()=>{const start=$('csvStart').value,end=$('csvEnd').value;if(start&&end&&end<start){alert('CSV 시작일은 종료일보다 늦을 수 없습니다.');return}const inRange=x=>(!start||x>=start)&&(!end||x<=end),entries=s.entries.filter(x=>inRange(x.date)),todos=s.todos.filter(x=>inRange(x.date)),quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=[['날짜','활동','시작','종료','시간(분)','종류','분류','메모'],...entries.map(x=>[x.date,x.name,x.start,x.end,dur(x),x.kind==='planned'?'계획':'실제',x.cat||'',x.note||'']),[],['할 일 날짜','할 일','완료'],...todos.map(x=>[x.date,x.text,x.done?'완료':'미완료'])];const csv='\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');const a=document.createElement('a'),u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=u;a.download='time-tracker-'+(start||'start')+'-'+(end||'end')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};$('clearCsvRange').onclick=()=>{$('csvStart').value='';$('csvEnd').value=''};
$('export').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}));a.href=u;a.download='time-tracker-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
render();
})();