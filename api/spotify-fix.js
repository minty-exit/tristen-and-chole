export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  const playlistId = process.env.SPOTIFY_PLAYLIST_ID;

  const results = {};

  try {
    // Get user token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // Make playlist public
    const updateRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ public: true })
    });
    results.makePublicStatus = updateRes.status;

    // Now try adding a track
    const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: ['spotify:track:34gCuhDGsG4bRPIf9bb02f'] })
    });
    const addData = await addRes.json();
    results.addStatus = addRes.status;
    results.addResponse = addData;
    results.success = addRes.status === 200 || addRes.status === 201;

  } catch (err) {
    results.error = err.message;
  }

  return res.status(200).json(results);
}
