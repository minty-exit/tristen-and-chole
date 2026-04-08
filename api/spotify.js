export default async function handler(req, res) {
  const query = req.query.q;
  const addTrack = req.query.add;
  const recMood = req.query.recommend;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  // ─── Get access token helper ───
  async function getToken(useRefresh) {
    if (useRefresh) {
      const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
      });
      return (await tokenRes.json()).access_token;
    }
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
    });
    return (await tokenRes.json()).access_token;
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
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
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

  // ─── Recommendations by mood ───
  if (recMood) {
    try {
      const token = await getToken(false);
      const playlistId = process.env.SPOTIFY_PLAYLIST_ID;
      let seedTracks = [];

      // Try to get seed tracks from the playlist
      if (playlistId) {
        try {
          const userToken = await getToken(true);
          const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=5&fields=items(track(id))`, {
            headers: { 'Authorization': 'Bearer ' + userToken }
          });
          const plData = await plRes.json();
          if (plData.items) {
            seedTracks = plData.items.map(i => i.track?.id).filter(Boolean).slice(0, 2);
          }
        } catch (e) {}
      }

      // Mood configs
      const moods = {
        'slow-dance': {
          genres: ['romance'],
          params: { target_energy: 0.3, target_valence: 0.5, target_danceability: 0.4, target_tempo: 80 }
        },
        'good-times': {
          genres: ['pop', 'happy'],
          params: { target_energy: 0.65, target_valence: 0.8, target_danceability: 0.7, target_tempo: 115 }
        },
        'two-steppin': {
          genres: ['country'],
          params: { target_energy: 0.6, target_valence: 0.7, target_danceability: 0.65, target_tempo: 120 }
        },
        'dance-floor': {
          genres: ['dance', 'party'],
          params: { target_energy: 0.85, target_valence: 0.8, target_danceability: 0.85, target_tempo: 128 }
        }
      };

      const mood = moods[recMood] || moods['good-times'];

      const params = new URLSearchParams({
        limit: 8,
        ...mood.params
      });

      // Use seed tracks if we have them, fill remaining with genres
      if (seedTracks.length > 0) {
        params.set('seed_tracks', seedTracks.join(','));
        params.set('seed_genres', mood.genres[0]);
      } else {
        params.set('seed_genres', mood.genres.join(','));
      }

      const recRes = await fetch(`https://api.spotify.com/v1/recommendations?${params}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const recData = await recRes.json();

      const tracks = (recData.tracks || []).map(t => ({
        id: t.id,
        name: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        albumArt: t.album.images[1]?.url || t.album.images[0]?.url || '',
        albumArtSmall: t.album.images[2]?.url || t.album.images[0]?.url || '',
        preview: t.preview_url || ''
      }));

      return res.status(200).json({ success: true, tracks });
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
