
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/apply" && request.method === "POST") {
      return handleApplication(request, env);
    }

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
  const respond = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });

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

  // Honeypot: silently ignore automated spam.
  if (data.website) {
    return respond(200, {
      success: true,
      message: "Application received.",
    });
  }

  const clean = (value, maxLength = 500) =>
    typeof value === "string" ? value.trim().slice(0, maxLength) : "";

  const fields = [
    { name: "Roblox Username", key: "roblox", required: true },
    { name: "Discord Username", key: "discord", required: true },
    { name: "Timezone", key: "timezone", required: true },
    { name: "Availability", key: "availability", required: true },
    { name: "Previous Experience", key: "experience", required: false },
    { name: "Motivation", key: "motivation", required: true },
    { name: "Strengths", key: "strengths", required: true },
    { name: "Mistake and Learning", key: "mistake", required: true },
    { name: "Commitment", key: "commitment", required: true },
    { name: "Conflicting Accounts", key: "conflicting", required: true },
    { name: "Source Quality", key: "sourcequality", required: true },
    { name: "Bias", key: "bias", required: true },
    { name: "Uncertainty and Confidence", key: "confidence", required: true },
    { name: "Evidence Scenario", key: "scenario", required: true },
    { name: "Prioritising Tasks", key: "urgent", required: true },
    { name: "Unauthorised Information Request", key: "restricted", required: true },
    { name: "Member Misconduct", key: "misconduct", required: true },
    { name: "Pressure to Change a Report", key: "pressure", required: true },
    { name: "Report Writing", key: "report", required: true },
    { name: "Summary Writing", key: "summary", required: true },
    { name: "Confidentiality", key: "privacy", required: true },
    { name: "Unclear Instructions", key: "orders", required: true },
    { name: "Disagreement with a Superior", key: "disagreement", required: true },
    { name: "Accidentally Shared Information", key: "confidentiality", required: true },
    { name: "Speed vs Accuracy", key: "priorities", required: true },
    { name: "Additional Information", key: "finalnotes", required: false },
  ];

  const answers = fields.map((field) => ({
    name: field.name,
    value: clean(data[field.key]),
    required: field.required,
  }));

  const missing = answers.find(
    (answer) => answer.required && !answer.value
  );

  if (missing) {
    return respond(400, {
      error: `Please complete the required field: ${missing.name}.`,
    });
  }

  const isChecked = (value) =>
    value === true || value === "true" || value === "on";

  if (!isChecked(data.confirm)) {
    return respond(400, {
      error: "Please confirm your application details.",
    });
  }

  if (!isChecked(data.privacy_ack)) {
    return respond(400, {
      error: "Please confirm the privacy acknowledgement.",
    });
  }

  const applicationId = crypto.randomUUID();
  const username = clean(data.roblox, 100) || "Unknown";
  const groups = [];

  // 9 fields per message keeps each Discord embed within size limits.
  for (let i = 0; i < answers.length; i += 9) {
    groups.push(answers.slice(i, i + 9));
  }

  for (let i = 0; i < groups.length; i++) {
    const embed = {
      title: `New OSS Application — Part ${i + 1}/${groups.length}`,
      color: 0xC9A227,
      fields: groups[i].map((answer) => ({
        name: answer.name,
        value: answer.value || "Not provided (optional)",
        inline: false,
      })),
      footer: {
        text: `Applicant: ${username} • Application ID: ${applicationId}`,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const discordResponse = await fetch(env.OSS_DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [embed],
        }),
      });

      if (!discordResponse.ok) {
        return respond(502, {
          error:
            "Could not deliver the application to Discord. Please contact an administrator before retrying.",
        });
      }
    } catch {
      return respond(502, {
        error:
          "Could not deliver the application to Discord. Please contact an administrator before retrying.",
      });
    }
  }

  return respond(200, {
    success: true,
    applicationId,
    message: "Application submitted successfully.",
  });
}
