export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle application submissions
    if (url.pathname === "/api/apply" && request.method === "POST") {
      return handleApplication(request, env);
    }

    // Serve the website and static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Website assets are not configured.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};

async function handleApplication(request, env) {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  const respond = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: corsHeaders,
    });

  if (request.method !== "POST") {
    return respond(405, { error: "Method not allowed." });
  }

  if (!env.OSS_DISCORD_WEBHOOK) {
    return respond(500, {
      error: "Applications are temporarily unavailable.",
    });
  }

  let data;

  try {
    data = await request.json();
  } catch {
    return respond(400, { error: "Invalid application data." });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return respond(400, { error: "Invalid application data." });
  }

  // Honeypot field to discourage automated spam
  if (data.website) {
    return respond(200, {
      success: true,
      message: "Application received.",
    });
  }

  const fields = [
    ["Roblox Username", data.roblox],
    ["Discord Username", data.discord],
    ["Timezone", data.timezone],
    ["Motivation", data.motivation],
    ["Experience", data.experience],
    ["Scenario Response", data.scenario],
    ["Conduct", data.conduct],
    ["Availability", data.availability],
  ];

  const clean = (value, maxLength = 1500) =>
    typeof value === "string"
      ? value.trim().slice(0, maxLength)
      : "";

  const values = fields.map(([name, value]) => ({
    name,
    value: clean(value),
  }));

  const missing = values.some((field) => !field.value);

  if (missing) {
    return respond(400, {
      error: "Please complete all required fields.",
    });
  }

  if (data.confirm !== true && data.confirm !== "true" &&
      data.confirm !== "on") {
    return respond(400, {
      error: "Please confirm your application details.",
    });
  }

  const applicationId = crypto.randomUUID();

  const embed = {
    title: "New OSS Application",
    color: 0xC9A227,
    fields: values.map((field) => ({
      name: field.name,
      value: field.value,
      inline: false,
    })),
    footer: {
      text: `OSS Applications • ID: ${applicationId}`,
    },
    timestamp: new Date().toISOString(),
  };

  let discordResponse;

  try {
    discordResponse = await fetch(env.OSS_DISCORD_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [embed],
      }),
    });
  } catch {
    return respond(502, {
      error: "Could not submit your application. Please try again later.",
    });
  }

  if (!discordResponse.ok) {
    return respond(502, {
      error: "Could not submit your application. Please try again later.",
    });
  }

  return respond(200, {
    success: true,
    applicationId,
    message: "Application submitted successfully.",
  });
}
