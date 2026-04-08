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

  // ─── Recommendations by mood (same artists + similar artists from playlist) ───
  if (recMood) {
    try {
      const token = await getToken(false);
      const playlistId = process.env.SPOTIFY_PLAYLIST_ID;
      let playlistArtistIds = [];
      let playlistArtistNames = [];
      let playlistTrackIds = new Set();

      // Pull artists and track IDs from the playlist
      if (playlistId) {
        try {
          const userToken = await getToken(true);
          const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50`, {
            headers: { 'Authorization': 'Bearer ' + userToken }
          });
          const plData = await plRes.json();
          if (plData.items) {
            const seenArtists = new Set();
            for (const item of plData.items) {
              if (item.track?.id) playlistTrackIds.add(item.track.id);
              if (item.track?.artists) {
                for (const a of item.track.artists) {
                  if (a.id && !seenArtists.has(a.id)) {
                    seenArtists.add(a.id);
                    playlistArtistIds.push(a.id);
                    playlistArtistNames.push(a.name);
                  }
                }
              }
            }
          }
        } catch (e) {}
      }

      // Shuffle artists
      function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }
      shuffle(playlistArtistIds);
      shuffle(playlistArtistNames);

      // Mood-specific search terms
      const moods = {
        'slow-dance': ['love song', 'romantic ballad', 'slow dance', 'wedding song'],
        'good-times': ['feel good hit', 'upbeat pop', 'happy song', 'party anthem'],
        'two-steppin': ['country hit', 'country dance', 'country love', 'country anthem'],
        'dance-floor': ['dance hit', 'club banger', 'party dance', 'hype song']
      };
      const moodTerms = moods[recMood] || moods['good-times'];

      const allTracks = [];
      const seenIds = new Set(playlistTrackIds);
      const seenArtistNames = new Set();

      function addTrack(t) {
        if (seenIds.has(t.id)) return;
        seenIds.add(t.id);
        allTracks.push({
          id: t.id, name: t.name,
          artist: t.artists.map(a => a.name).join(', '),
          albumArt: t.album.images[1]?.url || t.album.images[0]?.url || '',
          albumArtSmall: t.album.images[2]?.url || t.album.images[0]?.url || ''
        });
      }

      // Strategy 1: Get related artists, then search for their tracks + mood
      const relatedArtistNames = [];
      for (const artistId of playlistArtistIds.slice(0, 3)) {
        try {
          const relRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const relData = await relRes.json();
          if (relData.artists) {
            for (const a of relData.artists.slice(0, 3)) {
              if (!playlistArtistNames.includes(a.name)) {
                relatedArtistNames.push(a.name);
              }
            }
          }
        } catch (e) {}
      }

      // Search for tracks by related artists
      shuffle(relatedArtistNames);
      for (const artist of relatedArtistNames.slice(0, 4)) {
        if (allTracks.length >= 4) break;
        const term = moodTerms[Math.floor(Math.random() * moodTerms.length)];
        try {
          const res = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:${artist}`)}&type=track&limit=2`,
            { headers: { 'Authorization': 'Bearer ' + token } }
          );
          const data = await res.json();
          for (const t of (data.tracks?.items || [])) { addTrack(t); }
        } catch (e) {}
      }

      // Strategy 2: Search for more songs by playlist artists + mood
      for (const artist of playlistArtistNames.slice(0, 3)) {
        if (allTracks.length >= 6) break;
        const term = moodTerms[Math.floor(Math.random() * moodTerms.length)];
        try {
          const res = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:${artist} ${term}`)}&type=track&limit=2`,
            { headers: { 'Authorization': 'Bearer ' + token } }
          );
          const data = await res.json();
          for (const t of (data.tracks?.items || [])) { addTrack(t); }
        } catch (e) {}
      }

      // Strategy 3: Fill remaining with mood genre searches
      shuffle(moodTerms);
      for (const term of moodTerms) {
        if (allTracks.length >= 8) break;
        try {
          const offset = Math.floor(Math.random() * 5);
          const res = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(term)}&type=track&limit=5&offset=${offset}`,
            { headers: { 'Authorization': 'Bearer ' + token } }
          );
          const data = await res.json();
          for (const t of (data.tracks?.items || [])) {
            if (allTracks.length >= 10) break;
            addTrack(t);
          }
        } catch (e) {}
      }

      shuffle(allTracks);
      return res.status(200).json({ success: true, tracks: allTracks.slice(0, 8), relatedArtists: relatedArtistNames.slice(0, 5) });
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
