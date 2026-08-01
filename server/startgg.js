const STARTGG_ENDPOINT = 'https://api.start.gg/gql/alpha';

function extractTournamentSlug(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('A start.gg tournament URL or slug is required.');
  if (!text.includes('/')) return text.replace(/^tournament\//, '').replace(/\/$/, '');
  let url;
  try { url = new URL(text); } catch { throw new Error('The start.gg URL is invalid.'); }
  const match = url.pathname.match(/\/tournament\/([^/]+)/i);
  if (!match) throw new Error('Could not find a tournament slug in this URL.');
  return match[1];
}

async function gql(query, variables) {
  const token = process.env.STARTGG_API_TOKEN;
  if (!token) throw new Error('STARTGG_API_TOKEN is not configured on the server.');
  const response = await fetch(STARTGG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.map(error => error.message).join('; ') || `start.gg request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload.data;
}

async function importTournament(urlOrSlug) {
  const slug = extractTournamentSlug(urlOrSlug);
  const data = await gql(`
    query TournamentImport($slug: String!) {
      tournament(slug: $slug) {
        id
        name
        slug
        city
        countryCode
        startAt
        endAt
        events {
          id
          name
          numEntrants
          entrants(query: { page: 1, perPage: 100 }) {
            nodes {
              id
              name
              participants {
                id
                gamerTag
                prefix
                user { id slug }
              }
            }
          }
        }
      }
    }
  `, { slug });
  if (!data?.tournament) throw new Error('Tournament not found on start.gg.');
  return data.tournament;
}

module.exports = { importTournament, extractTournamentSlug };
