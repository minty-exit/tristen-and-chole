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

      // Check if track already exists in playlist
      const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50&fields=items(track(id)),next`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const plData = await plRes.json();
      const existingIds = (plData.items || []).map(i => i.track?.id).filter(Boolean);

      // Check additional pages if playlist has 50+ songs
      let nextUrl = plData.next;
      while (nextUrl) {
        const nextRes = await fetch(nextUrl, { headers: { 'Authorization': 'Bearer ' + token } });
        const nextData = await nextRes.json();
        existingIds.push(...(nextData.items || []).map(i => i.track?.id).filter(Boolean));
        nextUrl = nextData.next;
      }

      if (existingIds.includes(addTrack)) {
        return res.status(200).json({ success: false, duplicate: true, error: 'This song is already in the playlist!' });
      }

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

  // ─── Recommendations by mood (using /recommendations + playlist seed tracks) ───
  if (recMood) {
    try {
      const token = await getToken(false);
      const playlistId = process.env.SPOTIFY_PLAYLIST_ID;
      let seedTracks = [];

      // Pull last few tracks from the playlist to use as seeds
      if (playlistId) {
        try {
          const userToken = await getToken(true);
          const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items?limit=10&fields=items(track(id,artists(id)))`, {
            headers: { 'Authorization': 'Bearer ' + userToken }
          });
          const plData = await plRes.json();
          if (plData.items) {
            seedTracks = plData.items.map(i => i.track?.id).filter(Boolean);
            // Shuffle and pick up to 3
            for (let i = seedTracks.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [seedTracks[i], seedTracks[j]] = [seedTracks[j], seedTracks[i]];
            }
            seedTracks = seedTracks.slice(0, 3);
          }
        } catch (e) {}
      }

      // Mood configs with genre seeds and tuning
      const moods = {
        'slow-dance': {
          genres: ['romance', 'r-n-b'],
          params: { target_energy: 0.3, target_valence: 0.5, target_danceability: 0.4, min_popularity: 50 }
        },
        'good-times': {
          genres: ['pop', 'happy'],
          params: { target_energy: 0.7, target_valence: 0.8, target_danceability: 0.7, min_popularity: 60 }
        },
        'two-steppin': {
          genres: ['country'],
          params: { target_energy: 0.6, target_valence: 0.7, target_danceability: 0.65, min_popularity: 50 }
        },
        'dance-floor': {
          genres: ['dance', 'party'],
          params: { target_energy: 0.85, target_valence: 0.8, target_danceability: 0.85, min_popularity: 60 }
        }
      };

      const mood = moods[recMood] || moods['good-times'];

      const params = new URLSearchParams({
        limit: 10,
        ...mood.params
      });

      // Use seed tracks from playlist + fill with genre seeds (max 5 total)
      if (seedTracks.length > 0) {
        params.set('seed_tracks', seedTracks.join(','));
        // Fill remaining seeds with genres (5 total max)
        const genreSlots = Math.min(5 - seedTracks.length, mood.genres.length);
        if (genreSlots > 0) {
          params.set('seed_genres', mood.genres.slice(0, genreSlots).join(','));
        }
      } else {
        // No playlist tracks yet, just use genres
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

      return res.status(200).json({ success: true, tracks, seeded: seedTracks.length > 0 });
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
