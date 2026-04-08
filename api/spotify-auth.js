export default function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = 'https://tristenandchloe.vercel.app/api/spotify-callback';
  const scopes = 'playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative';

  const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    show_dialog: 'true'
  }).toString();

  res.redirect(authUrl);
}
