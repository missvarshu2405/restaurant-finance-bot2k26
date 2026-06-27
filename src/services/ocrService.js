// ============================================
// OCR + AI Extraction Service
// Uses Google Gemini API for image-to-structured-data
// ============================================

import { getOwner } from '../data/store.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

// Models to try in order of preference
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro',
];

const API_VERSIONS = ['v1beta', 'v1'];

const EXTRACTION_PROMPT = `You are a financial data extraction assistant for Indian restaurants.
Analyze this bill/invoice image and extract structured data.

Return ONLY valid JSON (no markdown, no code fences) with exactly these fields:
{
  "vendor_name": "string or null",
  "vendor_contact": "phone/address string or null",
  "bill_date": "YYYY-MM-DD or null",
  "bill_number": "invoice/bill number string or null",
  "vendor_gstin": "GSTIN string or null",
  "hsn_code": "HSN/SAC code string or null",
  "items": [
    {"description": "item name", "qty": 1, "unit": "kg", "rate": 100, "amount": 100}
  ],
  "subtotal": 0,
  "gst_rate": 0,
  "gst_amount": 0,
  "total_amount": 0,
  "payment_mode": "cash or upi or card or credit or null",
  "category": "one of: produce, dairy, meat_seafood, dry_goods, beverages, packaging, fuel_gas, cleaning, maintenance, electricity, water, rent, staff_wages, marketing, miscellaneous"
}

Rules:
- Extract ONLY what is visible on the bill. Do NOT guess or fabricate data.
- If a field is not found, use null.
- For items array, extract each line item individually with qty, unit, rate, and amount.
- If only total amount is visible without line items, create a single item entry with the total.
- Dates should be in YYYY-MM-DD format. If year is missing, assume current year.
- For category, choose the best match from the given options based on the items.
- For payment_mode, check for UPI/GPay/PhonePe references, card machine slips, or default to null.
- GST: Look for CGST+SGST or IGST. gst_amount is the total tax. gst_rate is the percentage.
- Currency is INR (₹). Remove currency symbols from numbers.`;

/**
 * Extract bill data from an image using Gemini API
 * @param {string} base64ImageData - Data URL (data:image/jpeg;base64,...) or raw base64
 * @returns {Promise<object>} Extracted bill data
 */
export async function extractBillData(base64ImageData) {
  const owner = getOwner();
  const primaryKey = owner.geminiApiKey;
  const fallbackKey = owner.geminiApiKeyFallback;

  if (!primaryKey && !fallbackKey) {
    throw new Error('NO_API_KEY');
  }

  // Strip the data URL prefix to get raw base64
  let rawBase64 = base64ImageData;
  let mimeType = 'image/jpeg';
  if (base64ImageData.startsWith('data:')) {
    const match = base64ImageData.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
    } else {
      rawBase64 = base64ImageData.split(',')[1] || base64ImageData;
    }
  }

  const requestBody = {
    contents: [{
      parts: [
        { text: EXTRACTION_PROMPT },
        {
          inline_data: {
            mime_type: mimeType,
            data: rawBase64,
          },
        },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  };

  // Try primary key first, fallback on rate limit
  const keysToTry = [primaryKey, fallbackKey].filter(Boolean);
  let lastError = null;

  for (const apiKey of keysToTry) {
    try {
      const result = await callGeminiAPI(apiKey, requestBody);
      return result;
    } catch (err) {
      lastError = err;
      if (err.message === 'RATE_LIMITED' && apiKey !== keysToTry[keysToTry.length - 1]) {
        console.log('Primary key rate-limited, switching to fallback key...');
        continue; // try next key
      }
      throw err; // non-rate-limit errors or last key — rethrow
    }
  }

  throw lastError;
}

/**
 * Call Gemini API with a specific key
 */
async function callGeminiAPI(apiKey, requestBody) {
  let lastError = null;

  // Try every model + API version combination until one works
  for (const version of API_VERSIONS) {
    for (const model of MODEL_CANDIDATES) {
      const url = `${GEMINI_BASE}/${version}/models/${model}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          console.log(`✅ Gemini model found: ${version}/${model}`);
          const data = await response.json();
          const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!textContent) throw new Error('EMPTY_RESPONSE');

          let jsonStr = textContent.trim();
          jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

          let extracted;
          try {
            extracted = JSON.parse(jsonStr);
          } catch (e) {
            console.error('Failed to parse AI response:', jsonStr);
            throw new Error('PARSE_ERROR');
          }
          return normalizeExtractedData(extracted);
        }

        if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        }

        // Model not found — try next
        const errData = await response.json().catch(() => ({}));
        lastError = errData?.error?.message || response.statusText;
      } catch (err) {
        if (err.message === 'RATE_LIMITED' || err.message === 'EMPTY_RESPONSE' || err.message === 'PARSE_ERROR') {
          throw err;
        }
        lastError = err.message;
      }
    }
  }

  throw new Error(`API_ERROR: ${lastError || 'No compatible model found'}`);
}

/**
 * Normalize and validate extracted bill data
 */
function normalizeExtractedData(raw) {
  const result = {
    vendorName: raw.vendor_name || '',
    vendorContact: raw.vendor_contact || '',
    billDate: '',
    billNumber: raw.bill_number || '',
    vendorGstin: raw.vendor_gstin || '',
    hsnCode: raw.hsn_code || '',
    items: [],
    subtotal: 0,
    gstRate: 0,
    gstAmount: 0,
    totalAmount: 0,
    paymentMode: '',
    category: 'miscellaneous',
  };

  // Date normalization
  if (raw.bill_date) {
    try {
      const d = new Date(raw.bill_date);
      if (!isNaN(d.getTime())) {
        result.billDate = d.toISOString().split('T')[0];
      }
    } catch { /* skip */ }
  }

  // Items
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    result.items = raw.items.map(item => ({
      description: item.description || 'Item',
      qty: parseFloat(item.qty) || 1,
      unit: item.unit || 'pcs',
      rate: parseFloat(item.rate) || 0,
      amount: parseFloat(item.amount) || 0,
    }));
    // Recalculate amounts if needed
    result.items.forEach(item => {
      if (item.amount === 0 && item.rate > 0) {
        item.amount = item.qty * item.rate;
      }
    });
  }

  // Amounts
  result.subtotal = parseFloat(raw.subtotal) || result.items.reduce((s, i) => s + i.amount, 0);
  result.gstRate = parseFloat(raw.gst_rate) || 0;
  result.gstAmount = parseFloat(raw.gst_amount) || 0;
  result.totalAmount = parseFloat(raw.total_amount) || (result.subtotal + result.gstAmount);

  // Payment mode
  const validModes = ['cash', 'upi', 'card', 'credit'];
  if (raw.payment_mode && validModes.includes(raw.payment_mode.toLowerCase())) {
    result.paymentMode = raw.payment_mode.toLowerCase();
  }

  // Category
  const validCategories = [
    'produce', 'dairy', 'meat_seafood', 'dry_goods', 'beverages', 'packaging',
    'fuel_gas', 'cleaning', 'maintenance', 'electricity', 'water', 'rent',
    'staff_wages', 'marketing', 'miscellaneous',
  ];
  if (raw.category && validCategories.includes(raw.category.toLowerCase())) {
    result.category = raw.category.toLowerCase();
  }

  return result;
}

/**
 * Get user-friendly error messages
 */
export function getErrorMessage(error) {
  const code = error.message || error;
  switch (code) {
    case 'NO_API_KEY':
      return 'Google Gemini API key not configured. Go to Settings → AI Configuration to add your key.';
    case 'INVALID_KEY':
      return 'Invalid API key. Please check your Google Gemini API key in Settings.';
    case 'RATE_LIMITED':
      return 'API rate limit reached. Please wait a minute and try again.';
    case 'EMPTY_RESPONSE':
      return 'AI could not extract data from this image. Please try a clearer photo or enter details manually.';
    case 'PARSE_ERROR':
      return 'AI response could not be parsed. Please try again or enter details manually.';
    default:
      return code.startsWith('API_ERROR:')
        ? `API Error: ${code.replace('API_ERROR: ', '')}`
        : 'Unexpected error during extraction. Please try again.';
  }
}
