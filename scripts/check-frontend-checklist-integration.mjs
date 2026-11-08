import fs from 'node:fs';

const skillRoot = '.pi/skills/frontend-checklist-global';
const requiredFiles = [
  `${skillRoot}/SKILL.md`,
  `${skillRoot}/references/categories.md`,
  'docs/FRONT-END-CHECKLIST-INTEGRATION.md',
];
const conflictingRoot = '.agents/skills/frontend-checklist-global';

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

if (fs.existsSync(conflictingRoot)) {
  failures.push(`conflicting duplicate skill root ${conflictingRoot}`);
}

if (failures.length === 0) {
  const skill = fs.readFileSync(requiredFiles[0], 'utf8');
  const integration = fs.readFileSync(requiredFiles[2], 'utf8');

  if (!skill.includes('name: frontend-checklist-global')) failures.push('skill identity drifted');
  if (!skill.includes('385 Front-End Checklist rules')) failures.push('skill corpus contract drifted');
  if (!integration.includes('DASHBOARD-UI-RULES.md')) failures.push('project rule precedence is missing');
  if (!integration.includes('NEEDS_EVIDENCE')) failures.push('evidence verdict contract is missing');
  if (!integration.includes('30756a79b2f7d4363ac592710146c8e28fa9f1b5')) failures.push('reviewed upstream revision is missing');
}

if (failures.length > 0) {
  console.error(`Front-End Checklist integration failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Front-End Checklist integration: canonical Pi skill, collision guard, precedence, evidence contract, and reviewed revision are consistent.');
