// ============================================
// Supabase Storage Service — Bill Image Uploads
// Falls back to base64 data URL if unavailable
// ============================================

import { createClient } from '@supabase/supabase-js';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const BUCKET_NAME = 'bill-images';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Upload a bill image to Supabase Storage.
 * @param {Buffer} buffer - The image file buffer
 * @param {string} originalName - Original filename (for extension)
 * @returns {string} The public URL of the uploaded image
 */
export async function uploadBillImage(buffer, originalName) {
  if (!supabase) {
    // Fallback: convert to base64 data URL (works but images aren't persisted separately)
    const ext = path.extname(originalName).toLowerCase();
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
    const mime = mimeMap[ext] || 'image/jpeg';
    console.warn('⚠️ Supabase Storage not configured — using base64 fallback');
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const uniqueName = `bill-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filePath = `uploads/${uniqueName}`;

  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  const contentType = mimeMap[ext] || 'image/jpeg';

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error('Supabase Storage upload error:', error.message);
    throw new Error(`Image upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  console.log(`📸 Image uploaded: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}
