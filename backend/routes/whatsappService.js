// ============================================
// WhatsApp Service — Meta Cloud API (Stubbed)
// Budget alerts, daily summary, cash variance
// ============================================

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

export async function sendWhatsAppMessage({ to, message }) {
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log(`📱 [WHATSAPP STUB] To: ${to} | Message: ${message.substring(0, 80)}...`);
    return { stubbed: true, to };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn('WhatsApp API credentials not configured');
    return { error: 'Not configured' };
  }

  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/[^0-9]/g, ''), // Clean phone number
        type: 'text',
        text: { body: message },
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'WhatsApp API error');
    console.log(`📱 WhatsApp sent to ${to}`);
    return data;
  } catch (err) {
    console.error(`📱 WhatsApp failed to ${to}:`, err.message);
    throw err;
  }
}

export async function sendBudgetBreachWhatsApp({ to, branchName, percentage, total, budget }) {
  const message = `🚨 *RestaurantLedger Budget Alert*\n\n` +
    `Branch: *${branchName}*\n` +
    `Budget Used: *${percentage}%*\n` +
    `Today's Spend: ₹${total.toLocaleString('en-IN')}\n` +
    `Daily Budget: ₹${budget.toLocaleString('en-IN')}\n\n` +
    `Please review spending immediately.`;
  return sendWhatsAppMessage({ to, message });
}

export async function sendDailySummaryWhatsApp({ to, ownerName, date, totalSpend, billCount, topBranch }) {
  const message = `📊 *Daily Summary — ${date}*\n\n` +
    `Hi ${ownerName},\n\n` +
    `Total Spend: *₹${totalSpend.toLocaleString('en-IN')}*\n` +
    `Total Bills: *${billCount}*\n` +
    `Top Branch: *${topBranch}*\n\n` +
    `— RestaurantLedger`;
  return sendWhatsAppMessage({ to, message });
}

export async function sendCashVarianceWhatsApp({ to, branchName, expected, actual, variance }) {
  const message = `💰 *Cash Variance Alert*\n\n` +
    `Branch: *${branchName}*\n` +
    `Expected Closing: ₹${expected.toLocaleString('en-IN')}\n` +
    `Actual Closing: ₹${actual.toLocaleString('en-IN')}\n` +
    `Variance: *₹${Math.abs(variance).toLocaleString('en-IN')}* ${variance < 0 ? '(short)' : '(over)'}\n\n` +
    `Please investigate.`;
  return sendWhatsAppMessage({ to, message });
}
