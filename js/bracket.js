// Bracket Manager for Tournament Management
export class BracketManager {
  constructor() {
    this.teams = this.loadTeams() || this.getDefaultTeams();
    this.matches = this.loadMatches() || [];
  }

  getDefaultTeams() {
    return [
      { id: 't1', name: 'Universe 7 Warriors', tag: 'U7', wins: 0, losses: 0, players: [
        { name: 'Goku', role: 'Damage', email: 'goku@db.com', startggId: 'goku_ssj' },
        { name: 'Vegeta', role: 'Tank', email: 'vegeta@db.com', startggId: 'prince_vegeta' },
        { name: 'Gohan', role: 'Technical', email: 'gohan@db.com', startggId: 'gohan_beast' },
        { name: 'Piccolo', role: 'Damage', email: 'piccolo@db.com', startggId: 'orange_piccolo' }
      ]},
      { id: 't2', name: 'Pride Troopers', tag: 'PT', wins: 0, losses: 0, players: [
        { name: 'Jiren', role: 'Tank', email: 'jiren@pride.com', startggId: 'jiren_gray' },
        { name: 'Toppo', role: 'Damage', email: 'toppo@pride.com', startggId: 'god_toppo' },
        { name: 'Dyspo', role: 'Technical', email: 'dyspo@pride.com', startggId: 'dyspo_speed' },
        { name: 'Cocotte', role: 'Damage', email: 'cocotte@pride.com', startggId: 'cocotte_zone' }
      ]},
      { id: 't3', name: 'Team Universe 6', tag: 'U6', wins: 0, losses: 0, players: [
        { name: 'Hit', role: 'Technical', email: 'hit@assassin.com', startggId: 'hit_timeskip' },
        { name: 'Cabba', role: 'Damage', email: 'cabba@db.com', startggId: 'cabba_ssj' },
        { name: 'Caulifla', role: 'Tank', email: 'caulifla@db.com', startggId: 'caulifla_ssj2' },
        { name: 'Kale', role: 'Damage', email: 'kale@db.com', startggId: 'kale_berserk' }
      ]},
      { id: 't4', name: 'Frieza Force', tag: 'FF', wins: 0, losses: 0, players: [
        { name: 'Frieza', role: 'Technical', email: 'frieza@force.com', startggId: 'golden_frieza' },
        { name: 'Cooler', role: 'Tank', email: 'cooler@force.com', startggId: 'cooler_final' },
        { name: 'Zarbon', role: 'Damage', email: 'zarbon@force.com', startggId: 'zarbon_monster' },
        { name: 'Dodoria', role: 'Damage', email: 'dodoria@force.com', startggId: 'dodoria_brute' }
      ]},
      { id: 't5', name: 'Z Fighters', tag: 'ZF', wins: 0, losses: 0, players: [
        { name: 'Yamcha', role: 'Damage', email: 'yamcha@db.com', startggId: 'yamcha_wolf' },
        { name: 'Tien', role: 'Technical', email: 'tien@db.com', startggId: 'tien_shinhan' },
        { name: 'Chiaotzu', role: 'Tank', email: 'chiaotzu@db.com', startggId: 'chiaotzu_psychic' },
        { name: 'Krillin', role: 'Technical', email: 'krillin@db.com', startggId: 'krillin_destructo' }
      ]},
      { id: 't6', name: 'Majin Clan', tag: 'MC', wins: 0, losses: 0, players: [
        { name: 'Kid Buu', role: 'Damage', email: 'kidbuu@majin.com', startggId: 'buu_pure' },
        { name: 'Super Buu', role: 'Damage', email: 'superbuu@majin.com', startggId: 'buu_absorption' },
        { name: 'Fat Buu', role: 'Tank', email: 'fatbuu@majin.com', startggId: 'buu_good' },
        { name: 'Uub', role: 'Technical', email: 'uub@db.com', startggId: 'uub_reincarnated' }
      ]},
      { id: 't7', name: 'Android Rebellion', tag: 'AR', wins: 0, losses: 0, players: [
        { name: 'Android 17', role: 'Technical', email: '17@android.com', startggId: 'android17_ranger' },
        { name: 'Android 18', role: 'Damage', email: '18@android.com', startggId: 'android18_lazuli' },
        { name: 'Android 16', role: 'Tank', email: '16@android.com', startggId: 'android16_nature' },
        { name: 'Cell', role: 'Damage', email: 'cell@android.com', startggId: 'perfect_cell' }
      ]},
      { id: 't8', name: 'Godly Destruction', tag: 'GD', wins: 0, losses: 0, players: [
        { name: 'Beerus', role: 'Damage', email: 'beerus@god.com', startggId: 'beerus_destroyer' },
        { name: 'Whis', role: 'Technical', email: 'whis@god.com', startggId: 'whis_angel' },
        { name: 'Champa', role: 'Tank', email: 'champa@god.com', startggId: 'champa_destroyer' },
        { name: 'Vados', role: 'Technical', email: 'vados@god.com', startggId: 'vados_angel' }
      ]}
    ];
  }

  loadTeams() {
    const data = localStorage.getItem('gs_bracket_teams');
    return data ? JSON.parse(data) : null;
  }

  saveTeams() {
    localStorage.setItem('gs_bracket_teams', JSON.stringify(this.teams));
  }

  loadMatches() {
    const data = localStorage.getItem('gs_bracket_matches');
    return data ? JSON.parse(data) : null;
  }

  saveMatches() {
    localStorage.setItem('gs_bracket_matches', JSON.stringify(this.matches));
  }

  generateBracket(randomize = true) {
    let teamPool = [...this.teams];
    if (randomize) {
      teamPool.sort(() => 0.5 - Math.random());
    }

    this.matches = [
      // Quarter Finals
      { id: 'q1', round: 'quarters', teamA: teamPool[0], teamB: teamPool[1], scoreA: null, scoreB: null, winner: null },
      { id: 'q2', round: 'quarters', teamA: teamPool[2], teamB: teamPool[3], scoreA: null, scoreB: null, winner: null },
      { id: 'q3', round: 'quarters', teamA: teamPool[4], teamB: teamPool[5], scoreA: null, scoreB: null, winner: null },
      { id: 'q4', round: 'quarters', teamA: teamPool[6], teamB: teamPool[7], scoreA: null, scoreB: null, winner: null },

      // Semi Finals (placeholders)
      { id: 's1', round: 'semis', teamA: null, teamB: null, scoreA: null, scoreB: null, winner: null, sourceA: 'q1', sourceB: 'q2' },
      { id: 's2', round: 'semis', teamA: null, teamB: null, scoreA: null, scoreB: null, winner: null, sourceA: 'q3', sourceB: 'q4' },

      // Grand Finals
      { id: 'f1', round: 'finals', teamA: null, teamB: null, scoreA: null, scoreB: null, winner: null, sourceA: 's1', sourceB: 's2' }
    ];
    this.saveMatches();
  }

  setMatchResult(matchId, scoreA, scoreB) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match || !match.teamA || !match.teamB) return;

    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.winner = scoreA > scoreB ? match.teamA : match.teamB;

    // Advance to next rounds
    if (matchId === 'q1' || matchId === 'q2') {
      const nextMatch = this.matches.find(m => m.id === 's1');
      if (matchId === 'q1') nextMatch.teamA = match.winner;
      if (matchId === 'q2') nextMatch.teamB = match.winner;
    } else if (matchId === 'q3' || matchId === 'q4') {
      const nextMatch = this.matches.find(m => m.id === 's2');
      if (matchId === 'q3') nextMatch.teamA = match.winner;
      if (matchId === 'q4') nextMatch.teamB = match.winner;
    } else if (matchId === 's1' || matchId === 's2') {
      const nextMatch = this.matches.find(m => m.id === 'f1');
      if (matchId === 's1') nextMatch.teamA = match.winner;
      if (matchId === 's2') nextMatch.teamB = match.winner;
    }

    this.saveMatches();
  }
}
