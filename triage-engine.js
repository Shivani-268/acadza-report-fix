#!/usr/bin/env node
/**
 * Offline triage result validator / exporter.
 * This submission intentionally loads curated results rather than calling a live LLM.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write = (name,data) => fs.writeFileSync(path.join(root,name),JSON.stringify(data,null,2)+'\n');
function validate(results, reports, questions, taxonomy){
  const errors=[];
  const reportMap=new Map(reports.map(r=>[r.reportId,r]));
  const questionMap=new Map(questions.map(q=>[q._id,q]));
  const seen=new Set();
  if(results.length!==reports.length) errors.push(`Expected ${reports.length} results; received ${results.length}`);
  for(const item of results){
    if(seen.has(item.reportId)) errors.push(`Duplicate reportId: ${item.reportId}`);
    seen.add(item.reportId);
    const report=reportMap.get(item.reportId);
    if(!report) {errors.push(`Unknown reportId: ${item.reportId}`);continue;}
    if(item.questionId!==report.questionId) errors.push(`${item.reportId}: questionId mismatch`);
    const question=questionMap.get(item.questionId);
    if(!question) errors.push(`${item.reportId}: question record missing`);
    if(!Object.hasOwn(taxonomy.verdicts,item.verdict)) errors.push(`${item.reportId}: invalid verdict ${item.verdict}`);
    if(!['auto_apply','faculty_review','no_change'].includes(item.route)) errors.push(`${item.reportId}: invalid route`);
    if(!(item.confidence>=0&&item.confidence<=1)) errors.push(`${item.reportId}: invalid confidence`);
    if(item.repair){
      const spec=taxonomy.repairs[item.repair];
      if(!spec) errors.push(`${item.reportId}: invalid repair ${item.repair}`);
      else {
        if(item.edit && !spec.fields.includes(item.edit.field)) errors.push(`${item.reportId}: field ${item.edit.field} outside ${item.repair} scope`);
        if(item.route==='auto_apply'&&!spec.auto) errors.push(`${item.reportId}: auto:false repair cannot auto-apply`);
      }
    } else if(item.verdict==='defect') errors.push(`${item.reportId}: defect has no repair category`);
    if(item.verdict!=='defect'&&item.repair!==null) errors.push(`${item.reportId}: non-defect must not carry repair`);
    if(item.route==='auto_apply'&&!item.edit) errors.push(`${item.reportId}: auto_apply requires an exact edit`);
    if(item.edit&&question){
      const target=question[question.questionType]?.[item.edit.field];
      if(target===undefined) errors.push(`${item.reportId}: edit target does not exist`);
      else if(item.edit.find!==undefined&&!String(target).includes(item.edit.find)) errors.push(`${item.reportId}: exact find text not present in source field`);
    }
    if(typeof item.evidence!=='string'||item.evidence.length<20) errors.push(`${item.reportId}: evidence missing`);
    if(typeof item.student_reply!=='string'||item.student_reply.length<10) errors.push(`${item.reportId}: student reply missing`);
  }
  for(const r of reports) if(!seen.has(r.reportId)) errors.push(`Missing result for ${r.reportId}`);
  return errors;
}
function run(){
  const questions=read('data/questions.json'), reports=read('data/reports.json'), taxonomy=read('data/taxonomy.json'), results=read('results.json');
  const errors=validate(results,reports,questions,taxonomy);
  if(errors.length){console.error(errors.join('\n'));process.exitCode=1;return;}
  write('results.json',results);
  console.log(`Validated and exported ${results.length} precomputed triage decisions.`);
  console.log('No live LLM provider was invoked.');
}
if(require.main===module) run();
module.exports={validate};
