// Fortumore Digital Cards - Cloudflare Worker
// This file is stored in GitHub for version control
// The actual worker is deployed at: https://yellow-heart-3cc9.fortumore-global.workers.dev

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/profile/:username - Fetch profile data
    if (path.startsWith('/api/profile/') && request.method === 'GET') {
      const username = path.replace('/api/profile/', '');
      
      try {
        const { results } = await env.DB.prepare(
          'SELECT * FROM profiles WHERE username = ?'
        ).bind(username).all();

        if (!results || results.length === 0) {
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: corsHeaders,
          });
        }

        const profile = results[0];
        profile.socials = JSON.parse(profile.socials || '{}');
        profile.sections = JSON.parse(profile.sections || '[]');

        return new Response(JSON.stringify(profile), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // POST /api/profile/:username - Create/Update profile
    if (path.startsWith('/api/profile/') && request.method === 'POST') {
      const username = path.replace('/api/profile/', '');
      const token = request.headers.get('Authorization')?.replace('Bearer ', '');

      if (token !== 'sk-fortumore-default-token') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const data = await request.json();

        await env.DB.prepare(`
          INSERT INTO profiles (username, name, title, company, location, phone, whatsapp, email, image, portfolioPdf, mapUrl, themeColor, secondaryColor, tagline, socials, sections)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET
          name=excluded.name, title=excluded.title, company=excluded.company, location=excluded.location, phone=excluded.phone, whatsapp=excluded.whatsapp, email=excluded.email, image=excluded.image, portfolioPdf=excluded.portfolioPdf, mapUrl=excluded.mapUrl, themeColor=excluded.themeColor, secondaryColor=excluded.secondaryColor, tagline=excluded.tagline, socials=excluded.socials, sections=excluded.sections
        `).bind(
          data.username,
          data.name,
          data.title,
          data.company,
          data.location,
          data.phone,
          data.whatsapp,
          data.email,
          data.image,
          data.portfolioPdf,
          data.mapUrl,
          data.themeColor,
          data.secondaryColor,
          data.tagline,
          JSON.stringify(data.socials),
          JSON.stringify(data.sections)
        ).run();

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Default response for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  },
};
