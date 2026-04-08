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

      // Curated song lists by mood — real songs people actually know
      const moods = {
        'slow-dance': [
          'Thinking Out Loud Ed Sheeran',
          'Perfect Ed Sheeran',
          'All of Me John Legend',
          'At Last Etta James',
          'Make You Feel My Love Adele',
          'A Thousand Years Christina Perri',
          'Unchained Melody Righteous Brothers',
          'Can\'t Help Falling in Love Elvis',
          'You Are the Best Thing Ray LaMontagne',
          'I Don\'t Want to Miss a Thing Aerosmith',
          'Amazed Lonestar',
          'Bless the Broken Road Rascal Flatts',
          'Then Brad Paisley',
          'From the Ground Up Dan and Shay',
          'Speechless Dan and Shay'
        ],
        'good-times': [
          'Uptown Funk Bruno Mars',
          'Happy Pharrell Williams',
          'Shut Up and Dance Walk the Moon',
          'I Gotta Feeling Black Eyed Peas',
          'Can\'t Stop the Feeling Justin Timberlake',
          'Sugar Maroon 5',
          'Marry You Bruno Mars',
          'Love on Top Beyonce',
          '24K Magic Bruno Mars',
          'Levitating Dua Lipa',
          'Shake It Off Taylor Swift',
          'Dancing Queen ABBA',
          'Don\'t Stop Believin Journey',
          'Sweet Caroline Neil Diamond',
          'Mr Brightside Killers'
        ],
        'two-steppin': [
          'Cruise Florida Georgia Line',
          'Body Like a Back Road Sam Hunt',
          'Chicken Fried Zac Brown Band',
          'Drunk on You Luke Bryan',
          'Barefoot Blue Jean Night Jake Owen',
          'House Party Sam Hunt',
          'Country Girl Shake It Luke Bryan',
          'Dirt Road Anthem Jason Aldean',
          'Wagon Wheel Darius Rucker',
          'Tennessee Whiskey Chris Stapleton',
          'Die a Happy Man Thomas Rhett',
          'Tequila Dan and Shay',
          'Buy Me a Boat Chris Janson',
          'Springsteen Eric Church',
          'Beers and Sunshine Darius Rucker'
        ],
        'dance-floor': [
          'Yeah Usher',
          'Get Low Lil Jon',
          'In Da Club 50 Cent',
          'Wobble Baby V.I.C.',
          'Cupid Shuffle Cupid',
          'Cha Cha Slide DJ Casper',
          'Blinding Lights Weeknd',
          'Dynamite BTS',
          'Party Rock Anthem LMFAO',
          'Timber Pitbull Kesha',
          'Sexy Back Justin Timberlake',
          'Crazy in Love Beyonce',
          'Lose Yourself to Dance Daft Punk',
          'Hotline Bling Drake',
          'Old Town Road Lil Nas X'
        ]
      };

      const songList = moods[recMood] || moods['good-times'];

      // Shuffle the list
      for (let i = songList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songList[i], songList[j]] = [songList[j], songList[i]];
      }

      // Search for 8 random songs from the list
      const allTracks = [];
      const picks = songList.slice(0, 8);

      for (const q of picks) {
        try {
          const searchRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
            { headers: { 'Authorization': 'Bearer ' + token } }
          );
          const searchData = await searchRes.json();

          if (searchData.tracks?.items?.[0]) {
            const t = searchData.tracks.items[0];
            allTracks.push({
              id: t.id,
              name: t.name,
              artist: t.artists.map(a => a.name).join(', '),
              albumArt: t.album.images[1]?.url || t.album.images[0]?.url || '',
              albumArtSmall: t.album.images[2]?.url || t.album.images[0]?.url || '',
              preview: t.preview_url || ''
            });
          }
        } catch (e) {}
      }

      return res.status(200).json({ success: true, tracks: allTracks });
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
