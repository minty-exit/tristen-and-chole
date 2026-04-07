/*
 * ═══════════════════════════════════════════════════════════════
 *  TRISTEN & CHLOE WEDDING - Google Apps Script Backend
 * ═══════════════════════════════════════════════════════════════
 *
 *  HOW TO SET UP:
 *  1. Open your Google Sheet ("Tristen & Chloe Wedding")
 *  2. Click Extensions > Apps Script
 *  3. Delete any code in the editor
 *  4. Paste this ENTIRE file
 *  5. Click the floppy disk icon to save
 *  6. Click "Deploy" > "New deployment"
 *  7. Type = "Web app"
 *  8. Execute as = "Me"
 *  9. Who has access = "Anyone"
 *  10. Click "Deploy"
 *  11. Copy the Web App URL - that's your API_URL for index.html
 *
 *  This creates 3 tabs in your sheet:
 *  - RSVPs (name, email, attending, guests, dietary, message, timestamp)
 *  - GuestBook (name, message, timestamp)
 *  - SongRequests (name, song, artist, spotifyId, albumArt, timestamp)
 * ═══════════════════════════════════════════════════════════════
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var params = e.parameter;
  var action = params.action;

  var result;

  try {
    switch (action) {
      case 'submitRSVP':
        result = submitRSVP(params);
        break;
      case 'submitGuestBook':
        result = submitGuestBook(params);
        break;
      case 'getGuestBook':
        result = getGuestBook();
        break;
      case 'submitSongRequest':
        result = submitSongRequest(params);
        break;
      case 'getSongRequests':
        result = getSongRequests();
        break;
      case 'submitPhoto':
        result = submitPhoto(params);
        break;
      case 'getPhotos':
        result = getPhotos();
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─── Sheet Helpers ─── */

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    // Bold the header row
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    // Freeze header row
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ─── RSVP ─── */

function submitRSVP(params) {
  var sheet = getOrCreateSheet('RSVPs', [
    'Timestamp', 'Name', 'Email', 'Attending', 'Guests', 'Guest Names', 'Dietary', 'Message'
  ]);

  // Collect guest names
  var guestNames = [];
  for (var i = 2; i <= 6; i++) {
    var gn = params['guest' + i + '_name'];
    if (gn) guestNames.push(gn);
  }

  sheet.appendRow([
    new Date().toLocaleString(),
    params.name || '',
    params.email || '',
    params.attending || '',
    params.guests || '1',
    guestNames.join(', '),
    params.dietary || '',
    params.message || ''
  ]);

  return { success: true, message: 'RSVP received!' };
}

/* ─── Guest Book ─── */

function submitGuestBook(params) {
  var sheet = getOrCreateSheet('GuestBook', [
    'Timestamp', 'Name', 'Message'
  ]);

  sheet.appendRow([
    new Date().toLocaleString(),
    params.name || '',
    params.message || ''
  ]);

  return { success: true, message: 'Guest book signed!' };
}

function getGuestBook() {
  var sheet = getOrCreateSheet('GuestBook', [
    'Timestamp', 'Name', 'Message'
  ]);

  var data = sheet.getDataRange().getValues();
  var entries = [];

  // Skip header row
  for (var i = 1; i < data.length; i++) {
    entries.push({
      timestamp: data[i][0],
      name: data[i][1],
      message: data[i][2]
    });
  }

  // Newest first
  entries.reverse();

  return { success: true, entries: entries };
}

/* ─── Song Requests ─── */

function submitSongRequest(params) {
  var sheet = getOrCreateSheet('SongRequests', [
    'Timestamp', 'Requested By', 'Song', 'Artist', 'Spotify ID', 'Album Art'
  ]);

  sheet.appendRow([
    new Date().toLocaleString(),
    params.name || 'Anonymous',
    params.song || '',
    params.artist || '',
    params.spotifyId || '',
    params.albumArt || ''
  ]);

  return { success: true, message: 'Song added to the playlist!' };
}

function getSongRequests() {
  var sheet = getOrCreateSheet('SongRequests', [
    'Timestamp', 'Requested By', 'Song', 'Artist', 'Spotify ID', 'Album Art'
  ]);

  var data = sheet.getDataRange().getValues();
  var entries = [];

  for (var i = 1; i < data.length; i++) {
    entries.push({
      timestamp: data[i][0],
      name: data[i][1],
      song: data[i][2],
      artist: data[i][3],
      spotifyId: data[i][4],
      albumArt: data[i][5]
    });
  }

  entries.reverse();

  return { success: true, entries: entries };
}

/* ─── Photos ─── */

function submitPhoto(params) {
  var sheet = getOrCreateSheet('Photos', [
    'Timestamp', 'Uploaded By', 'Photo URL', 'Caption'
  ]);

  sheet.appendRow([
    new Date().toLocaleString(),
    params.name || 'Anonymous',
    params.url || '',
    params.caption || ''
  ]);

  return { success: true, message: 'Photo uploaded!' };
}

function getPhotos() {
  var sheet = getOrCreateSheet('Photos', [
    'Timestamp', 'Uploaded By', 'Photo URL', 'Caption'
  ]);

  var data = sheet.getDataRange().getValues();
  var entries = [];

  for (var i = 1; i < data.length; i++) {
    entries.push({
      timestamp: data[i][0],
      name: data[i][1],
      url: data[i][2],
      caption: data[i][3]
    });
  }

  entries.reverse();

  return { success: true, entries: entries };
}
