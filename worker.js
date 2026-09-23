// Fortumore Cloudflare Worker
// Handles profile data retrieval and updates to D1 database

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /api/profile/:username - Retrieve profile data
      if (request.method === 'GET' && path.startsWith('/api/profile/')) {
        const username = path.split('/').pop();
        const db = env.DB;

        const profile = await db
          .prepare('SELECT * FROM profiles WHERE username = ?1')
          .bind(username)
          .first();

        if (!profile) {
          return new Response(
            JSON.stringify({ error: 'Profile not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Parse JSON fields
        const data = {
          ...profile,
          socials: profile.socials ? JSON.parse(profile.socials) : {},
          sections: profile.sections ? JSON.parse(profile.sections) : [],
        };

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // POST /api/profile/:username/edit - Update profile (admin only)
      if (request.method === 'POST' && path.endsWith('/edit')) {
        const username = path.split('/')[3];
        const adminToken = request.headers.get('Authorization');

        // Simple token validation (use env.ADMIN_TOKEN for security)
        if (adminToken !== `Bearer ${env.ADMIN_TOKEN}`) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await request.json();
        const { profilePicture, tagline } = body;
        const db = env.DB;

        await db
          .prepare('UPDATE profiles SET image = ?1, tagline = ?2 WHERE username = ?3')
          .bind(profilePicture, tagline, username)
          .run();

        return new Response(
          JSON.stringify({ success: true, message: 'Profile updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /api/admin/edit/:username - Admin edit page
      if (request.method === 'GET' && path.startsWith('/api/admin/edit/')) {
        const username = path.split('/').pop();
        return new Response(getEditFormHTML(username), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Server error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};

// HTML for admin edit form
function getEditFormHTML(username) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Profile - Fortumore</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-4">
    <div class="max-w-md mx-auto mt-10">
        <h1 class="text-2xl font-bold mb-6">Edit Profile: ${username}</h1>
        
        <div id="edit-form" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
                <label class="block text-sm font-medium mb-2">Profile Picture URL</label>
                <input type="url" id="profilePic" placeholder="https://..." class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100">
            </div>

            <div>
                <label class="block text-sm font-medium mb-2">Tagline/Bio</label>
                <textarea id="tagline" rows="3" placeholder="Brief description..." class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"></textarea>
            </div>

            <button onclick="saveProfile()" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition">
                Save Changes
            </button>
        </div>

        <div id="message" class="mt-4 text-center text-sm text-slate-400"></div>
    </div>

    <script>
        const adminToken = prompt("Enter admin token:");
        
        async function loadProfile() {
            try {
                const res = await fetch(\`/api/profile/${username}\`);
                const profile = await res.json();
                document.getElementById('profilePic').value = profile.image;
                document.getElementById('tagline').value = profile.tagline;
            } catch (err) {
                document.getElementById('message').innerText = 'Error loading profile';
            }
        }

        async function saveProfile() {
            const profilePic = document.getElementById('profilePic').value;
            const tagline = document.getElementById('tagline').value;

            try {
                const res = await fetch(\`/api/profile/${username}/edit\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${adminToken}\`
                    },
                    body: JSON.stringify({ profilePicture: profilePic, tagline })
                });

                const data = await res.json();
                if (data.success) {
                    document.getElementById('message').innerText = '✓ Profile updated!';
                    document.getElementById('message').className = 'mt-4 text-center text-sm text-green-400';
                } else {
                    document.getElementById('message').innerText = 'Error: ' + data.error;
                }
            } catch (err) {
                document.getElementById('message').innerText = 'Error saving profile';
            }
        }

        loadProfile();
    </script>
</body>
</html>
  `;
}
