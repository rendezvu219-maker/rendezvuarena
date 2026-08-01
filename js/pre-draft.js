export const DIVINE_RULES = Object.freeze([
  { name: 'Cloud Cover', file: 'Cloud Cover.png', desc: 'Blind pick active. Both teams pick simultaneously.' },
  { name: 'Super Start', file: 'Super Start.png', desc: 'Ultimate cooldown reduced by 50% at match start.' },
  { name: 'Spirited Away', file: 'Spirited Away.png', desc: 'Each team can perform one extra ban.' },
  { name: 'Team Rush GO', file: 'Team Rush GO.png', desc: 'Picking timer reduced to 15 seconds. Rapid picks!' },
  { name: 'Super DMG Boost', file: 'Super DMG Boost.png', desc: 'All Damage heroes gain +10% DMG dealt.' },
  { name: 'Mystery HP', file: 'Mystery HP.png', desc: 'Base health stats are hidden from opponents.' },
  { name: 'Healing Attack', file: 'Healing Attack.png', desc: 'Attacks restore 2% of damage dealt as health.' },
  { name: 'Burst Step', file: 'Burst Step.png', desc: 'Dashes and vanishing steps consume 20% less energy.' },
]);

export function normalizeSideAssignment(value) {
  if (!value || typeof value !== 'object') return null;
  const left = value.A;
  const right = value.B;
  if (!['teamA', 'teamB'].includes(left) || !['teamA', 'teamB'].includes(right) || left === right) return null;
  return { A: left, B: right };
}

export function resolveSideAssignment(chooserTeamKey, chosenSide) {
  const chooser = chooserTeamKey === 'teamB' ? 'teamB' : 'teamA';
  const other = chooser === 'teamA' ? 'teamB' : 'teamA';
  const side = chosenSide === 'B' ? 'B' : 'A';
  return side === 'A'
    ? { A: chooser, B: other }
    : { A: other, B: chooser };
}

export function sideForEntrant(assignment, entrantKey) {
  const normalized = normalizeSideAssignment(assignment);
  if (!normalized) return entrantKey === 'teamB' ? 'B' : 'A';
  return normalized.A === entrantKey ? 'A' : 'B';
}

export function entrantForSide(assignment, side) {
  const normalized = normalizeSideAssignment(assignment);
  if (!normalized) return side === 'B' ? 'teamB' : 'teamA';
  return normalized[side === 'B' ? 'B' : 'A'];
}

export function buildDivineBanSequence(bansPerTeam = 0) {
  const count = Math.max(0, Math.min(3, Math.floor(Number(bansPerTeam) || 0)));
  const sequence = [];
  for (let index = 0; index < count; index += 1) {
    sequence.push({ team: 'A', action: 'ban' });
    sequence.push({ team: 'B', action: 'ban' });
  }
  return sequence;
}

export function buildDivinePickBanSequence(bansPerTeam = 0) {
  // Blue starts each ban round. Red then receives the first pick, followed by Blue.
  // The game supports exactly two active Divine Draws total: one per side.
  return [
    ...buildDivineBanSequence(bansPerTeam),
    { team: 'B', action: 'pick' },
    { team: 'A', action: 'pick' },
  ];
}

export function isValidDivineIndex(index) {
  return Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < DIVINE_RULES.length;
}
