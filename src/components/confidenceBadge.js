// ============================================
// Confidence Badge Component
// Shows AI confidence level per field
// ============================================

export function renderConfidenceBadge(confidence) {
  if (confidence === undefined || confidence === null) return '';
  const pct = Math.round(confidence * 100);
  let cls, icon, label;

  if (pct >= 80) {
    cls = 'confidence-high';
    icon = '✅';
    label = 'High';
  } else if (pct >= 60) {
    cls = 'confidence-medium';
    icon = '⚠️';
    label = 'Medium';
  } else {
    cls = 'confidence-low';
    icon = '❌';
    label = 'Low';
  }

  return `<span class="confidence-badge ${cls}" title="AI confidence: ${pct}%">${icon} ${label}</span>`;
}

export function renderFieldConfidence(confidence) {
  if (confidence === undefined || confidence === null) return '';
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return `<span class="field-confidence field-confidence-high" title="AI confidence: ${pct}%">✅</span>`;
  if (pct >= 60) return `<span class="field-confidence field-confidence-medium" title="AI confidence: ${pct}%">⚠️ AI guessed — tap to edit</span>`;
  return `<span class="field-confidence field-confidence-low" title="AI confidence: ${pct}%">❌ Low confidence</span>`;
}

export function getOverallConfidenceClass(aiConfidence) {
  if (!aiConfidence?.overall) return 'confidence-unknown';
  const pct = aiConfidence.overall * 100;
  if (pct >= 80) return 'confidence-high';
  if (pct >= 60) return 'confidence-medium';
  return 'confidence-low';
}
