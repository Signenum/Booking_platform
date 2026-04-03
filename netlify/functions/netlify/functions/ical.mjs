// Netlify Serverless Function: iCal Feed
// Returns blocked dates as a proper .ics calendar file
// URL: https://your-site.netlify.app/feed.ics

export default async (request, context) => {
  const BIN_ID = Netlify.env.get("JSONBIN_BIN_ID");
  const API_KEY = Netlify.env.get("JSONBIN_API_KEY");

  if (!BIN_ID || !API_KEY) {
    return new Response("iCal Feed nicht konfiguriert. Bitte JSONBIN_BIN_ID und JSONBIN_API_KEY in Netlify Environment Variables setzen.", {
      status: 500,
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

    // Group consecutive dates into events
    const events = [];
    let i = 0;
    while (i < blocked.length) {
      let start = blocked[i];
      let end = blocked[i];
      while (i + 1 < blocked.length && isNextDay(blocked[i], blocked[i + 1])) {
        i++;
        end = blocked[i];
      }
      // iCal DTEND is exclusive
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
        `DTSTAMP:${now()}\r\n` +
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
      `X-WR-CALNAME:Gruppenunterkunft Belegung\r\n` +
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
    return new Response("Fehler beim Laden der Daten: " + e.message, {
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

function now() {
  return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
