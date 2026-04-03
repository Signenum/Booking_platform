// Netlify Serverless Function: JSON Feed
// URL: https://your-site.netlify.app/feed.json?bin=BIN_ID

export default async (request, context) => {
  const url = new URL(request.url);
  const BIN_ID = url.searchParams.get("bin");
  const API_KEY = Netlify.env.get("JSONBIN_API_KEY");

  if (!BIN_ID || !API_KEY) {
    return Response.json({ error: "?bin= Parameter oder API Key fehlt" }, { status: 400 });
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
