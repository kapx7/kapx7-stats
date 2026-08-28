// Fetches follower counts for KAPx7's Spotify playlists and writes
// followers.json. Runs on a schedule via GitHub Actions (see the
// accompanying workflow file). No secrets are ever exposed to the website.

const PLAYLISTS = [
  { id: "2IKqGFIf9ZmmvGo28VnaUu", name: "Indie Injection", group: "own" },
  { id: "3LCIojD65vtzpQ9hfzjQjP", name: "Rap Reign", group: "own" },
  { id: "7L7mvbDZ5jffsXxZFCJNK1", name: "Focus State", group: "own" },
  { id: "3XY5G4aKMF3P6Hgdre9oi1", name: "Echo Indie", group: "partner" },
  { id: "63CMbhT009coXMekfIesra", name: "Echo Rap", group: "partner" },
  { id: "1yl9U3a2ZhASwKgGrZoWmC", name: "Half Awake", group: "partner" },
];

const fs = require("fs");
const path = require("path");

async function getAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function getPlaylistData(playlistId, token) {
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,followers.total`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(`Playlist ${playlistId} fetch failed: ${res.status}`);
  const data = await res.json();
  return { followers: data.followers?.total ?? 0, name: data.name };
}

async function main() {
  const token = await getAccessToken();
  const outputPath = path.join(__dirname, "followers.json");

  // Preserve any manually-maintained fields (e.g. an estimated_listeners
  // number you update yourself, since Spotify doesn't expose that publicly).
  let existing = {};
  if (fs.existsSync(outputPath)) {
    existing = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  }

  const playlists = [];
  for (const p of PLAYLISTS) {
    const { followers, name } = await getPlaylistData(p.id, token);
    playlists.push({ id: p.id, name: name || p.name, group: p.group, followers });
  }

  const total_followers = playlists.reduce((sum, p) => sum + p.followers, 0);
  const own_followers = playlists
    .filter((p) => p.group === "own")
    .reduce((s, p) => s + p.followers, 0);
  const partner_followers = playlists
    .filter((p) => p.group === "partner")
    .reduce((s, p) => s + p.followers, 0);

  const output = {
    ...existing,
    total_followers,
    own_followers,
    partner_followers,
    playlist_count: playlists.length,
    playlists,
    updated_at: new Date().toISOString(),
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log("Updated followers.json:", output);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
