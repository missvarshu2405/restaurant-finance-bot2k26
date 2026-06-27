// ============================================
// Gemini AI Service — Server-side only
// Handles bill extraction with 8-model fallback
// API key secured in .env, never exposed to client
// ============================================

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

const EXTRACTION_PROMPT = `You are a precise bill/invoice data extraction AI for an Indian restaurant expense management system.
Restaurants receive diverse bills — grocery, produce, dairy, meat, dry goods, beverages, packaging supplies, gas cylinders, cleaning materials, electrical/plumbing repairs, utility bills (water/electricity), rent receipts, staff uniforms, marketing printouts, and even handwritten kaccha bills from local vendors.

Extract data from this bill image. Return ONLY a JSON object with these exact fields:
{
  "vendor_name": "string — the vendor/shop/supplier name exactly as printed",
  "bill_date": "YYYY-MM-DD — the date ON the bill, NOT today's date. Parse DD/MM/YY, DD-MM-YYYY, DD.MM.YYYY etc.",
  "bill_number": "string — invoice/bill/receipt number",
  "vendor_gstin": "string — GSTIN if visible (15-char alphanumeric like 29AAHCT1234R1ZR)",
  "vendor_contact": "string — phone number if visible",
  "hsn_code": "string — HSN/SAC code if visible",
  "fssai_number": "string — FSSAI license number if visible",
  "category": "one of: produce, dairy, meat_seafood, dry_goods, beverages, packaging, fuel_gas, cleaning, maintenance, electricity, water, rent, staff_wages, marketing, miscellaneous",
  "payment_mode": "one of: cash, upi, card, credit — look for 'Paid via UPI/GPay/PhonePe/Paytm' or 'Card' or 'Cash' or 'Credit/Udhar'",
  "items": [{"description": "item name", "qty": number, "unit": "kg/ltr/pcs/box/pack/dozen/bundle/bag/can/bottle", "rate": number, "amount": number}],
  "subtotal": number (sum of line item amounts BEFORE any discount or tax),
  "discount_percent": number (discount percentage if mentioned, e.g. 30 for 30% off, or 0),
  "discount_amount": number (absolute discount amount in ₹ — if percentage shown, calculate: subtotal × discount_percent / 100),
  "taxable_amount": number (subtotal minus discount_amount — this is the base for GST),
  "gst_rate": number (the actual GST rate — look for CGST%+SGST% or IGST%, common rates: 0, 5, 12, 18, 28),
  "cgst": number (CGST amount — extract the EXACT amount printed on the bill, do NOT recalculate),
  "sgst": number (SGST amount — extract the EXACT amount printed on the bill, do NOT recalculate),
  "igst": number (IGST amount if applicable),
  "round_off": number (round-off adjustment if shown, can be positive or negative),
  "total_amount": number (the FINAL grand total / net payable amount — the amount actually paid),
  "confidence": {
    "overall": number (0-1),
    "vendor_name": number (0-1),
    "bill_date": number (0-1),
    "total_amount": number (0-1),
    "category": number (0-1),
    "payment_mode": number (0-1)
  }
}

CRITICAL RULES:
1. TOTAL AMOUNT: Always use the FINAL "Grand Total" / "Net Amount" / "Total Payable" / "Bill Amount" shown on the bill. This is the amount the customer actually pays. Do NOT recalculate it — read it directly.
2. DISCOUNTS: Many bills have discounts (% off, flat ₹ off, scheme discounts). Extract both the percentage and absolute amount. If only one is shown, calculate the other.
3. GST AMOUNTS: Extract CGST and SGST amounts EXACTLY as printed on the bill. Do NOT recalculate them. If the bill shows "CGST 2.5% = ₹9.73", use 9.73 — not a recalculated value.
4. GST RATE: If CGST 2.5% + SGST 2.5% is shown, gst_rate = 5. If CGST 9% + SGST 9%, gst_rate = 18.
5. DATES: Parse Indian date formats (DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY). If year is 2-digit (e.g. 26), assume 2026. If no year visible, use 2026.
6. LANGUAGE: Handle bills in Hindi, Marathi, Tamil, Kannada, Telugu, Bengali, Gujarati etc.
7. HANDWRITTEN BILLS: Many local vendors use handwritten/kaccha bills. Extract whatever is legible — partial extraction is fine if some fields are readable. If the bill is completely illegible or unreadable (blurry, blank, not a bill, total_amount cannot be determined at all), DO NOT guess or invent values. Instead set "vendor_name" to the exact string "EXTRACTION_FAILED" and leave all other fields at their default empty/0 values. DO NOT explain or apologize — you MUST still return valid JSON in this exact format, just with "EXTRACTION_FAILED" as the vendor_name signal.
8. If a field is not visible or not applicable, use empty string "" for text, 0 for numbers.
9. Return ONLY the JSON object — no markdown fences, no explanations. You must never return plain text.`;

async function callGeminiAPI(apiKey, model, imageBase64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [
        { text: EXTRACTION_PROMPT },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${model}): ${response.status} — ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON in Gemini response');
  }

  return JSON.parse(jsonMatch[0]);
}

export async function extractBillData(imageBase64) {
  const primaryKey = process.env.GEMINI_API_KEY;
  const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK;
  const fallbackKey2 = process.env.GEMINI_API_KEY_FALLBACK_2;
  const keys = [primaryKey, fallbackKey, fallbackKey2].filter(Boolean);

  if (keys.length === 0) {
    console.error('❌ No Gemini API key configured! Set GEMINI_API_KEY in backend/.env');
    throw new Error('No Gemini API key configured. Please set GEMINI_API_KEY in the backend .env file. Get a free key at https://aistudio.google.com/apikey');
  }

  console.log(`🔑 ${keys.length} Gemini API key(s) available for rotation`);

  const errors = [];

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const key = keys[keyIdx];
    const keyLabel = `key-${keyIdx + 1}`;
    let keyExhausted = false;

    for (const model of GEMINI_MODELS) {
      if (keyExhausted) break; // Skip to next key if this one is rate-limited

      try {
        console.log(`🔄 Trying ${model} with ${keyLabel}...`);
        const result = await callGeminiAPI(key, model, imageBase64);

        // Gemini explicitly signals "couldn't read this bill" via this sentinel value
        // instead of guessing — treat it as a real failure, not a success
        if (result.vendor_name === 'EXTRACTION_FAILED') {
          throw new Error('AI determined bill is illegible — no data could be extracted');
        }

        // Ensure confidence object exists
        if (!result.confidence) {
          result.confidence = { overall: 0.7, vendor_name: 0.7, bill_date: 0.7, total_amount: 0.7, category: 0.5, payment_mode: 0.5 };
        }

        // Default bill_date to today if empty
        if (!result.bill_date) {
          result.bill_date = new Date().toISOString().split('T')[0];
        }

        console.log(`✅ Extraction successful with ${model} (${keyLabel})`);
        return result;
      } catch (err) {
        const errMsg = err.message.substring(0, 120); // Truncate for cleaner logs
        errors.push(`${keyLabel}/${model}: ${errMsg}`);

        // If rate-limited (429), skip to next key immediately
        if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('quota')) {
          console.warn(`⚠️ ${keyLabel} rate-limited on ${model} — switching to next key`);
          keyExhausted = true;
        } else if (err.message.includes('404')) {
          console.warn(`⚠️ ${model} not found — trying next model`);
        } else {
          console.warn(`❌ ${model} failed: ${errMsg}`);
        }
      }
    }
  }

  throw new Error(`All Gemini models/keys failed. Errors:\n${errors.slice(0, 6).join('\n')}`);
}

export { GEMINI_MODELS };
