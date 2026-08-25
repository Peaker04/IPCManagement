import fs from 'node:fs';

const requiredFiles = [
  '.agents/skills/frontend-checklist-global/SKILL.md',
  '.agents/skills/frontend-checklist-global/references/categories.md',
  '.pi/skills/frontend-checklist-global/SKILL.md',
  '.pi/skills/frontend-checklist-global/references/categories.md',
  'docs/FRONT-END-CHECKLIST-INTEGRATION.md',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

if (failures.length === 0) {
  const agentSkill = fs.readFileSync(requiredFiles[0], 'utf8');
  const piSkill = fs.readFileSync(requiredFiles[2], 'utf8');
  const integration = fs.readFileSync(requiredFiles[4], 'utf8');

  if (agentSkill !== piSkill) failures.push('Pi and project skill copies differ');
  if (!agentSkill.includes('name: frontend-checklist-global')) failures.push('skill identity drifted');
  if (!agentSkill.includes('385 Front-End Checklist rules')) failures.push('skill corpus contract drifted');
  if (!integration.includes('DASHBOARD-UI-RULES.md')) failures.push('project rule precedence is missing');
  if (!integration.includes('NEEDS_EVIDENCE')) failures.push('evidence verdict contract is missing');
  if (!integration.includes('30756a79b2f7d4363ac592710146c8e28fa9f1b5')) failures.push('reviewed upstream revision is missing');
}

if (failures.length > 0) {
  console.error(`Front-End Checklist integration failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Front-End Checklist integration: installed skill copies, precedence, evidence contract, and reviewed revision are consistent.');
