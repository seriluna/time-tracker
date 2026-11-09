(()=>{'use strict';
const KEY='time-tracker-daily-design-v1';
const $=id=>document.getElementById(id);
const fields={
 morning:[['identity','오늘 나는 어떤 사람이 되고 싶은가?','예: 평온하고 집중력 있는 실행가'],['priority','오늘 반드시 완성할 가장 중요한 결과물은?','오늘의 핵심 결과물 하나'],['health','건강을 위해 오늘 할 행동은?','예: 근력 운동 40분'],['relationship','관계와 사랑을 위해 할 행동은?','예: 가족과 휴대폰 없이 식사하기'],['joy','오늘 꼭 즐기고 싶은 순간은?','예: 좋아하는 카페에서 책 읽기']],
 evening:[['bestChoice','오늘 가장 잘한 선택은?','스스로 칭찬하고 싶은 행동'],['learning','오늘 새롭게 배운 것은?','오늘의 배움과 깨달음'],['improvement','내일 바꾸고 싶은 행동은?','내일 실천할 작은 변화']]
};
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(new Date(v+'T12:00:00').getTime());
const validRecord=r=>r&&typeof r==='object'&&!Array.isArray(r)&&['morning','evening'].every(group=>r[group]===undefined||(r[group]&&typeof r[group]==='object'&&!Array.isArray(r[group])&&Object.entries(r[group]).every(([k,v])=>[...fields.morning,...fields.evening].some(f=>f[0]===k)&&typeof v==='string')))&& (r.evening?.satisfaction===undefined||r.evening.satisfaction===null||[1,2,3,4,5].includes(r.evening.satisfaction));
const validData=d=>d&&typeof d==='object'&&!Array.isArray(d)&&Object.entries(d).every(([date,record])=>validDate(date)&&validRecord(record));
let data={},corrupt=false,rawOriginal=null;
try{const raw=localStorage.getItem(KEY);if(raw!==null){const parsed=JSON.parse(raw);if(!validData(parsed))throw Error('invalid');data=parsed}}catch{corrupt=true;rawOriginal=localStorage.getItem(KEY)}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const date=()=> $('day')?.value||today();
const snapshot=()=>JSON.parse(JSON.stringify(data));
window.getDailyDesignData=snapshot;
window.validateDailyDesignData=validData;
function refreshBackup(){
 try{
  const main=JSON.parse(localStorage.getItem('time-tracker-v1')||'{"entries":[],"todos":[]}');
  if(!main||!Array.isArray(main.entries)||!Array.isArray(main.todos))return false;
  localStorage.setItem('time-tracker-auto-backup-v1',JSON.stringify({...main,dailyDesign:snapshot()}));
  localStorage.setItem('time-tracker-auto-backup-time',new Date().toISOString());
  const status=$('lifeDesignStatus');if(status)status.textContent='자동 저장 및 백업 완료';
  return true;
 }catch{return false}
}
window.setDailyDesignData=next=>{
 if(!validData(next))return false;
 try{const raw=JSON.stringify(next);localStorage.setItem(KEY,raw);data=JSON.parse(raw);corrupt=false;render();refreshBackup();return true}catch{return false}
};
function getCurrent(){return data[date()]||{morning:{},evening:{}}}
function fieldHtml(group,[key,label,placeholder]){
 const value=getCurrent()[group]?.[key]||'';
 return '<label class="life-design-field" for="ld-'+group+'-'+key+'"><span>'+label+'</span><textarea id="ld-'+group+'-'+key+'" data-design-group="'+group+'" data-design-field="'+key+'" rows="2" maxlength="500" placeholder="'+escape(placeholder)+'">'+escape(value)+'</textarea></label>';
}
function render(){
 const host=$('lifeByDesign');if(!host)return;
 const current=getCurrent(),morning=current.morning||{},evening=current.evening||{};
 host.innerHTML='<div class="life-design-heading"><div><p class="life-design-eyebrow">LIFE BY DESIGN</p><h2>오늘의 방향과 회고</h2><p>중요한 것에 시간을 쓰고, 하루의 경험에서 배웁니다.</p></div><span class="life-design-date">'+escape(date())+'</span></div>'+
 '<div class="life-design-grid"><section class="life-design-card morning"><div class="life-design-card-head"><span class="life-design-symbol" aria-hidden="true">☀</span><div><h3>아침 계획</h3><p>오늘 어떤 하루를 만들고 싶은가?</p></div><span class="life-design-state">'+(Object.values(morning).some(Boolean)?'작성 중':'시작하기')+'</span></div>'+
 fields.morning.map(f=>fieldHtml('morning',f)).join('')+
 '<p class="life-design-hint">생각이 정리되는 대로 입력하세요. 자동으로 저장됩니다.</p></section>'+
 '<section class="life-design-card evening"><div class="life-design-card-head"><span class="life-design-symbol" aria-hidden="true">☾</span><div><h3>저녁 회고</h3><p>평가보다 관찰, 자책보다 배움.</p></div><span class="life-design-state">'+(Object.values(evening).some(Boolean)?'작성 중':'시작하기')+'</span></div>'+
 fields.evening.map(f=>fieldHtml('evening',f)).join('')+
 '<label class="life-design-field" for="ld-satisfaction"><span>오늘 하루의 만족도 (선택)</span><select id="ld-satisfaction" data-design-group="evening" data-design-field="satisfaction"><option value="">선택하지 않음</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(Number(evening.satisfaction)===n?'selected':'')+'>'+n+' / 5</option>').join('')+'</select></label>'+
 '<p class="life-design-hint">완벽한 하루보다 나에게 의미 있었던 하루를 기록하세요.</p></section></div>'+
 '<p id="lifeDesignStatus" class="life-design-status" role="status" aria-live="polite">'+(corrupt?'기존 회고 데이터 오류: 원본을 보호하기 위해 읽기 전용 상태입니다.':'이 기기에 자동 저장됩니다.')+'</p>';
 if(corrupt)host.querySelectorAll('textarea,select').forEach(el=>el.disabled=true);
}
function saveField(el){
 if(corrupt)return;
 const group=el.dataset.designGroup,key=el.dataset.designField,value=key==='satisfaction'?(el.value===''?null:Number(el.value)):el.value;
 const next=snapshot(),day=next[date()]||{morning:{},evening:{}};
 day[group]=day[group]||{};
 if(value===null||value==='')delete day[group][key];else day[group][key]=value;
 if(!Object.keys(day.morning).length&&!Object.keys(day.evening).length)delete next[date()];else next[date()]=day;
 try{
  localStorage.setItem(KEY,JSON.stringify(next));data=next;
  const status=$('lifeDesignStatus');if(status)status.textContent='저장됨 · '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  refreshBackup();
 }catch{const status=$('lifeDesignStatus');if(status)status.textContent='저장 실패 · 입력 내용은 화면에 남아 있습니다. 저장 공간을 확인해 주세요.'}
}
document.addEventListener('input',e=>{if(e.target.matches('[data-design-field]')&&e.target.tagName==='TEXTAREA')saveField(e.target)});
document.addEventListener('change',e=>{if(e.target.matches('[data-design-field]')&&e.target.tagName!=='TEXTAREA')saveField(e.target);if(e.target.id==='day')render()});
render();
})();