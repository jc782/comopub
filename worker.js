/**
 * COMO PUB CRAWL - CLOUDFLARE WORKER / SERVERLESS RELAY
 * 
 * Instructions:
 * 1. Create a free Cloudflare Worker at https://workers.cloudflare.com
 * 2. Paste this code into the Worker editor.
 * 3. In Worker Settings -> Variables -> Environment Variables, add two secrets:
 *    - GITHUB_TOKEN: A GitHub Personal Access Token (Fine-Grained token with "Contents: Read & Write" on your comopub repo)
 *    - ADMIN_PASSWORD: Your chosen secret password (e.g. "como123")
 *    - REPO_OWNER: (Optional) Your GitHub username if not passed in request
 *    - REPO_NAME: (Optional) "comopub" if not passed in request
 * 4. Save and Deploy your worker. Paste your Worker URL into your website when logging a pub!
 */

export default {
  async fetch(request, env) {
    // Enable CORS for web browser form submission
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle Preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const data = await request.json();
      const { password, name, date, location, notes, photoName, photoBase64, repoOwner, repoName } = data;

      // 1. Verify Password
      const expectedPassword = env.ADMIN_PASSWORD || 'comopubs';
      if (!password || password !== expectedPassword) {
        return new Response(JSON.stringify({ success: false, error: 'INVALID_PASSWORD' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Determine target GitHub repo
      const owner = repoOwner || env.REPO_OWNER;
      const repo = repoName || env.REPO_NAME || 'comopub';

      if (!owner) {
        return new Response(JSON.stringify({ success: false, error: 'MISSING_REPO_OWNER' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Trigger GitHub repository_dispatch event
      const ghResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'ComoPub-Worker',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'add_new_pub',
          client_payload: {
            name,
            date,
            location,
            notes,
            photoName,
            photoBase64,
          },
        }),
      });

      if (ghResponse.status === 204) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'PUB_DISPATCH_SUCCESS',
            details: `Workflow triggered for "${name}" on ${owner}/${repo}`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        const ghError = await ghResponse.text();
        return new Response(
          JSON.stringify({
            success: false,
            error: 'GITHUB_API_ERROR',
            status: ghResponse.status,
            details: ghError,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: 'SERVER_ERROR', message: err.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
