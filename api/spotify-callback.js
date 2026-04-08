export default async function handler(req, res) {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.status(400).send(`<h1>Authorization failed</h1><p>${error}</p>`);
  }

  if (!code) {
    return res.status(400).send('<h1>Missing authorization code</h1>');
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = 'https://tristenandchloe.vercel.app/api/spotify-callback';

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.refresh_token) {
      return res.status(500).send(`<h1>Failed to get tokens</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
    }

    // Get user profile
    const userRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
    });
    const userData = await userRes.json();

    // Create a NEW playlist
    const plRes = await fetch(`https://api.spotify.com/v1/users/${userData.id}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + tokenData.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: "Tristen and Chloe's Wedding",
        description: 'Song requests from our wedding guests',
        public: true
      })
    });
    const plData = await plRes.json();

    // Test adding a song to the NEW playlist
    let testResult = 'Playlist creation failed';
    let newPlaylistId = 'undefined';
    let playlistUrl = '#';

    if (plData.id) {
      newPlaylistId = plData.id;
      playlistUrl = plData.external_urls?.spotify || '#';

      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + tokenData.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: ['spotify:track:34gCuhDGsG4bRPIf9bb02f'] })
      });
      testResult = (addRes.status === 201 || addRes.status === 200)
        ? 'SUCCESS - Song added!'
        : `FAILED (${addRes.status})`;
    }

    res.status(200).send(`
      <html>
      <body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;line-height:1.8;">
        <h1>Spotify Connected!</h1>
        <h2>Add Song Test: ${testResult}</h2>
        <p><strong>Playlist:</strong> <a href="${playlistUrl}" target="_blank">${playlistUrl}</a></p>
        <hr>
        <p><strong>SPOTIFY_REFRESH_TOKEN:</strong></p>
        <textarea style="width:100%;height:80px;font-family:monospace;font-size:11px;" onclick="this.select()">${tokenData.refresh_token}</textarea>
        <p><strong>SPOTIFY_PLAYLIST_ID:</strong></p>
        <textarea style="width:100%;height:40px;font-family:monospace;font-size:11px;" onclick="this.select()">${newPlaylistId}</textarea>
        <hr>
        <p>Update BOTH values in Vercel Environment Variables, then redeploy.</p>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${err.message}</pre>`);
  }
}
