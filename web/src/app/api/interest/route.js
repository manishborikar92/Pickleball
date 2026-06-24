import { NextResponse } from "next/server";

const PAGECLIP_SITE_KEY = "M6xW7YlgRqD6fmxtTWdcxaegUQLfFYuc";
const PAGECLIP_FORM_NAME = "waitlist";

export async function POST(req) {
  try {
    const data = await req.json();

    // Convert JSON to URL-encoded form data, as expected by Pageclip's public endpoint
    const formData = new URLSearchParams();
    for (const key in data) {
      formData.append(key, data[key]);
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const userAgent = req.headers.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    // Send the data from the server
    const res = await fetch(`https://send.pageclip.co/${PAGECLIP_SITE_KEY}/${PAGECLIP_FORM_NAME}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": origin,
        "Referer": `${origin}/`,
        "User-Agent": userAgent,
      },
      body: formData.toString(),
      redirect: "manual", // Prevent Next.js from following the redirect
    });

    // Pageclip returns 302 Found on successful form submission
    if (res.ok || res.status === 302 || res.status === 303) {
      return NextResponse.json({ success: true });
    } else {
      const errorText = await res.text();
      console.error("Pageclip Error:", res.status, errorText);
      return NextResponse.json(
        { error: "Submission failed at origin.", details: errorText },
        { status: res.status }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
