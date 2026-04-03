// Netlify Serverless Function: iCal Import Proxy
// Fetches an external iCal feed, parses it, returns blocked dates
// URL: /api/sync?ical=ENCODED_ICAL_URL&bin=BIN_ID

export default async (request, context) => {
  const url = new URL(request.url);
  const icalUrl = url.searchParams.get("ical");
  const binId = url.searchParams.get("bin");
  const API_KEY = Netlify.env.get("JSONBIN_API_KEY");

  if (!icalUrl) {
    return Response.json({ error: "?ical= Parameter fehlt" }, { status: 400 });
  }

  try {
    // 1. Fetch the external iCal feed
    const icalRes = await fetch(icalUrl, {
      headers: { "User-Agent": "BookSync/1.0" }
    });
    if (!icalRes.ok) throw new Error("iCal-Feed nicht erreichbar: " + icalRes.status);
    const icalText = await icalRes.text();

    // 2. Parse iCal → extract blocked date ranges
    const importedDates = parseICal(icalText);

    // 3. If binId provided, merge into existing bin
    if (binId && API_KEY) {
      // Read current data
      const readRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest?meta=false`, {
        headers: { "X-Master-Key": API_KEY }
      });
      let existing = [];
      if (readRes.ok) {
        const data = await readRes.json();
        existing = data.blocked || [];
      }

      // Merge: combine existing + imported, deduplicate
      const merged = [...new Set([...existing, ...importedDates])].sort();

      // Write back
      const writeRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
        body: JSON.stringify({ blocked: merged })
      });
      if (!writeRes.ok) throw new Error("Speichern fehlgeschlagen: " + writeRes.status);

      return Response.json({
        success: true,
        imported: importedDates.length,
        total: merged.length,
        newDates: importedDates.filter(d => !existing.includes(d)),
        blocked: merged
      }, {
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // No bin — just return parsed dates
    return Response.json({
      success: true,
      imported: importedDates.length,
      dates: importedDates
    }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });

  } catch (e) {
    return Response.json({ error: e.message }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};

// ============ iCal Parser ============
function parseICal(text) {
  const dates = new Set();
  const events = text.split("BEGIN:VEVENT");

  for (let i = 1; i < events.length; i++) {
    const event = events[i].split("END:VEVENT")[0];

    // Extract DTSTART
    const startMatch = event.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/);
    // Extract DTEND
    const endMatch = event.match(/DTEND[^:]*:(\d{4})(\d{2})(\d{2})/);

    if (startMatch) {
      const startDate = new Date(
        parseInt(startMatch[1]),
        parseInt(startMatch[2]) - 1,
        parseInt(startMatch[3])
      );

      let endDate;
      if (endMatch) {
        endDate = new Date(
          parseInt(endMatch[1]),
          parseInt(endMatch[2]) - 1,
          parseInt(endMatch[3])
        );
      } else {
        // If no end date, assume 1 day
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
      }

      // Add all dates in range (DTEND is exclusive in iCal)
      const current = new Date(startDate);
      while (current < endDate) {
        const ds = current.getFullYear() + '-' +
          String(current.getMonth() + 1).padStart(2, '0') + '-' +
          String(current.getDate()).padStart(2, '0');
        dates.add(ds);
        current.setDate(current.getDate() + 1);
      }
    }
  }

  return [...dates].sort();
}
