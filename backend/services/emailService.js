// ============================================
// Email Service — Nodemailer
// Daily digest, budget alerts, monthly reports
// ============================================

import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!transporter && process.env.EMAIL_ENABLED === 'true') {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`📧 [EMAIL STUB] To: ${to} | Subject: ${subject}`);
    return { stubbed: true, to, subject };
  }

  try {
    const result = await transport.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@restaurantledger.app',
      to,
      subject,
      html,
      text,
      attachments,
    });
    console.log(`📧 Email sent to ${to}: ${subject}`);
    return result;
  } catch (err) {
    console.error(`📧 Email failed to ${to}:`, err.message);
    throw err;
  }
}

export async function sendBudgetAlert({ to, branchName, percentage, total, budget }) {
  return sendEmail({
    to,
    subject: `⚠️ Budget Alert — ${branchName} at ${percentage}%`,
    html: `
      <div style="font-family: Inter, sans-serif; padding: 20px;">
        <h2>🍽️ RestaurantLedger — Budget Alert</h2>
        <p><strong>${branchName}</strong> has used <strong>${percentage}%</strong> of its daily budget.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Today's Spend</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>₹${total.toLocaleString('en-IN')}</strong></td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Daily Budget</td><td style="padding: 8px; border: 1px solid #ddd;">₹${budget.toLocaleString('en-IN')}</td></tr>
        </table>
        <p style="color: #666;">This is an automated alert from RestaurantLedger.</p>
      </div>
    `,
  });
}

export async function sendDailyDigest({ to, ownerName, date, branches, totalSpend, topCategory, topVendor }) {
  return sendEmail({
    to,
    subject: `📊 Daily Digest — ₹${totalSpend.toLocaleString('en-IN')} total spend on ${date}`,
    html: `
      <div style="font-family: Inter, sans-serif; padding: 20px;">
        <h2>🍽️ RestaurantLedger — Daily Digest</h2>
        <p>Hello ${ownerName}, here's your daily summary for <strong>${date}</strong>:</p>
        <h3>Total Spend: ₹${totalSpend.toLocaleString('en-IN')}</h3>
        <p>Top Category: <strong>${topCategory}</strong></p>
        <p>Top Vendor: <strong>${topVendor}</strong></p>
        <h3>Branch Breakdown</h3>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="background: #f5f5f5;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Branch</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Spend</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Bills</th>
          </tr>
          ${branches.map(b => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${b.name}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${b.spend.toLocaleString('en-IN')}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${b.billCount}</td>
            </tr>
          `).join('')}
        </table>
        <p style="color: #666; font-size: 12px;">Sent automatically at 9:00 PM by RestaurantLedger.</p>
      </div>
    `,
  });
}

export async function sendMonthlyReport({ to, ownerName, month, year, totalSpend, pdfBuffer }) {
  return sendEmail({
    to,
    subject: `📊 Monthly P&L Report — ${month} ${year}`,
    html: `
      <div style="font-family: Inter, sans-serif; padding: 20px;">
        <h2>🍽️ RestaurantLedger — Monthly Report</h2>
        <p>Hello ${ownerName}, your P&L report for <strong>${month} ${year}</strong> is attached.</p>
        <p>Total Spend: <strong>₹${totalSpend.toLocaleString('en-IN')}</strong></p>
        <p style="color: #666;">Please find the detailed PDF report attached.</p>
      </div>
    `,
    attachments: pdfBuffer ? [{
      filename: `PnL_${month}_${year}.pdf`,
      content: pdfBuffer,
    }] : [],
  });
}
