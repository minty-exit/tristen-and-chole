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
    // Exchange code for tokens
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

    // Get user profile to create playlist
    const userRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
    });
    const userData = await userRes.json();

    // Create the wedding playlist
    const playlistRes = await fetch(`https://api.spotify.com/v1/users/${userData.id}/playlists`, {
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
    const playlistData = await playlistRes.json();

    res.status(200).send(`
      <html>
      <head><title>Spotify Connected!</title></head>
      <body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;line-height:1.8;">
        <h1>Spotify Connected!</h1>
        <p>Playlist created: <strong>${playlistData.name}</strong></p>
        <p>Playlist URL: <a href="${playlistData.external_urls?.spotify}" target="_blank">${playlistData.external_urls?.spotify}</a></p>
        <hr>
        <h2>Add these to Vercel Environment Variables:</h2>
        <p><strong>SPOTIFY_REFRESH_TOKEN:</strong></p>
        <textarea style="width:100%;height:60px;font-family:monospace;font-size:12px;" onclick="this.select()">${tokenData.refresh_token}</textarea>
        <p><strong>SPOTIFY_PLAYLIST_ID:</strong></p>
        <textarea style="width:100%;height:40px;font-family:monospace;font-size:12px;" onclick="this.select()">${playlistData.id}</textarea>
        <hr>
        <h3>Steps:</h3>
        <ol>
          <li>Copy the SPOTIFY_REFRESH_TOKEN value above</li>
          <li>Go to Vercel > Settings > Environment Variables</li>
          <li>Add: <code>SPOTIFY_REFRESH_TOKEN</code> = the token above</li>
          <li>Add: <code>SPOTIFY_PLAYLIST_ID</code> = the playlist ID above</li>
          <li>Redeploy your site (push any change or click Redeploy in Vercel)</li>
        </ol>
        <p>Once done, every song request from guests will automatically be added to the playlist!</p>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${err.message}</pre>`);
  }
}
