export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
  });
  const { access_token } = await tokenRes.json();

  const queries = [
    'wedding first dance',
    'wedding reception',
    'country wedding',
    'dance party hits',
    'romantic wedding songs',
    'country love songs',
    'party bangers',
    'feel good hits'
  ];

  const results = {};

  for (const q of queries) {
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=playlist&limit=5`,
      { headers: { 'Authorization': 'Bearer ' + access_token } }
    );
    const data = await searchRes.json();
    results[q] = (data.playlists?.items || []).map(p => ({
      name: p.name,
      id: p.id,
      owner: p.owner?.display_name,
      tracks: p.tracks?.total
    }));
  }

  return res.status(200).json(results);
}
