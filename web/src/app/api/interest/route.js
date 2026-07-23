import { NextResponse } from "next/server";
import { validateName, validatePhone } from "@/lib/validation";

const GOOGLE_SHEETS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyuVhY5xBVMTFgFcPUx_EnwohO4TkGSaR9YOlhUVb8CZd_-YwiT_5tbwZnPu29fVgkv/exec";

export async function POST(req) {
  try {
    const body = await req.json();
    const nameValidation = validateName(body?.name);
    const phoneValidation = validatePhone(body?.phone);

    if (!nameValidation.ok) {
      return NextResponse.json(
        { error: nameValidation.message },
        { status: 400 }
      );
    }

    if (!phoneValidation.ok) {
      return NextResponse.json(
        { error: phoneValidation.message },
        { status: 400 }
      );
    }

    const payload = {
      name: nameValidation.value,
      phone: phoneValidation.value,
    };

    try {
      const res = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
        redirect: "follow",
      });

      if (!res.ok) {
        console.warn("Google Sheets endpoint returned HTTP status:", res.status);
      }
    } catch (fetchErr) {
      console.error("Network error submitting to Google Sheets:", fetchErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Interest form API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}


