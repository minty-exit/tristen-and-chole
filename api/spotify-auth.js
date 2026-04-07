export default function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = 'https://tristenandchloe.vercel.app/api/spotify-callback';
  const scopes = 'playlist-modify-public playlist-modify-private';

  const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri
  }).toString();

  res.redirect(authUrl);
}
