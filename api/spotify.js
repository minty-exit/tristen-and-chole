export default async function handler(req, res) {
  const query = req.query.q;
  const addTrack = req.query.add;
  const recMood = req.query.recommend;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  // ─── Cached tokens (persist across warm invocations) ───
  if (!global._spotifyCache) global._spotifyCache = { client: null, clientExp: 0, user: null, userExp: 0 };

  async function getToken(useRefresh) {
    const now = Date.now();
    if (useRefresh) {
      if (global._spotifyCache.user && now < global._spotifyCache.userExp) return global._spotifyCache.user;
      const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
      });
      const data = await tokenRes.json();
      global._spotifyCache.user = data.access_token;
      global._spotifyCache.userExp = now + ((data.expires_in || 3600) - 120) * 1000;
      return data.access_token;
    }
    if (global._spotifyCache.client && now < global._spotifyCache.clientExp) return global._spotifyCache.client;
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
    });
    const data = await tokenRes.json();
    global._spotifyCache.client = data.access_token;
    global._spotifyCache.clientExp = now + ((data.expires_in || 3600) - 120) * 1000;
    return data.access_token;
  }

  // ─── Add track to playlist ───
  if (addTrack) {
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
    const playlistId = process.env.SPOTIFY_PLAYLIST_ID;
    if (!refreshToken || !playlistId) {
      return res.status(200).json({ success: false, error: 'Playlist not configured yet' });
    }
    try {
      const token = await getToken(true);
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${addTrack}`] })
      });
      const addData = await addRes.json();
      return res.status(200).json({ success: true, snapshot: addData.snapshot_id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── Recommendations by mood (using search since /recommendations is deprecated) ───
  if (recMood) {
    try {
      const token = await getToken(false);

      // Mood search queries — multiple searches to get variety
      const moods = {
        'slow-dance': [
          'first dance wedding love',
          'romantic slow dance',
          'wedding love song ballad'
        ],
        'good-times': [
          'feel good wedding party',
          'happy upbeat celebration',
          'wedding fun sing along'
        ],
        'two-steppin': [
          'country wedding dance',
          'country love song wedding',
          'country two step dance'
        ],
        'dance-floor': [
          'dance party hits wedding',
          'wedding reception dance',
          'party dance floor hits'
        ]
      };

      const queries = moods[recMood] || moods['good-times'];

      // Run multiple searches and combine results
      const allTracks = [];
      const seenIds = new Set();

      for (const q of queries) {
        try {
          const searchRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`,
            { headers: { 'Authorization': 'Bearer ' + token } }
          );
          const searchData = await searchRes.json();

          if (searchData.tracks?.items) {
            for (const t of searchData.tracks.items) {
              if (!seenIds.has(t.id)) {
                seenIds.add(t.id);
                allTracks.push({
                  id: t.id,
                  name: t.name,
                  artist: t.artists.map(a => a.name).join(', '),
                  albumArt: t.album.images[1]?.url || t.album.images[0]?.url || '',
                  albumArtSmall: t.album.images[2]?.url || t.album.images[0]?.url || '',
                  preview: t.preview_url || ''
                });
              }
            }
          }
        } catch (e) {}
      }

      // Shuffle and take 8
      for (let i = allTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
      }

      return res.status(200).json({ success: true, tracks: allTracks.slice(0, 8) });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── Search tracks ───
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const token = await getToken(false);
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`,
      { headers: { 'Authorization': 'Bearer ' + token } }
    );
    const searchData = await searchRes.json();
    return res.status(200).json(searchData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
