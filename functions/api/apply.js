
export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    // Basic bot protection
    if (data.website) {
      return json({ ok: true, applicationId: "OSS-RECEIVED" });
    }

    const required = [
      "roblox",
      "discord",
      "timezone",
      "motivation",
      "experience",
      "scenario",
      "conduct",
      "availability",
    ];

    for (const key of required) {
      if (typeof data[key] !== "string") {
        return json({ error: `Missing field: ${key}` }, 400);
      }
    }

    if (
      data.roblox.length < 3 ||
      data.motivation.length < 30 ||
      data.scenario.length < 30 ||
      data.conduct.length < 20 ||
      data.motivation.length > 1500 ||
      data.scenario.length > 1500 ||
      data.conduct.length > 1500
    ) {
      return json({ error: "Please check your answers and try again." }, 400);
    }

    if (data.confirm !== true) {
      return json({ error: "Please confirm your application." }, 400);
    }

    if (!env.OSS_DISCORD_WEBHOOK) {
      return json({ error: "Server is not configured yet." }, 500);
    }

    const applicationId =
      "OSS-" +
      new Date().getUTCFullYear() +
      "-" +
      crypto.randomUUID().slice(0, 8).toUpperCase();

    const fields = [
      ["Roblox Username", data.roblox],
      ["Discord Username", data.discord],
      ["Timezone", data.timezone],
      ["Availability", data.availability],
      ["Experience", data.experience || "Not provided"],
      ["Motivation", data.motivation],
      ["Conflicting Reports Scenario", data.scenario],
      ["Information Sharing Scenario", data.conduct],
    ].map(([name, value]) => ({
      name,
      value: String(value).slice(0, 1024),
      inline: false,
    }));

    const response = await fetch(env.OSS_DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "OSS Recruitment Portal",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: "New OSS Application",
            description: `Application Reference: ${applicationId}`,
            color: 0xc8a64b,
            fields,
            footer: {
              text: "Office of Strategic Services • Recruitment",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      return json({ error: "Failed to deliver application to Discord." }, 502);
    }

    return json({ ok: true, applicationId });
  } catch {
    return json({ error: "Invalid request. Please try again." }, 400);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
            }
