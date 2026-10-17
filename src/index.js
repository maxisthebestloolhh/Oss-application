
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

  // Full question wording for the Discord application embed.
  const fields = [
    {
      name: "1. Roblox Username",
      key: "roblox",
      required: true,
    },
    {
      name: "2. Discord Username",
      key: "discord",
      required: true,
    },
    {
      name: "3. What is your timezone?",
      key: "timezone",
      required: true,
    },
    {
      name: "4. What is your availability?",
      key: "availability",
      required: true,
    },
    {
      name: "6. Why do you want to join the OSS?",
      key: "motivation",
      required: true,
    },
    {
      name: "7. What strengths would you bring to the OSS?",
      key: "strengths",
      required: true,
    },
    {
      name: "8. Describe a mistake you made and what you learned from it.",
      key: "mistake",
      required: true,
    },
    {
      name: "9. How would you demonstrate commitment to the OSS?",
      key: "commitment",
      required: true,
    },
    {
      name: "10. What would you do if accounts gave conflicting information?",
      key: "conflicting",
      required: true,
    },
    {
      name: "11. How would you judge the reliability of a source?",
      key: "sourcequality",
      required: true,
    },
    {
      name: "12. How would you recognise and reduce bias?",
      key: "bias",
      required: true,
    },
    {
      name: "13. How would you communicate uncertainty and confidence?",
      key: "confidence",
      required: true,
    },
    {
      name: "14. How would you handle the evidence scenario?",
      key: "scenario",
      required: true,
    },
    {
      name: "15. How would you prioritise urgent tasks?",
      key: "urgent",
      required: true,
    },
    {
      name: "16. What would you do if someone requested unauthorised information?",
      key: "restricted",
      required: true,
    },
    {
      name: "17. What would you do if you observed member misconduct?",
      key: "misconduct",
      required: true,
    },
    {
      name: "18. What would you do if pressured to change a report?",
      key: "pressure",
      required: true,
    },
    {
      name: "19. How would you write a clear and factual report?",
      key: "report",
      required: true,
    },
    {
      name: "20. How would you write a concise summary?",
      key: "summary",
      required: true,
    },
    {
      name: "21. How would you protect confidential information?",
      key: "privacy",
      required: true,
    },
    {
      name: "22. What would you do if you received an instruction you did not understand?",
      key: "orders",
      required: true,
    },
    {
      name: "23. What would you do if you disagreed with a superior?",
      key: "disagreement",
      required: true,
    },
    {
      name: "24. What would you do if you accidentally shared information?",
      key: "confidentiality",
      required: true,
    },
    {
      name: "25. How would you balance speed and accuracy?",
      key: "priorities",
      required: true,
    },
    {
      name: "26. Is there anything else you would like us to know?",
      key: "finalnotes",
      required: false,
    },
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

  const embed = {
    title: "New OSS Recruitment Application",
    description:
      `**Applicant:** ${username}\n` +
      `**Application ID:** ${applicationId}`,
    color: 0xC9A227,
    fields: answers.map((answer) => ({
      name: answer.name,
      value: answer.value || "Not provided (optional)",
      inline: false,
    })),
    footer: {
      text: "OSS Recruitment Division • Community Recruitment Project",
    },
    timestamp: new Date().toISOString(),
  };

  // Discord allows at most 25 fields and 6000 combined embed characters.
  const totalEmbedCharacters =
    (embed.title?.length || 0) +
    (embed.description?.length || 0) +
    (embed.footer?.text?.length || 0) +
    embed.fields.reduce(
      (total, field) => total + field.name.length + field.value.length,
      0
    );

  if (embed.fields.length > 25 || totalEmbedCharacters > 6000) {
    return respond(400, {
      error:
        "This application exceeds Discord's single-embed limits. Shorten some answers or use a different delivery format.",
    });
  }

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

  return respond(200, {
    success: true,
    applicationId,
    message: "Application submitted successfully.",
  });
}
