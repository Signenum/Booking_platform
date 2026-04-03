// Netlify Serverless Function: iCal Feed
// URL: https://your-site.netlify.app/feed.ics?bin=BIN_ID

export default async (request, context) => {
  const url = new URL(request.url);
  const BIN_ID = url.searchParams.get("bin");
  const API_KEY = Netlify.env.get("JSONBIN_API_KEY");

  if (!BIN_ID || !API_KEY) {
    return new Response("iCal Feed: ?bin= Parameter oder JSONBIN_API_KEY fehlt.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest?meta=false`, {
      headers: { "X-Master-Key": API_KEY }
    });

    if (!res.ok) throw new Error(`JSONBin error: ${res.status}`);
    const data = await res.json();
    const blocked = (data.blocked || []).sort();

    const events = [];
    let i = 0;
    while (i < blocked.length) {
      let start = blocked[i];
      let end = blocked[i];
      while (i + 1 < blocked.length && isNextDay(blocked[i], blocked[i + 1])) {
        i++;
        end = blocked[i];
      }
      const endDate = new Date(end + "T00:00:00Z");
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const endStr = endDate.toISOString().split("T")[0].replace(/-/g, "");

      events.push(
        `BEGIN:VEVENT\r\n` +
        `DTSTART;VALUE=DATE:${start.replace(/-/g, "")}\r\n` +
        `DTEND;VALUE=DATE:${endStr}\r\n` +
        `SUMMARY:Nicht verfügbar\r\n` +
        `STATUS:CONFIRMED\r\n` +
        `TRANSP:OPAQUE\r\n` +
        `UID:${start}-${end}@booksync\r\n` +
        `DTSTAMP:${stamp()}\r\n` +
        `END:VEVENT`
      );
      i++;
    }

    const ics =
      `BEGIN:VCALENDAR\r\n` +
      `VERSION:2.0\r\n` +
      `PRODID:-//BookSync//Belegungszentrale//DE\r\n` +
      `CALSCALE:GREGORIAN\r\n` +
      `METHOD:PUBLISH\r\n` +
      `X-WR-CALNAME:Unterkunft Belegung\r\n` +
      `X-WR-TIMEZONE:Europe/Berlin\r\n` +
      events.join("\r\n") + (events.length ? "\r\n" : "") +
      `END:VCALENDAR`;

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="verfuegbarkeit.ics"',
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return new Response("Fehler: " + e.message, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
};

function isNextDay(a, b) {
  const d = new Date(a + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0] === b;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
