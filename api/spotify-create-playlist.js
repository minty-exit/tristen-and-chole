export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!refreshToken) {
    return res.status(500).send('Missing SPOTIFY_REFRESH_TOKEN environment variable');
  }

  try {
    // Get fresh access token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(500).send(`Token error: ${JSON.stringify(tokenData)}`);
    }

    // Get user ID
    const userRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
    });
    const userData = await userRes.json();

    // Create playlist
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
      <body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;line-height:1.8;">
        <h1>Playlist Created!</h1>
        <p><strong>Name:</strong> ${playlistData.name}</p>
        <p><strong>URL:</strong> <a href="${playlistData.external_urls.spotify}" target="_blank">${playlistData.external_urls.spotify}</a></p>
        <p><strong>Playlist ID:</strong></p>
        <textarea style="width:100%;height:40px;font-family:monospace;" onclick="this.select()">${playlistData.id}</textarea>
        <hr>
        <p>Add this to Vercel Environment Variables:</p>
        <p><code>SPOTIFY_PLAYLIST_ID</code> = <code>${playlistData.id}</code></p>
        <p>Then redeploy your site.</p>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
}
