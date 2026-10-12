(()=>{'use strict';
const $=id=>document.getElementById(id),KEY='time-tracker-v1',GOAL_KEY='time-tracker-daily-goal';
let editId=null,s,goal=Number(localStorage.getItem(GOAL_KEY))||8;
try{s=JSON.parse(localStorage.getItem(KEY))||{entries:[],todos:[]}}catch{s={entries:[],todos:[]}}
if(!s||!Array.isArray(s.entries)||!Array.isArray(s.todos))s={entries:[],todos:[]};
const save=()=>localStorage.setItem(KEY,JSON.stringify(s));
const dateStr=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>dateStr(new Date());
$('day').value=today();$('goalHours').value=goal;
const min=t=>{let [h,m]=String(t||'0:0').split(':').map(Number);return h*60+m};
const dur=e=>Math.max(0,min(e.end)-min(e.start));
const fmt=n=>Math.floor(n/60)?Math.floor(n/60)+'시간 '+n%60+'분':n+'분';
const esc=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
 const date=$('day').value,es=s.entries.filter(e=>e.date===date).sort((a,b)=>a.start.localeCompare(b.start));
 const p=es.filter(e=>e.kind==='planned').reduce((n,e)=>n+dur(e),0),a=es.filter(e=>e.kind==='actual').reduce((n,e)=>n+dur(e),0);
 $('planned').textContent=fmt(p);$('actual').textContent=fmt(a);$('count').textContent=es.length;
 $('entries').innerHTML=es.length?es.map(e=>'<div class="entry"><div class="entrymain"><b>'+esc(e.name)+'</b><div class="meta">'+e.start+'–'+e.end+' · '+(e.kind==='planned'?'계획':'실제')+' · '+esc(e.cat||'미분류')+(e.note?' · '+esc(e.note):'')+'</div></div><b class="duration">'+fmt(dur(e))+'</b><button data-edit="'+esc(e.id)+'">수정</button><button class="delete" data-del="'+esc(e.id)+'">삭제</button></div>').join(''):'<p class="muted">기록이 없습니다. 첫 시간을 추가해 보세요.</p>';
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
 const month=date.slice(0,7),me=s.entries.filter(x=>x.date.startsWith(month)&&x.kind==='actual'),monthTotal=me.reduce((sum,x)=>sum+dur(x),0),days=new Set(me.map(x=>x.date)).size;
 $('monthStats').innerHTML='<div class="periodtotal">월간 실제 기록 <b>'+fmt(monthTotal)+'</b></div><div class="periodrow"><span>실제 기록한 날짜</span><b>'+days+'일</b></div><div class="periodrow"><span>기록일 평균</span><b>'+fmt(days?Math.round(monthTotal/days):0)+'</b></div>';
}
function resetEntryForm(){editId=null;$('entryForm').reset();$('start').value='09:00';$('end').value='10:00';$('saveEntry').textContent='기록 저장';$('cancelEdit').hidden=true}
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
 if(b.dataset.edit){const x=s.entries.find(x=>x.id===b.dataset.edit);if(x){editId=x.id;$('day').value=x.date;$('name').value=x.name;$('start').value=x.start;$('end').value=x.end;$('kind').value=x.kind;$('cat').value=x.cat||'';$('note').value=x.note||'';$('saveEntry').textContent='수정 저장';$('cancelEdit').hidden=false;$('entryForm').scrollIntoView({behavior:'smooth',block:'start'})}}
 if(b.dataset.del){if(editId===b.dataset.del)resetEntryForm();s.entries=s.entries.filter(x=>x.id!==b.dataset.del);save();render()}
 if(b.dataset.todoDel){s.todos=s.todos.filter(x=>x.id!==b.dataset.todoDel);save();render()}
 if(b.dataset.tab){document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['record','todo','stats'].forEach(k=>$(k+'Panel').classList.toggle('hidden',k!==b.dataset.tab))}
});
document.addEventListener('change',e=>{if(e.target.dataset.check){const t=s.todos.find(x=>x.id===e.target.dataset.check);if(t)t.done=e.target.checked;save();render()}if(e.target.id==='day')render()});
$('cancelEdit').onclick=resetEntryForm;
$('goalHours').onchange=()=>{const v=Number($('goalHours').value);if(!Number.isFinite(v)||v<0.5||v>24){alert('목표는 0.5~24시간으로 설정해 주세요.');$('goalHours').value=goal;return}goal=v;localStorage.setItem(GOAL_KEY,String(goal));render()};
function shift(n){const parts=($('day').value||today()).split('-').map(Number),d=new Date(parts[0],parts[1]-1,parts[2],12);d.setDate(d.getDate()+n);$('day').value=dateStr(d);render()}
$('prev').onclick=()=>shift(-1);$('next').onclick=()=>shift(1);$('today').onclick=()=>{$('day').value=today();render()};
$('importBtn').onclick=()=> $('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||!Array.isArray(data.entries)||!Array.isArray(data.todos)||!data.entries.every(x=>x&&x.id&&x.date&&x.start&&x.end&&x.name)||!data.todos.every(x=>x&&x.id&&x.date&&typeof x.text==='string'))throw Error('invalid');if(!confirm('현재 기록을 백업 파일의 내용으로 교체할까요? 현재 데이터는 덮어써집니다.'))return;s={entries:data.entries,todos:data.todos};save();resetEntryForm();render();alert('백업을 복원했습니다.')}catch(err){alert('백업 파일을 읽을 수 없습니다. 시간 기록 앱에서 내보낸 JSON 파일인지 확인해 주세요.')}finally{e.target.value=''}};
$('csvExport').onclick=()=>{const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=[['날짜','활동','시작','종료','시간(분)','종류','분류','메모'],...s.entries.map(x=>[x.date,x.name,x.start,x.end,dur(x),x.kind==='planned'?'계획':'실제',x.cat||'',x.note||'']),[],['할 일 날짜','할 일','완료'],...s.todos.map(x=>[x.date,x.text,x.done?'완료':'미완료'])];const csv='\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');const a=document.createElement('a'),u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=u;a.download='time-tracker-'+today()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
$('export').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}));a.href=u;a.download='time-tracker-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
render();
})();