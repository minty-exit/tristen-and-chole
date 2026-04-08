export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  const playlistId = process.env.SPOTIFY_PLAYLIST_ID;

  const status = {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    hasPlaylistId: !!playlistId,
    playlistId: playlistId || 'NOT SET'
  };

  try {
    // Get token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    });
    const tokenData = await tokenRes.json();
    status.tokenSuccess = !!tokenData.access_token;
    status.tokenError = tokenData.error || null;

    if (tokenData.access_token) {
      // Try adding a test track
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + tokenData.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: ['spotify:track:34gCuhDGsG4bRPIf9bb02f'] })
      });
      const addData = await addRes.json();
      status.addResponse = addData;
      status.addHttpStatus = addRes.status;
    }
  } catch (err) {
    status.error = err.message;
  }

  return res.status(200).json(status);
}
