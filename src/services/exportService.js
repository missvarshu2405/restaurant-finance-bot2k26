// ============================================
// Export Service — PDF & CSV generation
// ============================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getOwner, formatCurrency, formatDate } from '../data/store.js';

// === CSV Export ===

/**
 * Export data as CSV file download
 * @param {Array<object>} data - Array of row objects
 * @param {Array<{key,label}>} columns - Column definitions
 * @param {string} filename - Download filename (without extension)
 */
export function exportToCSV(data, columns, filename = 'export') {
  const headers = columns.map(c => c.label);
  const rows = data.map(row =>
    columns.map(col => {
      let val = col.csvValue ? col.csvValue(row[col.key], row) : (col.rawValue ? col.rawValue(row[col.key], row) : row[col.key]);
      if (val === null || val === undefined) val = '';
      // Escape quotes and wrap in quotes if contains comma/newline
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        val = `"${val}"`;
      }
      return val;
    })
  );

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

// === PDF Export ===

/**
 * Export a data table as a PDF
 * @param {Array<object>} data - Array of row objects
 * @param {Array<{key,label,align?,pdfValue?}>} columns - Column definitions
 * @param {string} title - Report title
 * @param {string} filename - Download filename (without extension)
 * @param {object} options - Additional options (subtitle, dateRange, summary)
 */
export function exportToPDF(data, columns, title, filename = 'report', options = {}) {
  const doc = new jsPDF({ orientation: data.length > 0 && columns.length > 7 ? 'landscape' : 'portrait' });
  const owner = getOwner();
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header ---
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(owner.businessName || 'RestaurantLedger', 14, 20);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 28);

  // Subtitle / date range
  let yPos = 34;
  doc.setFontSize(9);
  doc.setTextColor(100);

  if (options.subtitle) {
    doc.text(options.subtitle, 14, yPos);
    yPos += 5;
  }
  if (options.dateRange) {
    doc.text(`Period: ${options.dateRange}`, 14, yPos);
    yPos += 5;
  }

  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, yPos);
  yPos += 4;

  doc.setTextColor(0);

  // --- Summary cards (if provided) ---
  if (options.summary && options.summary.length > 0) {
    yPos += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    options.summary.forEach((item, i) => {
      const x = 14 + (i % 3) * 62;
      const y = yPos + Math.floor(i / 3) * 10;
      doc.setTextColor(100);
      doc.text(`${item.label}:`, x, y);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text(` ${item.value}`, x + doc.getTextWidth(`${item.label}: `), y);
      doc.setFont('helvetica', 'normal');
    });
    yPos += Math.ceil(options.summary.length / 3) * 10 + 2;
  }

  // --- Data Table ---
  if (data.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(130);
    doc.text('No data available for the selected filters.', 14, yPos + 10);
  } else {
    const head = [columns.map(c => c.label)];
    const body = data.map(row =>
      columns.map(col => {
        const val = col.pdfValue
          ? col.pdfValue(row[col.key], row)
          : col.rawValue
            ? col.rawValue(row[col.key], row)
            : row[col.key];
        return val !== null && val !== undefined ? String(val) : '';
      })
    );

    const colStyles = {};
    columns.forEach((col, i) => {
      if (col.align === 'right') colStyles[i] = { halign: 'right' };
    });

    autoTable(doc, {
      startY: yPos + 2,
      head,
      body,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [220, 220, 220],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: colStyles,
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer with page number
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      },
    });
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Export a bill detail as PDF
 * @param {object} bill - Bill object from store
 * @param {string} branchName - Branch name
 */
export function exportBillToPDF(bill, branchName) {
  const doc = new jsPDF();
  const owner = getOwner();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(owner.businessName || 'RestaurantLedger', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Branch: ${branchName}`, 14, 24);
  doc.setTextColor(0);

  // Bill header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Expense Bill', 14, 36);
  doc.setDrawColor(200);
  doc.line(14, 38, pageWidth - 14, 38);

  // Bill details
  let y = 46;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const details = [
    ['Bill ID', bill.id],
    ['Date', formatDate(bill.billDate)],
    ['Bill Number', bill.billNumber || '—'],
    ['Vendor', bill.vendorName],
    ['Vendor GSTIN', bill.vendorGstin || '—'],
    ['Category', bill.category],
    ['Payment Mode', (bill.paymentMode || '').toUpperCase()],
    ['Status', bill.status?.toUpperCase() || 'PENDING'],
    ['Uploaded By', bill.uploaderName || '—'],
    ['Uploaded At', bill.uploadedAt ? new Date(bill.uploadedAt).toLocaleString('en-IN') : '—'],
  ];

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text(String(value), 65, y);
    y += 7;
  });

  y += 6;

  // Line items table
  if (bill.items && bill.items.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Line Items', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Description', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)']],
      body: bill.items.map((item, i) => [
        i + 1,
        item.description || '',
        item.qty || '',
        item.unit || '',
        item.rate?.toFixed(2) || '',
        item.amount?.toFixed(2) || '',
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // Totals
  doc.setFontSize(10);
  const totals = [
    ['Subtotal', `₹${(bill.subtotal || 0).toFixed(2)}`],
    [`CGST (${((bill.gstRate || 0) / 2).toFixed(1)}%)`, `₹${(bill.cgst || 0).toFixed(2)}`],
    [`SGST (${((bill.gstRate || 0) / 2).toFixed(1)}%)`, `₹${(bill.sgst || 0).toFixed(2)}`],
  ];

  totals.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(label, pageWidth - 80, y);
    doc.setTextColor(0);
    doc.text(value, pageWidth - 14, y, { align: 'right' });
    y += 6;
  });

  // Total line
  doc.setDrawColor(0);
  doc.line(pageWidth - 80, y, pageWidth - 14, y);
  y += 6;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total', pageWidth - 80, y);
  doc.text(`₹${(bill.totalAmount || 0).toFixed(2)}`, pageWidth - 14, y, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated by RestaurantLedger — ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  doc.save(`bill-${bill.id}.pdf`);
}

// === Utility ===

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}
