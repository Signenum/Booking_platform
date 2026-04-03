// Netlify Serverless Function: JSON Feed
// Returns blocked dates as clean JSON for website calendar plugins
// URL: https://your-site.netlify.app/feed.json

export default async (request, context) => {
  const BIN_ID = Netlify.env.get("JSONBIN_BIN_ID");
  const API_KEY = Netlify.env.get("JSONBIN_API_KEY");

  if (!BIN_ID || !API_KEY) {
    return Response.json({ error: "Nicht konfiguriert" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest?meta=false`, {
      headers: { "X-Master-Key": API_KEY }
    });

    if (!res.ok) throw new Error(`JSONBin error: ${res.status}`);
    const data = await res.json();
    const blocked = (data.blocked || []).sort();

    return Response.json(
      { blocked, updated: new Date().toISOString() },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};
