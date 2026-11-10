const state = { questions: [], reports: [], results: [], taxonomy: {}, selectedQuestion: null, selectedReport: null, statuses: {}, overrides: {}, audit: [] };
const $ = (id) => document.getElementById(id);
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty = (s='') => String(s).replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
const questionInner = q => q?.[q.questionType] || q?.scq || q?.mcq || q?.integerQuestion || {};
function safeMarkup(markup='') {
  const template=document.createElement('template'); template.innerHTML=String(markup);
  template.content.querySelectorAll('script,iframe,object,embed,form,style,link,meta').forEach(n=>n.remove());
  template.content.querySelectorAll('*').forEach(el=>{
    [...el.attributes].forEach(a=>{
      if(/^on/i.test(a.name) || ((a.name==='href'||a.name==='src') && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
    });
  });
  return template.innerHTML;
}
function showToast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2400);}
function getResult(id){return state.results.find(r=>r.reportId===id);}
function getQuestion(id){return state.questions.find(q=>q._id===id);}
function reportGroup(qid){return state.reports.filter(r=>r.questionId===qid);}
function routeClass(route){return route==='auto_apply'?'auto':route==='faculty_review'?'review':'none';}
function routeLabel(route){return route==='auto_apply'?'AUTO-FIX':route==='faculty_review'?'FACULTY REVIEW':'NO CHANGE';}
function priority(qid){
  const rs=reportGroup(qid), results=rs.map(r=>getResult(r.reportId));
  if(results.some(x=>x?.repair==='answer_key'||x?.repair==='unsound')) return 0;
  if(results.some(x=>['stem_data','option_repair','type_mismatch','solution_fix'].includes(x?.repair))) return 1;
  if(results.some(x=>x?.route==='faculty_review')) return 2;
  return 3;
}
function statusText(id){return state.statuses[id] || 'Pending';}
function initFilters(){
  const vals=[...new Set(state.results.map(r=>r.verdict))].sort();
  $('verdict-filter').innerHTML='<option value="">All verdicts</option>'+vals.map(v=>`<option value="${v}">${pretty(v)}</option>`).join('');
}
function renderStats(){
  const count=state.reports.length;
  const pending=state.results.filter(r=>r.route==='faculty_review' && !state.statuses[r.reportId]).length;
  const auto=state.results.filter(r=>r.route==='auto_apply').length;
  const nochange=state.results.filter(r=>r.route==='no_change').length;
  $('stat-reports').textContent=count;
  $('stat-review').textContent=pending;
  $('stat-auto').textContent=auto;
  $('stat-nochange').textContent=nochange;
  $('nav-pending').textContent=pending;
  $('dataset-count').textContent=`${state.questions.length} questions · ${count} reports`;
}
function renderQueue(){
  const search=$('search-input').value.trim().toLowerCase();
  const vf=$('verdict-filter').value, rf=$('route-filter').value;
  let groups=[...new Set(state.reports.map(r=>r.questionId))].map(qid=>{
    const q=getQuestion(qid), rs=reportGroup(qid);
    const matches=rs.filter(r=>{
      const x=getResult(r.reportId), inner=questionInner(q||{});
      const hay=[r.reportId,r.comment,qid,q?.subject,q?.chapter,inner.question].join(' ').toLowerCase();
      return (!search||hay.includes(search))&&(!vf||x.verdict===vf)&&(!rf||x.route===rf);
    });
    return {qid,q,rs,matches};
  }).filter(g=>g.matches.length);
  groups.sort((a,b)=>priority(a.qid)-priority(b.qid)||b.rs.length-a.rs.length||String(a.qid).localeCompare(String(b.qid)));
  $('visible-count').textContent=`${groups.reduce((n,g)=>n+g.matches.length,0)} reports · ${groups.length} questions`;
  $('queue-list').innerHTML=groups.length?groups.map(g=>{
    const r=g.matches[0], x=getResult(r.reportId), q=g.q;
    const p=priority(g.qid), pLabel=p===0?'HIGH PRIORITY':p===1?'MEDIUM PRIORITY':'STANDARD';
    return `<div class="queue-item ${state.selectedQuestion===g.qid?'selected':''}" data-qid="${escapeHtml(g.qid)}">
      <div class="queue-item-top"><span class="qid">${escapeHtml(g.qid.slice(0,10))}…</span><span class="priority ${p<2?'high':p===2?'medium':'low'}">${pLabel}</span></div>
      <div class="queue-question">${escapeHtml(r.comment||'No comment')}</div>
      <div class="queue-meta"><span class="subject-tag">${escapeHtml(q?.subject||'Unknown subject')}</span><span>${escapeHtml(q?.chapter||'')}</span><span class="report-badge">${g.rs.length} ${g.rs.length===1?'report':'reports'}</span></div>
      <div style="margin-top:7px;display:flex;justify-content:space-between;align-items:center"><span class="status-tag ${routeClass(x.route)}">${routeLabel(x.route)}</span><span style="font-size:8px;color:#9aa3b1">${escapeHtml(r.reportId)}</span></div>
    </div>`;
  }).join(''):'<div class="no-results">No reports match these filters.</div>';
  document.querySelectorAll('.queue-item').forEach(el=>el.addEventListener('click',()=>selectQuestion(el.dataset.qid)));
}
function selectQuestion(qid, reportId=null){
  state.selectedQuestion=qid;
  const rs=reportGroup(qid);
  state.selectedReport=reportId&&rs.some(r=>r.reportId===reportId)?reportId:rs[0]?.reportId;
  renderQueue();renderDetail();
}
function renderDetail(){
  const q=getQuestion(state.selectedQuestion), rs=reportGroup(state.selectedQuestion);
  if(!q||!rs.length){$('detail-panel').innerHTML='<div class="empty-detail"><div class="empty-illustration">◎</div><h3>Select a question to review</h3><p>Choose a group from the queue to inspect the original content, AI assessment and proposed repair.</p></div>';return;}
  const r=rs.find(x=>x.reportId===state.selectedReport)||rs[0], x=getResult(r.reportId), inner=questionInner(q);
  const applied=state.overrides[q._id]||{};
  const current={...inner,...applied};
  const options=current.question||'Question content unavailable';
  const solution=current.solution||'No solution supplied';
  const hasEdit=x.edit&&x.edit.field;
  let before='',after='';
  if(hasEdit){
    const raw=String(inner[x.edit.field]??(x.edit.field==='answer'?inner.answer:''));
    before=raw;
    after=applied[x.edit.field]!==undefined?String(applied[x.edit.field]):(x.edit.replace!==undefined?raw.replace(x.edit.find??'',x.edit.replace):String(x.edit.answer??raw));
  }
  const isDone=!!state.statuses[r.reportId];
  const reportRows=rs.map(rep=>`<div class="report-row ${rep.reportId===r.reportId?'active':''}" data-rid="${escapeHtml(rep.reportId)}"><span class="report-id">${escapeHtml(rep.reportId)}</span><span class="report-comment">${escapeHtml(rep.comment)}</span><span class="report-time">${new Date(rep.reportedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})} · ${escapeHtml(rep.source)}</span></div>`).join('');
  $('detail-panel').innerHTML=`
    <div class="detail-head"><div><h2>${escapeHtml(q.subject)} <span style="color:#a0a8b5;font-weight:400">/</span> ${escapeHtml(q.chapter)}</h2><div class="detail-sub">Question ${escapeHtml(q._id)} · ${escapeHtml(q.questionType)} · ${escapeHtml(q.level||'')}</div></div>
      <div class="detail-tags"><span class="tag ${x.verdict==='defect'?'defect':''}">${pretty(x.verdict)}</span><span class="tag ${x.route==='faculty_review'?'review':''}">${routeLabel(x.route)}</span></div></div>
    <div class="detail-body">
      <div class="section-label">ORIGINAL QUESTION · ${escapeHtml(q._id)}</div>
      <div class="question-card"><h4>Question stem & options</h4><div class="question-content">${safeMarkup(options)}</div><div class="answer-strip"><span>STORED ANSWER</span><b>${escapeHtml(Array.isArray(current.answer)?current.answer.join(', '):String(current.answer??'Not supplied'))}</b></div><div class="solution-box"><button class="solution-toggle" id="solution-toggle">＋ Show worked solution</button><div id="solution-content" class="solution-content" hidden>${safeMarkup(solution)}</div></div></div>
      <div class="section-label">STUDENT REPORTS · ${rs.length} ${rs.length===1?'REPORT':'REPORTS'} FOR THIS QUESTION</div>
      <div class="report-stack">${reportRows}</div>
      <div class="section-label">AI TRIAGE ASSESSMENT · ${escapeHtml(r.reportId)}</div>
      <div class="analysis-card"><div class="analysis-top"><span class="analysis-verdict">${pretty(x.verdict)}${x.repair?' · '+pretty(x.repair):''}</span><span class="confidence">Confidence <b>${Math.round(x.confidence*100)}%</b></span></div><div class="analysis-evidence">${escapeHtml(x.evidence)}</div><div class="analysis-repair">Recommended route: <b>${routeLabel(x.route)}</b>${x.repair?' · Taxonomy repair: '+pretty(x.repair):''}</div></div>
      ${hasEdit?`<div class="section-label">PROPOSED SURGICAL CHANGE · ${escapeHtml(x.edit.field)}</div><div class="diff-grid"><div class="diff-box"><div class="diff-head">BEFORE</div><div class="diff-content before">${escapeHtml(before)}</div></div><div class="diff-box"><div class="diff-head">AFTER</div><div class="diff-content after">${escapeHtml(after)}</div></div></div>`:`<div class="section-label">REPAIR PREVIEW</div><div class="diff-box" style="margin-bottom:13px"><div class="diff-content">${x.route==='faculty_review'?'No automatic edit proposed. This case requires faculty judgment.':'No content edit proposed for this report.'}</div></div>`}
      <div class="reply-box"><div class="reply-label">STUDENT REPLY PREVIEW</div><div class="reply-text">${escapeHtml(x.student_reply)}</div></div>
      <div class="faculty-actions">
        <button class="button approve" id="approve-action" ${isDone?'disabled':''}>✓ ${hasEdit?'Approve repair':'Mark reviewed'}</button>
        <button class="button secondary" id="edit-action" ${isDone||!hasEdit?'disabled':''}>✎ Edit & approve</button>
        <button class="button secondary" id="note-action" ${isDone?'disabled':''}>Add faculty note</button>
        <button class="button reject" id="reject-action" ${isDone?'disabled':''}>Reject recommendation</button>
        <span class="action-status">${isDone?`✓ ${escapeHtml(state.statuses[r.reportId])}`:'Awaiting faculty action'}</span>
        <div class="edit-tools" id="edit-tools"><label for="edit-value">Replacement value</label><input id="edit-value" value="${hasEdit?escapeHtml(x.edit.replace??''):''}" /><button class="button approve small" id="save-edit">Save edited repair</button></div>
        <textarea class="action-note" id="faculty-note" placeholder="Add a short note for the audit trail…"></textarea>
      </div>
    </div>`;
  document.querySelectorAll('.report-row').forEach(el=>el.addEventListener('click',()=>selectQuestion(q._id,el.dataset.rid)));
  $('solution-toggle').addEventListener('click',()=>{const el=$('solution-content');el.hidden=!el.hidden;$('solution-toggle').textContent=el.hidden?'＋ Show worked solution':'− Hide worked solution';});
  $('approve-action').addEventListener('click',()=>recordAction(r,'Approved',x));
  $('reject-action').addEventListener('click',()=>recordAction(r,'Rejected',x));
  $('edit-action').addEventListener('click',()=>{$('edit-tools').classList.toggle('show');$('edit-value').focus();});
  $('save-edit').addEventListener('click',()=>recordAction(r,'Edited & approved',x,$('edit-value').value));
  $('note-action').addEventListener('click',()=>{$('faculty-note').classList.toggle('show');$('faculty-note').focus();});
}
function recordAction(report, action, x, editedReplacement=null){
  const note=$('faculty-note')?.value.trim()||'';
  if(action==='Approved' && x.route==='faculty_review' && x.repair && !state.taxonomy.repairs[x.repair]?.auto && !note){
    showToast('This repair is faculty-only. Add a note documenting your decision.');$('faculty-note').classList.add('show');return;
  }
  if((action==='Approved'||action==='Edited & approved') && x.edit && x.repair){
    const spec=state.taxonomy.repairs[x.repair];
    if(!spec || !spec.fields.includes(x.edit.field)){showToast('Blocked: proposed edit is outside the taxonomy field scope.');return;}
    if(x.route==='auto_apply' && !spec.auto){showToast('Blocked: taxonomy does not permit auto-apply.');return;}
    const q=getQuestion(report.questionId), inner=questionInner(q), current=state.overrides[q._id]?.[x.edit.field] ?? inner[x.edit.field];
    if(typeof current!=='string' || !String(current).includes(x.edit.find??'')){showToast('Blocked: exact source text no longer matches; refresh and review.');return;}
    const replacement=editedReplacement===null?(x.edit.replace??''):editedReplacement;
    const next=String(current).replace(x.edit.find,replacement);
    state.overrides[q._id]={...(state.overrides[q._id]||{}),[x.edit.field]:next};
  }
  const entry={reportId:report.reportId,questionId:report.questionId,action,at:new Date().toISOString(),note,verdict:x.verdict,repair:x.repair||null};
  state.audit.unshift(entry);state.statuses[report.reportId]=action;
  saveState();renderStats();renderDetail();renderAudit();showToast(`${action} recorded for ${report.reportId}.`);
}
function saveState(){try{localStorage.setItem('acadza-audit',JSON.stringify(state.audit));localStorage.setItem('acadza-statuses',JSON.stringify(state.statuses));localStorage.setItem('acadza-overrides',JSON.stringify(state.overrides));}catch(e){showToast('Could not save locally. Export the audit log.');}}
function renderAudit(){
  const rows=state.audit;
  $('audit-count').textContent=`${rows.length} entries`;
  $('audit-list').innerHTML=rows.length?rows.map(a=>`<div class="audit-row"><span class="audit-time">${new Date(a.at).toLocaleString()}</span><span class="audit-action">${escapeHtml(a.action)} · ${escapeHtml(a.reportId)}</span><span class="audit-target">${escapeHtml(a.questionId.slice(0,12))}…</span><span class="audit-note">${escapeHtml(a.note||a.repair||'No note')}</span></div>`).join(''):'<div class="no-results">No faculty actions recorded yet. Actions from the review queue will appear here.</div>';
}
function renderOverview(){
  const counts={};state.results.forEach(r=>counts[r.verdict]=(counts[r.verdict]||0)+1);
  const max=Math.max(...Object.values(counts),1);
  $('verdict-bars').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar-row"><span>${pretty(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><span class="bar-value">${v}</span></div>`).join('');
  const routes={'Auto-fix':state.results.filter(r=>r.route==='auto_apply').length,'Faculty review':state.results.filter(r=>r.route==='faculty_review').length,'No change':state.results.filter(r=>r.route==='no_change').length};
  const total=state.results.length||1, colors=['#218b65','#d49a39','#8b97aa'];let start=0,stops=[];
  Object.values(routes).forEach((v,i)=>{const end=start+v/total*100;stops.push(`${colors[i]} ${start}% ${end}%`);start=end;});
  $('route-donut').innerHTML=`<div class="donut" style="background:conic-gradient(${stops.join(',')})"><div class="donut-center"><strong>${total}</strong><span>REPORTS</span></div></div><div class="legend">${Object.entries(routes).map(([k,v],i)=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span>${k} <b>${v}</b></div>`).join('')}</div>`;
  const qcounts=state.reports.reduce((a,r)=>(a[r.questionId]=(a[r.questionId]||0)+1,a),{});
  $('top-questions').innerHTML=Object.entries(qcounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,n],i)=>`<div class="top-row"><span class="top-rank">${i+1}</span><span class="top-name">${escapeHtml(getQuestion(id)?.chapter||id.slice(0,12))}</span><span class="top-count">${n} reports</span></div>`).join('');
  const subjects={};state.reports.forEach(r=>{const s=getQuestion(r.questionId)?.subject||'Unknown';subjects[s]=(subjects[s]||0)+1;});
  const m=Math.max(...Object.values(subjects),1);
  $('subject-bars').innerHTML=Object.entries(subjects).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar-row"><span>${escapeHtml(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/m*100}%"></div></div><span class="bar-value">${v}</span></div>`).join('');
}
function switchView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
  $(`${view}-view`).classList.add('active-view');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
  $('crumb-current').textContent=pretty(view==='queue'?'Review queue':view);
  if(view==='overview')renderOverview();if(view==='audit')renderAudit();
}
function download(name, content, type='application/json'){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
async function boot(){
  const [questions,reports,taxonomy,results]=await Promise.all([
    fetch('data/questions.json').then(r=>{if(!r.ok)throw Error('questions.json');return r.json()}),
    fetch('data/reports.json').then(r=>{if(!r.ok)throw Error('reports.json');return r.json()}),
    fetch('data/taxonomy.json').then(r=>{if(!r.ok)throw Error('taxonomy.json');return r.json()}),
    fetch('results.json').then(r=>{if(!r.ok)throw Error('results.json');return r.json()})
  ]);
  state.questions=questions;state.reports=reports;state.taxonomy=taxonomy;state.results=results;
  try{state.audit=JSON.parse(localStorage.getItem('acadza-audit')||'[]');state.statuses=JSON.parse(localStorage.getItem('acadza-statuses')||'{}');state.overrides=JSON.parse(localStorage.getItem('acadza-overrides')||'{}');}catch(e){}
  initFilters();renderStats();renderQueue();renderAudit();renderOverview();
  const first=state.reports.find(r=>getResult(r.reportId)?.route==='faculty_review')||state.reports[0];
  if(first)selectQuestion(first.questionId,first.reportId);
}
document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>switchView(n.dataset.view)));
['search-input','verdict-filter','route-filter'].forEach(id=>$(id).addEventListener(id==='search-input'?'input':'change',renderQueue));
$('export-results').addEventListener('click',()=>download('results.json',JSON.stringify(state.results,null,2)));
function exportAudit(){download('ac adza-audit-log.json'.replace(' ',''),JSON.stringify(state.audit,null,2));}
$('export-audit').addEventListener('click',exportAudit);$('audit-download-2').addEventListener('click',exportAudit);
$('help-button').addEventListener('click',()=>$('modal').classList.remove('hidden'));
$('modal-close').addEventListener('click',()=>$('modal').classList.add('hidden'));
$('modal-ok').addEventListener('click',()=>$('modal').classList.add('hidden'));
boot().catch(err=>{$('queue-list').innerHTML=`<div class="no-results">Could not load project data: ${escapeHtml(err.message)}. Start the local server from the project directory.</div>`;console.error(err);});
