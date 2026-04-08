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
    playlistId: playlistId || 'NOT SET',
    refreshTokenStart: refreshToken ? refreshToken.substring(0, 10) + '...' : 'NONE'
  };

  try {
    // Use REFRESH TOKEN (user token), not client credentials
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
    status.tokenSuccess = !!tokenData.access_token;
    status.tokenError = tokenData.error || null;
    status.scopes = tokenData.scope || 'none returned';

    if (tokenData.access_token) {
      // Check who we are
      const meRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
      });
      const meData = await meRes.json();
      status.spotifyUser = meData.id;
      status.spotifyEmail = meData.email || 'not available';

      // Check playlist owner
      const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=owner.id,name,collaborative,public`, {
        headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
      });
      const plData = await plRes.json();
      status.playlistName = plData.name;
      status.playlistOwner = plData.owner?.id;
      status.playlistPublic = plData.public;
      status.ownerMatchesUser = meData.id === plData.owner?.id;

      // Try adding a track
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + tokenData.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: ['spotify:track:34gCuhDGsG4bRPIf9bb02f'] })
      });
      const addData = await addRes.json();
      status.addHttpStatus = addRes.status;
      status.addResponse = addData;
      status.addSuccess = addRes.status === 200 || addRes.status === 201;
    }
  } catch (err) {
    status.error = err.message;
  }

  return res.status(200).json(status);
}
