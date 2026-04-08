export default async function handler(req, res) {
  const cloud = 'dj4doqq1u';
  const preset = 'wedding';

  // Check if we already uploaded
  // Force regenerate by using a versioned public_id

  // Upload SVG as PNG to Cloudinary
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#f5f0eb"/>
    <circle cx="600" cy="220" r="70" fill="none" stroke="#c9a96e" stroke-width="2"/>
    <circle cx="600" cy="220" r="62" fill="none" stroke="#c9a96e" stroke-width="1" opacity="0.4"/>
    <text x="570" y="235" font-family="Georgia, serif" font-size="42" fill="#c9a96e" font-style="italic">T</text>
    <text x="594" y="228" font-family="Georgia, serif" font-size="18" fill="#c9a96e" font-style="italic" opacity="0.7">&amp;</text>
    <text x="608" y="235" font-family="Georgia, serif" font-size="42" fill="#c9a96e" font-style="italic">C</text>
    <text x="600" y="360" font-family="Georgia, serif" font-size="52" fill="#1a1512" font-style="italic" text-anchor="middle">Tristen &amp; Chloe&apos;</text>
    <line x1="520" y1="390" x2="680" y2="390" stroke="#c9a96e" stroke-width="1"/>
    <text x="600" y="430" font-family="Arial, sans-serif" font-size="18" fill="#5c4f3d" text-anchor="middle" letter-spacing="6">YOU RE INVITED</text>
    <text x="600" y="470" font-family="Georgia, serif" font-size="22" fill="#7a6d5c" text-anchor="middle">June 13, 2026</text>
  </svg>`;

  try {
    const formData = new URLSearchParams();
    formData.append('file', 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'));
    formData.append('upload_preset', preset);
    formData.append('public_id', 'og-preview-v2');

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await uploadRes.json();

    if (data.secure_url) {
      // Redirect to the PNG version
      const pngUrl = data.secure_url.replace(/\.\w+$/, '.png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.redirect(302, pngUrl);
    } else {
      res.status(500).json({ error: 'Upload failed', details: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
