import { getPrintBridgeSettings } from "./printBridgeConfig";
import { Bill, ClinicSettings, Prescription } from "../types";
import jsPDF from "jspdf";
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from "./robotoBase64";
import { supabase } from "../supabaseClient";

/**
 * Dynamically fetches the latest saved clinic settings from the Supabase database
 * or falls back to localStorage/provided fallback object if offline.
 */
export async function getLatestSettings(fallbackSettings?: ClinicSettings): Promise<ClinicSettings> {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("id", "config")
      .single();

    if (!error && data) {
      const extraJson = localStorage.getItem("rk_bill_desk_extra_settings");
      let extra = {};
      if (extraJson) {
        try { extra = JSON.parse(extraJson); } catch (e) {}
      }
      return { ...data, ...extra };
    }
  } catch (err) {
    console.warn("[printBridge] Failed to fetch latest settings from database, using local fallback:", err);
  }

  // Fallback to local storage or provided fallback
  const extraJson = localStorage.getItem("rk_bill_desk_extra_settings");
  let extra = {};
  if (extraJson) {
    try { extra = JSON.parse(extraJson); } catch (e) {}
  }

  const fallbackStr = localStorage.getItem("rk_fallback_settings");
  let offlineSettings = null;
  if (fallbackStr) {
    try {
      const arr = JSON.parse(fallbackStr);
      offlineSettings = Array.isArray(arr) ? arr[0] : arr;
    } catch (e) {}
  }

  const defaultSettings: ClinicSettings = {
    id: "config",
    clinic_name: "RK Dental Clinic",
    address: "123 Dental Street, Suite A, iPadOS Cloud Office",
    phone: "+91 98765 43210",
    receipt_footer: "Thank you for your visit! Keep smiling.",
    whatsapp_message_template: ""
  };

  return { ...(offlineSettings || fallbackSettings || defaultSettings), ...extra };
}

export interface ReceiptData {
  clinic: string;
  address?: string;
  phone?: string;
  patient: string;
  patientMobile?: string;
  billNo: string;
  date: string;
  items: Array<{ name: string; amount: number; instructions?: string }>;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
  footer: string;
  logoType?: "logo" | "icon" | "none";
  logoBase64?: string;
  footerMessage?: string;
}

/**
 * Standard PDF Generator for 80mm Thermal Receipt PDFs
 */
export function generateThermalPDF(receiptData: ReceiptData): jsPDF {
  const leftMargin = 5;
  const contentWidth = 70; // 80 - 10

  // Dual-pass layout renderer: calculates perfect page height in pass 1, renders in pass 2
  const runLayout = (dryRun: boolean, doc: jsPDF) => {
    let y = 8;

    // Set standard font
    doc.setFont("helvetica", "normal");

    // 1. Draw Clinic Icon Emblem
    if (!dryRun) {
      // Draw premium emblem/shield logo
      doc.setDrawColor(120, 120, 120);
      doc.setFillColor(248, 248, 248);
      doc.setLineWidth(0.2);
      doc.circle(40, y + 4, 4.5, "FD");

      // Draw medical plus symbol inside
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.line(40, y + 2, 40, y + 6);
      doc.line(38, y + 4, 42, y + 4);
    }
    y += 11;

    // 2. Clinic Name (Prominent & bold)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(0, 0, 0);
    const clinicLines = doc.splitTextToSize(receiptData.clinic.toUpperCase(), contentWidth);
    clinicLines.forEach((line: string) => {
      if (!dryRun) {
        const textWidth = doc.getTextWidth(line);
        doc.text(line, (80 - textWidth) / 2, y);
      }
      y += 4.5;
    });

    // 3. Clinic Details (Address & Phone)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    if (receiptData.address) {
      const addrLines = doc.splitTextToSize(receiptData.address, contentWidth);
      addrLines.forEach((line: string) => {
        if (!dryRun) {
          const textWidth = doc.getTextWidth(line);
          doc.text(line, (80 - textWidth) / 2, y);
        }
        y += 3.2;
      });
    }

    if (receiptData.phone) {
      const phoneStr = `Phone: ${receiptData.phone}`;
      if (!dryRun) {
        const textWidth = doc.getTextWidth(phoneStr);
        doc.text(phoneStr, (80 - textWidth) / 2, y);
      }
      y += 4;
    }

    // Spacer and divider
    y += 1.5;
    if (!dryRun) {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.1);
      doc.line(leftMargin, y, 80 - leftMargin, y);
    }
    y += 3.5;

    // 4. Invoice Header & Metadata
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    // Determine whether we are rendering an invoice or a prescription
    const isPrescription = receiptData.clinic.toLowerCase().includes("prescription") || receiptData.grandTotal === 0;
    const headerTitle = isPrescription ? "CLINICAL PRESCRIPTION" : "TAX INVOICE / RECEIPT";

    if (!dryRun) {
      const titleWidth = doc.getTextWidth(headerTitle);
      doc.text(headerTitle, (80 - titleWidth) / 2, y);
    }
    y += 4.5;

    // Sub-metadata (Bill No, Date, Time, etc) in neat grid
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);

    if (!dryRun) {
      doc.text(`Bill No: ${receiptData.billNo}`, leftMargin, y);
      const dateStr = `Date: ${receiptData.date}`;
      doc.text(dateStr, 80 - leftMargin - doc.getTextWidth(dateStr), y);
    }
    y += 4.2;

    // 5. Patient Information Box (Clean layout instead of dotted lines)
    y += 1.5;
    const patBoxY = y;
    const patBoxHeight = receiptData.patientMobile ? 13.5 : 9.5;

    if (!dryRun) {
      // Draw soft grey patient block
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(252, 252, 252);
      doc.setLineWidth(0.15);
      doc.roundedRect(leftMargin, patBoxY, contentWidth, patBoxHeight, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      doc.text("PATIENT DETAILS", leftMargin + 3, patBoxY + 3.8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(receiptData.patient, leftMargin + 3, patBoxY + 7.5);

      if (receiptData.patientMobile) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(`Mobile: ${receiptData.patientMobile}`, leftMargin + 3, patBoxY + 11.2);
      }
    }
    y += patBoxHeight + 4;

    // 6. Treatment/Procedure Table Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    if (!dryRun) {
      doc.text("Procedure / Treatment Description", leftMargin, y);
      if (!isPrescription) {
        const amtHeader = "Amount (INR)";
        doc.text(amtHeader, 80 - leftMargin - doc.getTextWidth(amtHeader), y);
      }
    }
    y += 2.5;

    if (!dryRun) {
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.15);
      doc.line(leftMargin, y, 80 - leftMargin, y);
    }
    y += 3.5;

    // 7. Render Items / Medicines
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    receiptData.items.forEach((item) => {
      // Check if it's a separator item added by handleDownloadPDF in ReceiptPrint
      const isDividerItem = item.name.startsWith("---") || item.name.includes("-----");
      const isSectionHeader = item.name === "PRESCRIPTION (Rx)" || item.name.startsWith("PRESCRIPTION");

      if (isDividerItem) {
        y += 1.5;
        if (!dryRun) {
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.1);
          doc.line(leftMargin, y, 80 - leftMargin, y);
        }
        y += 3;
        return;
      }

      if (isSectionHeader) {
        y += 2.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        if (!dryRun) {
          const label = "--- CLINICAL PRESCRIPTION (Rx) ---";
          const labelW = doc.getTextWidth(label);
          doc.text(label, (80 - labelW) / 2, y);
        }
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        return;
      }

      const isNotes = item.name.startsWith("Notes/Diagnosis:");
      if (isNotes) {
        doc.setFont("helvetica", "bold");
        const notesContent = item.name.replace("Notes/Diagnosis:", "").trim();
        const notesLines = doc.splitTextToSize(`Notes/Diagnosis: ${notesContent}`, contentWidth);
        notesLines.forEach((line: string) => {
          if (!dryRun) {
            doc.text(line, leftMargin, y);
          }
          y += 3.8;
        });
        doc.setFont("helvetica", "normal");
        return;
      }

      // Standard item
      const amountStr = (!isPrescription && item.amount !== 0) ? Number(item.amount || 0).toFixed(2) : "";
      const amountWidth = amountStr ? doc.getTextWidth(amountStr) : 0;

      const maxItemNameWidth = amountStr ? contentWidth - amountWidth - 4 : contentWidth;
      const itemLines = doc.splitTextToSize(item.name, maxItemNameWidth);

      itemLines.forEach((line: string, idx: number) => {
        if (!dryRun) {
          doc.text(line, leftMargin, y);
          if (idx === 0 && amountStr) {
            doc.text(amountStr, 80 - leftMargin - amountWidth, y);
          }
        }
        y += 3.8;
      });

      if (item.instructions) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.2);
        doc.setTextColor(80, 80, 80);
        const instLines = doc.splitTextToSize(item.instructions, contentWidth - 4);
        instLines.forEach((line: string) => {
          if (!dryRun) {
            doc.text(line, leftMargin + 2, y);
          }
          y += 3.2;
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
      }

      y += 1.2; // Small gap between items
    });

    // Spacer and divider
    y += 1.5;
    if (!dryRun) {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.1);
      doc.line(leftMargin, y, 80 - leftMargin, y);
    }
    y += 3.5;

    // 8. Totals Block (Subtotal, Discount, Grand Total, Payment Mode)
    if (!isPrescription && receiptData.grandTotal > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);

      // Grand Total
      if (!dryRun) {
        doc.text("Grand Total (INR):", leftMargin, y);
        const totalStr = `INR ${Number(receiptData.grandTotal).toFixed(2)}`;
        doc.text(totalStr, 80 - leftMargin - doc.getTextWidth(totalStr), y);
      }
      y += 4.5;

      // Payment Method
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      if (!dryRun) {
        doc.text(`Payment Method: ${receiptData.paymentMethod.toUpperCase()}`, leftMargin, y);
      }
      y += 4.5;

      if (!dryRun) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.line(leftMargin, y, 80 - leftMargin, y);
      }
      y += 3.5;
    }

    // 9. Footer (Elegant, clean, centered)
    if (receiptData.footer) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      const footerLines = doc.splitTextToSize(receiptData.footer, contentWidth);
      footerLines.forEach((line: string) => {
        if (!dryRun) {
          const textWidth = doc.getTextWidth(line);
          doc.text(line, (80 - textWidth) / 2, y);
        }
        y += 3.5;
      });
      y += 2;
    }

    // Return final y coordinate as estimated height
    return y + 5; // adding some bottom padding
  };

  // Create test document for dry run
  const testDoc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const calculatedHeight = runLayout(true, testDoc);
  const finalHeight = Math.max(calculatedHeight, 100);

  // Create actual document with precise height
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, finalHeight]
  });

  // Render content onto actual document
  runLayout(false, doc);

  // Outer decorative border
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.15);
  doc.rect(2, 2, 76, finalHeight - 4, "S");

  return doc;
}

export class PrintBridgeService {
  /**
   * Sends receipt JSON to the Windows Local Print Bridge
   */
  async print(receiptData: ReceiptData): Promise<void> {
    const config = getPrintBridgeSettings();
    const url = `http://${config.ipAddress}:${config.port}/print`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receipt: receiptData }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 503 || response.status === 502 || response.status === 504) {
          throw new Error("Printer Offline");
        }
        throw new Error(`Connection Failed`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        throw new Error("Connection Failed");
      }

      // If we failed to fetch completely (Network Error), the print bridge itself is likely offline
      if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("network error") || err.message.includes("Load failed"))) {
        throw new Error("Print Bridge Offline");
      }

      // Preserve existing recognized error messages, default to Connection Failed
      const errMsg = err.message || "";
      if (errMsg === "Printer Offline" || errMsg === "Print Bridge Offline" || errMsg === "Connection Failed") {
        throw err;
      }
      throw new Error("Connection Failed");
    }
  }

  /**
   * Helper to format a bill object into standardized ReceiptData
   */
  getBillReceiptData(bill: Bill, settings: ClinicSettings): ReceiptData {
    const items = bill.items || bill.bill_items || [];
    return {
      clinic: settings.clinic_name,
      address: settings.address,
      phone: settings.phone,
      patient: bill.patient_name,
      patientMobile: bill.patient_mobile || undefined,
      billNo: bill.bill_number,
      date: `${bill.date} ${bill.time}`,
      items: items.map((item) => ({
        name: item.treatment_name || "Dental Treatment",
        amount: Number(item.amount || 0),
      })),
      subtotal: Number(bill.grand_total),
      discount: 0,
      tax: 0,
      grandTotal: Number(bill.grand_total),
      paymentMethod: bill.payment_method,
      footer: settings.receipt_footer || "Thank You",
      logoType: settings.bill_header_logo_type,
      logoBase64: settings.clinic_logo_base64,
      footerMessage: settings.bill_footer_message,
    };
  }

  /**
   * Helper to format a prescription object into standardized ReceiptData
   */
  getPrescriptionReceiptData(prescription: Prescription, settings: ClinicSettings): ReceiptData {
    const medicinesList = (prescription.medicines || []).map((m) => ({
      name: `${m.name} (${m.dosage || ""})`,
      amount: 0,
      instructions: `${m.frequency} - ${m.duration} [${m.instructions || ""}]`,
    }));

    return {
      clinic: settings.clinic_name + " - PRESCRIPTION",
      address: settings.address,
      phone: settings.phone,
      patient: prescription.patient_name,
      patientMobile: undefined,
      billNo: `RX-${prescription.id}`,
      date: prescription.date,
      items: medicinesList,
      subtotal: 0,
      discount: 0,
      tax: 0,
      grandTotal: 0,
      paymentMethod: prescription.doctor_notes || "N/A",
      footer: settings.receipt_footer || "Thank You",
      footerMessage: settings.bill_footer_message || `Thank you for choosing ${settings.clinic_name}.`,
    };
  }

  /**
   * Helper to format a bill object and print it
   */
  async printBill(bill: Bill, settings: ClinicSettings): Promise<void> {
    const receiptData = this.getBillReceiptData(bill, settings);
    return this.print(receiptData);
  }

  /**
   * Helper to format a prescription and print it
   */
  async printPrescription(prescription: Prescription, settings: ClinicSettings): Promise<void> {
    const receiptData = this.getPrescriptionReceiptData(prescription, settings);
    return this.print(receiptData);
  }

  /**
   * Tests connection with the print bridge via an OPTIONS or quick GET request
   */
  async testConnection(): Promise<boolean> {
    const config = getPrintBridgeSettings();
    const url = `http://${config.ipAddress}:${config.port}/print`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(url, {
        method: "OPTIONS",
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);
      return res !== null;
    } catch {
      return false;
    }
  }
}

export const printBridge = new PrintBridgeService();
export default printBridge;

/**
 * Custom PDF Generator for 80mm Thermal Receipt PDFs (BILL ONLY)
 */
export function generateThermalReceiptPDF(receiptData: ReceiptData): jsPDF {
  const leftMargin = 5;
  const contentWidth = 70; // 80 - 10

  const drawRupeeSymbol = (d: jsPDF, rx: number, ry: number, size: number = 1.0) => {
    d.saveGraphicsState();
    d.setDrawColor(0, 0, 0);
    d.setLineWidth(0.35 * size);
    
    const topY = ry - 2.2 * size;
    const midY = ry - 1.2 * size;
    const bottomY = ry + 0.4 * size;
    
    // Top horizontal bar
    d.line(rx, topY, rx + 2.0 * size, topY);
    // Middle horizontal bar
    d.line(rx, midY, rx + 1.6 * size, midY);
    
    // Beautiful curve for the 'R' head on the right of the vertical stem
    d.line(rx + 0.5 * size, topY, rx + 1.3 * size, topY);
    d.line(rx + 1.3 * size, topY, rx + 1.7 * size, topY + 0.3 * size);
    d.line(rx + 1.7 * size, topY + 0.3 * size, rx + 1.7 * size, midY - 0.3 * size);
    d.line(rx + 1.7 * size, midY - 0.3 * size, rx + 1.3 * size, midY);
    d.line(rx + 1.3 * size, midY, rx + 0.5 * size, midY);
    
    // Diagonal leg starting from the intersection of curve and midY, slashing down-right
    d.line(rx + 0.5 * size, midY, rx + 1.6 * size, bottomY);
    
    d.restoreGraphicsState();
  };

  const drawBarcode = (d: jsPDF, bx: number, by: number, width: number, height: number) => {
    d.saveGraphicsState();
    d.setFillColor(0, 0, 0);
    let currentX = bx;
    const pattern = [
      2, 1, 3, 1, 1, 2, 4, 1, 1, 3, 2, 1, 1, 2, 2, 2, 1, 3, 1, 1,
      2, 1, 3, 1, 1, 2, 4, 1, 1, 3, 2, 1, 1, 2, 2, 2, 1, 3, 1, 1
    ];
    const unitW = width / 68;
    pattern.forEach((val, i) => {
      const barW = val * unitW;
      const isBar = i % 2 === 0;
      if (isBar) {
        d.rect(currentX, by, barW, height, "F");
      }
      currentX += barW;
    });
    d.restoreGraphicsState();
  };

  const drawTopJaggedEdge = (d: jsPDF) => {
    d.saveGraphicsState();
    d.setFillColor(242, 242, 242);
    d.setDrawColor(242, 242, 242);
    const h = 2.0;
    const w = 3.0;
    for (let x = 0; x < 80; x += w) {
      d.triangle(x, 0, x + w / 2, h, x + w, 0, "F");
    }
    d.restoreGraphicsState();
  };

  const drawBottomJaggedEdge = (d: jsPDF, finalHeight: number) => {
    d.saveGraphicsState();
    d.setFillColor(242, 242, 242);
    d.setDrawColor(242, 242, 242);
    const h = 2.0;
    const w = 3.0;
    for (let x = 0; x < 80; x += w) {
      d.triangle(x, finalHeight, x + w / 2, finalHeight - h, x + w, finalHeight, "F");
    }
    d.restoreGraphicsState();
  };

  const runLayout = (dryRun: boolean, doc: jsPDF) => {
    let y = 10;
    
    // Redesigned with highly readable Helvetica
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13.0);
    doc.setTextColor(0, 0, 0);

    // 1. Centered Clinic Name (instead of TICKET)
    const clinicLines = doc.splitTextToSize(receiptData.clinic.toUpperCase(), contentWidth);
    clinicLines.forEach((line: string) => {
      if (!dryRun) {
        doc.text(line, 40, y, { align: "center" });
      }
      y += 4.5;
    });

    // 2. Centered Address & Phone (elegant receipt style, prevents any narrow-paper overlaps)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.0);
    if (receiptData.address) {
      const addrLines = doc.splitTextToSize(receiptData.address, contentWidth);
      addrLines.forEach((line: string) => {
        if (!dryRun) {
          doc.text(line, 40, y, { align: "center" });
        }
        y += 3.8;
      });
    }

    if (receiptData.phone) {
      if (!dryRun) {
        doc.text(`Ph: ${receiptData.phone}`, 40, y, { align: "center" });
      }
      y += 3.8;
    }

    y += 1.5;

    // 3. Dotted Divider
    if (!dryRun) {
      doc.saveGraphicsState();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([0.5, 1.2], 0);
      doc.line(leftMargin, y, 80 - leftMargin, y);
      doc.restoreGraphicsState();
    }
    y += 4.5;

    // 4. Subheader Row 1: Date (Left), Invoice No (Right, no folio word, right aligned)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (!dryRun) {
      const displayDate = receiptData.date ? receiptData.date.substring(0, 16) : "";
      doc.text(`Date: ${displayDate}`, leftMargin, y);
    }
    doc.setFont("helvetica", "bold");
    if (!dryRun) {
      doc.text(`${receiptData.billNo}`, 80 - leftMargin, y, { align: "right" });
    }
    y += 4.5;

    // 5. Subheader Row 2: Patient Name (Left), Patient Phone (Right)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (!dryRun) {
      doc.text(`Patient: ${receiptData.patient.toUpperCase()}`, leftMargin, y);
    }
    if (receiptData.patientMobile) {
      if (!dryRun) {
        doc.text(`Ph: ${receiptData.patientMobile}`, 80 - leftMargin, y, { align: "right" });
      }
    }
    y += 4.5;

    // 6. Dotted Divider
    if (!dryRun) {
      doc.saveGraphicsState();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([0.5, 1.2], 0);
      doc.line(leftMargin, y, 80 - leftMargin, y);
      doc.restoreGraphicsState();
    }
    y += 4.5;

    // 7. Column Headers: PROCEDURE (Left) & AMOUNT (Right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.0);
    if (!dryRun) {
      doc.text("PROCEDURE", leftMargin, y);
      doc.text("AMOUNT", 80 - leftMargin, y, { align: "right" });
    }
    y += 4.0;

    // 8. Dotted Divider
    if (!dryRun) {
      doc.saveGraphicsState();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([0.5, 1.2], 0);
      doc.line(leftMargin, y, 80 - leftMargin, y);
      doc.restoreGraphicsState();
    }
    y += 5.0;

    // 9. Items List (Redesigned with larger 9.5 font for old people)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    receiptData.items.forEach((item) => {
      const amtStr = Number(item.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const amtW = doc.getTextWidth(amtStr);
      const maxNameW = contentWidth - amtW - 3;
      const nameLines = doc.splitTextToSize(item.name, maxNameW);

      nameLines.forEach((line: string, idx: number) => {
        if (!dryRun) {
          doc.setFont("helvetica", "normal");
          doc.text(line, leftMargin, y);
          if (idx === 0) {
            doc.setFont("helvetica", "bold");
            doc.text(amtStr, 80 - leftMargin, y, { align: "right" });
          }
        }
        y += 4.4; // Slightly more spacious line gap for legibility
      });
      y += 0.6; // Compact spacing between rows
    });

    // 10. Dotted Divider
    if (!dryRun) {
      doc.saveGraphicsState();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([0.5, 1.2], 0);
      doc.line(leftMargin, y, 80 - leftMargin, y);
      doc.restoreGraphicsState();
    }
    y += 5.0;

    // 11. GRAND TOTAL Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.0);
    if (!dryRun) {
      doc.text("GRAND TOTAL", leftMargin, y);
    }

    const totalValStr = Number(receiptData.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalValW = doc.getTextWidth(totalValStr);
    const rupeeX = 80 - leftMargin - totalValW - 3.2;

    if (!dryRun) {
      drawRupeeSymbol(doc, rupeeX, y, 1.1);
      doc.text(totalValStr, 80 - leftMargin, y, { align: "right" });
    }
    y += 5.0;

    // 12. Dotted Divider
    if (!dryRun) {
      doc.saveGraphicsState();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([0.5, 1.2], 0);
      doc.line(leftMargin, y, 80 - leftMargin, y);
      doc.restoreGraphicsState();
    }
    y += 5.0;

    // 13. Payment Mode with sharp-bordered box
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    if (!dryRun) {
      doc.text("Payment Mode", leftMargin, y);
    }

    const pMode = (receiptData.paymentMethod || "CASH").toUpperCase();
    doc.setFont("helvetica", "bold");
    const pModeW = doc.getTextWidth(pMode);
    
    const boxW = pModeW + 4.0;
    const boxH = 5.2;
    const boxX = 80 - leftMargin - boxW;
    const boxY = y - 4.0;

    if (!dryRun) {
      doc.saveGraphicsState();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      doc.rect(boxX, boxY, boxW, boxH, "S");
      doc.text(pMode, boxX + 2.0, y - 0.2);
      doc.restoreGraphicsState();
    }
    y += boxH + 4.0;

    // 14. Dotted Divider
    if (!dryRun) {
      doc.saveGraphicsState();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([0.5, 1.2], 0);
      doc.line(leftMargin, y, 80 - leftMargin, y);
      doc.restoreGraphicsState();
    }
    y += 6.0;

    // 15. Centered Thank you footer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    if (!dryRun) {
      doc.text("THANK YOU FOR YOUR VISIT!", 40, y, { align: "center" });
    }
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.0);
    if (!dryRun) {
      doc.text("Keep smiling.", 40, y, { align: "center" });
    }
    y += 8.0;

    // 16. Barcode representation
    if (!dryRun) {
      const barcodeW = 46;
      const barcodeH = 8;
      const barcodeX = (80 - barcodeW) / 2;
      drawBarcode(doc, barcodeX, y, barcodeW, barcodeH);
    }
    y += 10.0;

    // 17. Invoice serial number centered text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.0);
    if (!dryRun) {
      doc.text(receiptData.billNo, 40, y, { align: "center" });
    }
    y += 4.5;

    return y + 10;
  };

  const testDoc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const calculatedHeight = runLayout(true, testDoc);
  const finalHeight = Math.max(calculatedHeight, 105);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, finalHeight]
  });

  runLayout(false, doc);

  drawTopJaggedEdge(doc);
  drawBottomJaggedEdge(doc, finalHeight);

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(2, 0, 2, finalHeight);
  doc.line(78, 0, 78, finalHeight);

  return doc;
}

/**
 * Custom PDF Generator for Professional A4 Dental Invoice PDFs
 */
export function generateA4InvoicePDF(receiptData: ReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const contentWidth = 170; // 210 - 40
  const leftMargin = 20;
  const rightMargin = 190;
  let y = 15;

  // Set standard typography
  doc.setFont("helvetica", "normal");

  // Helper to draw a tiny elegant tooth outline in violet on divider lines
  const drawTinyTooth = (tx: number, ty: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168); // violet-700
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.35);
    doc.circle(tx - 0.7, ty - 0.5, 0.8, "FD");
    doc.circle(tx + 0.7, ty - 0.5, 0.8, "FD");
    doc.ellipse(tx - 0.5, ty + 0.7, 0.6, 1.1, "FD");
    doc.ellipse(tx + 0.5, ty + 0.7, 0.6, 1.1, "FD");
    
    // Clear internal lines
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(255, 255, 255);
    doc.circle(tx, ty, 0.6, "F");
    
    // Outline connections
    doc.setDrawColor(107, 33, 168);
    doc.line(tx - 1.5, ty - 0.5, tx - 1.1, ty + 0.7);
    doc.line(tx + 1.5, ty - 0.5, tx + 1.1, ty + 0.7);
    doc.restoreGraphicsState();
  };

  // Helper to draw high-quality clean vector icons for clinic details
  const drawLocationPin = (ix: number, iy: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168);
    doc.setFillColor(107, 33, 168);
    doc.setLineWidth(0.1);
    doc.circle(ix, iy - 1.2, 0.9, "FD");
    doc.setFillColor(255, 255, 255);
    doc.circle(ix, iy - 1.2, 0.35, "F");
    doc.setFillColor(107, 33, 168);
    doc.line(ix - 0.7, iy - 0.9, ix, iy + 0.4);
    doc.line(ix + 0.7, iy - 0.9, ix, iy + 0.4);
    doc.restoreGraphicsState();
  };

  const drawPhoneIcon = (ix: number, iy: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168);
    doc.setFillColor(107, 33, 168);
    doc.setLineWidth(0.1);
    doc.roundedRect(ix - 0.8, iy - 1.5, 1.6, 3.0, 0.3, 0.3, "FD");
    doc.setFillColor(255, 255, 255);
    doc.rect(ix - 0.5, iy - 1.1, 1.0, 1.8, "F");
    doc.setFillColor(107, 33, 168);
    doc.circle(ix, iy + 1.1, 0.2, "F");
    doc.restoreGraphicsState();
  };

  const drawEnvelopeIcon = (ix: number, iy: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168);
    doc.setFillColor(107, 33, 168);
    doc.setLineWidth(0.1);
    doc.rect(ix - 1.2, iy - 1.0, 2.4, 1.8, "FD");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.line(ix - 1.2, iy - 1.0, ix, iy - 0.1);
    doc.line(ix + 1.2, iy - 1.0, ix, iy - 0.1);
    doc.restoreGraphicsState();
  };

  const drawGlobeIcon = (ix: number, iy: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168);
    doc.setFillColor(107, 33, 168);
    doc.setLineWidth(0.1);
    doc.circle(ix, iy, 1.2, "FD");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.25);
    doc.line(ix - 1.2, iy, ix + 1.2, iy);
    doc.line(ix, iy - 1.2, ix, iy + 1.2);
    doc.ellipse(ix, iy, 0.5, 1.2, "S");
    doc.restoreGraphicsState();
  };

  // Helper to draw a beautiful, pixel-perfect vector Indian Rupee symbol at (rx, ry)
  const drawRupeeSymbol = (rx: number, ry: number, colorStr?: string) => {
    doc.saveGraphicsState();
    if (colorStr === "white") {
      doc.setDrawColor(255, 255, 255);
    } else if (colorStr === "slate") {
      doc.setDrawColor(100, 116, 139); // Slate-500
    } else {
      doc.setDrawColor(107, 33, 168); // violet-700 (#6B21A8)
    }
    doc.setLineWidth(0.35);
    
    const topY = ry - 2.8;
    const midY = ry - 1.5;
    const bottomY = ry + 0.6;
    
    // Top horizontal bar
    doc.line(rx, topY, rx + 2.4, topY);
    // Middle horizontal bar
    doc.line(rx, midY, rx + 1.9, midY);
    
    // Beautiful curved loop for the 'R' head (right of vertical stem)
    doc.line(rx + 0.6, topY, rx + 1.6, topY);
    doc.line(rx + 1.6, topY, rx + 2.1, topY + 0.3);
    doc.line(rx + 2.1, topY + 0.3, rx + 2.1, midY - 0.3);
    doc.line(rx + 2.1, midY - 0.3, rx + 1.6, midY);
    doc.line(rx + 1.6, midY, rx + 0.6, midY);
    
    // Diagonal leg starting directly from the intersection of curve and midY, slashing down-right
    doc.line(rx + 0.6, midY, rx + 2.0, bottomY);
    
    doc.restoreGraphicsState();
  };

  // Helper to draw clean accounting-aligned currency amount
  const drawCurrencyAmount = (xRight: number, centerY: number, amount: number, color?: string, isBold: boolean = false) => {
    const formatted = amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.saveGraphicsState();
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    
    if (color === "white") {
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(15, 23, 42); // Deep slate
    }
    
    // Draw right-aligned number text
    doc.text(formatted, xRight, centerY, { align: "right" });
    
    // Position the vector Rupee symbol exactly to the left of the text bounds
    const textW = doc.getTextWidth(formatted);
    const rupeeX = xRight - textW - 3.8;
    
    drawRupeeSymbol(rupeeX, centerY - 0.1, color === "white" ? "white" : "#6B21A8");
    doc.restoreGraphicsState();
  };

  // --- HEADER SECTION (Clean, professional text-only header layout) ---
  let textStartX = leftMargin; // 20mm, full width alignment starting at left margin

  // Clinic Name (Prominent clean typography)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(107, 33, 168); // Violet-700
  const clinicTitle = (receiptData.clinic || "RK DENTAL CLINIC").toUpperCase();
  doc.text(clinicTitle, textStartX, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text("General and Cosmetic Dentistry", textStartX, y + 9);

  let currentY = y + 14;
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85); // Slate-700

  // Render Address dynamic lines with location pin
  if (receiptData.address) {
    const addrLines = doc.splitTextToSize(receiptData.address, 85);
    addrLines.forEach((line: string, index: number) => {
      if (index === 0) {
        drawLocationPin(textStartX + 1.2, currentY - 0.2);
      }
      doc.text(line, textStartX + 4.5, currentY);
      currentY += 4.2;
    });
  }

  // Phone bullet
  if (receiptData.phone) {
    drawPhoneIcon(textStartX + 1.2, currentY - 0.2);
    doc.text(receiptData.phone, textStartX + 4.5, currentY);
    currentY += 4.2;
  }

  // Email bullet
  drawEnvelopeIcon(textStartX + 1.2, currentY - 0.2);
  doc.text("contact@rkdental.com", textStartX + 4.5, currentY);
  currentY += 4.2;

  // Website bullet
  drawGlobeIcon(textStartX + 1.2, currentY - 0.2);
  doc.text("www.rkdentalclinic.com", textStartX + 4.5, currentY);

  // Invoice Title (Right aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(107, 33, 168); // Violet
  doc.text("TAX INVOICE", rightMargin, y + 5, { align: "right" });

  // Divider line under Title with tiny tooth
  doc.setDrawColor(107, 33, 168);
  doc.setLineWidth(0.4);
  doc.line(135, y + 8, rightMargin, y + 8);
  drawTinyTooth(162.5, y + 8);

  // Parse Date & Time cleanly
  let invoiceDate = "13 July 2026";
  let invoiceTime = "07:14 PM";
  if (receiptData.date) {
    if ((receiptData as any).billDate) {
      invoiceDate = (receiptData as any).billDate;
      invoiceTime = (receiptData as any).billTime || "07:14 PM";
    } else {
      const parts = receiptData.date.split(" ");
      if (parts.length >= 2) {
        invoiceDate = parts.slice(0, parts.length - 2).join(" ") || parts[0];
        invoiceTime = parts.slice(parts.length - 2).join(" ") || parts[1];
      } else {
        invoiceDate = receiptData.date;
      }
    }
  }

  // Right Aligned Metadata List
  const metaLabels = ["Invoice No.", "Invoice Date", "Invoice Time", "GSTIN"];
  const metaValues = [
    receiptData.billNo,
    invoiceDate,
    invoiceTime,
    "33RKDENT7890D1Z"
  ];

  let metaY = y + 14;
  doc.setFontSize(8.5);
  for (let i = 0; i < metaLabels.length; i++) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(metaLabels[i], 135, metaY);
    doc.text(":", 158, metaY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(metaValues[i], 161, metaY);
    metaY += 5;
  }

  y = 52.5;
  // Solid primary color horizontal separator
  doc.setDrawColor(107, 33, 168);
  doc.setLineWidth(0.8);
  doc.line(leftMargin, y, rightMargin, y);
  y += 6;

  // --- GRID PANEL DETAILS ---
  // Left: Patient Details, Right: Billing Info
  const cardW = 81;
  const cardH = 43;

  // Left card (Patient)
  doc.saveGraphicsState();
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, y, cardW, cardH, 2.5, 2.5, "FD");

  // BILL TO header with tiny user icon outline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 33, 168);
  doc.text("BILL TO", leftMargin + 12, y + 6);
  
  doc.setDrawColor(107, 33, 168);
  doc.setLineWidth(0.35);
  // Head
  const headCx = leftMargin + 6.8;
  const headCy = y + 3.8;
  doc.circle(headCx, headCy, 1.0, "S");

  // Shoulders curve (a smooth open semi-ellipse)
  const shoulderCx = leftMargin + 6.8;
  const shoulderCy = y + 7.6;
  const rx = 2.0;
  const ry = 1.3;
  let prevX = 0;
  let prevY = 0;
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const theta = Math.PI + (i / steps) * Math.PI;
    const px = shoulderCx + rx * Math.cos(theta);
    const py = shoulderCy + ry * Math.sin(theta);
    if (i > 0) {
      doc.line(prevX, prevY, px, py);
    }
    prevX = px;
    prevY = py;
  }

  // Patient Info fields
  const patientLabels = ["Patient Name", "Patient ID", "Age / Gender", "Mobile Number", "Address"];
  const patientValues = [
    receiptData.patient.toUpperCase(),
    `P-${String(receiptData.billNo).replace(/\D/g, '').slice(-6).padStart(6, '0') || '000125'}`,
    "Not Specified",
    receiptData.patientMobile || "Not Specified",
    "Not Specified"
  ];

  let patY = y + 12;
  const patRowGap = 6.2;
  for (let i = 0; i < patientLabels.length; i++) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(patientLabels[i], leftMargin + 4, patY);
    doc.text(":", leftMargin + 28, patY);
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(patientValues[i], leftMargin + 31, patY);
    patY += patRowGap;
  }
  doc.restoreGraphicsState();

  // Right card (Invoice details)
  const rightCardX = leftMargin + cardW + 8; // 20 + 81 + 8 = 109
  doc.saveGraphicsState();
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightCardX, y, cardW, cardH, 2.5, 2.5, "FD");

  // INVOICE DETAILS header with tiny list icon outline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 33, 168);
  doc.text("INVOICE DETAILS", rightCardX + 12, y + 6);

  doc.setDrawColor(107, 33, 168);
  doc.setLineWidth(0.35);
  doc.rect(rightCardX + 5, y + 2.5, 3.5, 4.5);
  doc.line(rightCardX + 6.5, y + 4, rightCardX + 7.5, y + 4);
  doc.line(rightCardX + 6.5, y + 5.5, rightCardX + 7.5, y + 5.5);

  // Invoice details fields
  const invLabels = ["Doctor Name", "Payment Method", "Payment Status"];
  let invY = y + 12;
  const invRowGap = 7.5;

  for (let i = 0; i < invLabels.length; i++) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(invLabels[i], rightCardX + 4, invY);
    doc.text(":", rightCardX + 28, invY);
    doc.setTextColor(15, 23, 42);

    if (invLabels[i] === "Payment Status") {
      // Render nice filled purple badge
      doc.setFillColor(107, 33, 168);
      doc.roundedRect(rightCardX + 31, invY - 3.2, 13, 4.5, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("PAID", rightCardX + 37.5, invY - 0.1, { align: "center" });
    } else {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      const valText = i === 0 ? "Dr. V. Radhakrishnan\nBDS., D.Endo." : (receiptData.paymentMethod ? receiptData.paymentMethod.toUpperCase() : "UPI");
      const lines = doc.splitTextToSize(valText, 45);
      lines.forEach((line: string, lineIndex: number) => {
        doc.text(line, rightCardX + 31, invY + (lineIndex * 3.8));
      });
      if (i === 0 && lines.length > 1) {
        invY += (lines.length - 1) * 3.8;
      }
    }
    invY += invRowGap;
  }
  doc.restoreGraphicsState();

  y += cardH + 6;

  // --- TREATMENT TABLE ---
  // Define mathematically aligned column boundaries
  const colBoundary1 = leftMargin + 11; // 31
  const colBoundary2 = leftMargin + 97; // 117
  const colBoundary3 = leftMargin + 113; // 133
  const colBoundary4 = leftMargin + 141; // 161

  // Align column texts inside boundaries
  const xColHash = leftMargin + 5.5; // Centered
  const xColTreatment = leftMargin + 14; // Left-aligned
  const xColQty = leftMargin + 105; // Centered
  const xColRate = leftMargin + 138; // Right-aligned with padding
  const xColAmount = rightMargin - 4; // Right-aligned

  doc.setFillColor(107, 33, 168); // Violet Accent Table Header
  doc.rect(leftMargin, y, contentWidth, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  
  doc.text("#", xColHash, y + 6.3, { align: "center" });
  doc.text("TREATMENT / PROCEDURE", xColTreatment, y + 6.3);
  doc.text("QTY", xColQty, y + 6.3, { align: "center" });
  
  // Custom headers to hold the real Rupee symbol cleanly using the vector drawing helper
  const rateLabel = "RATE (    )";
  doc.text(rateLabel, xColRate, y + 6.3, { align: "right" });
  const rateLabelW = doc.getTextWidth(rateLabel);
  const rateTextLeft = xColRate - rateLabelW;
  const rateParenLeftW = doc.getTextWidth("RATE (");
  const rupeeRateX = rateTextLeft + rateParenLeftW + 0.3;
  drawRupeeSymbol(rupeeRateX, y + 6.3, "white");

  const amountLabel = "AMOUNT (    )";
  doc.text(amountLabel, xColAmount, y + 6.3, { align: "right" });
  const amountLabelW = doc.getTextWidth(amountLabel);
  const amountTextLeft = xColAmount - amountLabelW;
  const amountParenLeftW = doc.getTextWidth("AMOUNT (");
  const rupeeAmountX = amountTextLeft + amountParenLeftW + 0.3;
  drawRupeeSymbol(rupeeAmountX, y + 6.3, "white");

  const tableHeaderY = y;
  y += 10;

  // Draw Table Rows with Dynamic Row Height & Soft Vertical dividers
  const items = receiptData.items || [];
  doc.setFontSize(8.5);

  let currentRowY = y;
  items.forEach((item, index) => {
    const treatmentText = item.name;
    const maxTextW = 80;
    const itemLines = doc.splitTextToSize(treatmentText, maxTextW);
    const numLines = itemLines.length;
    const rowHeight = 7 + (numLines * 4.5); // auto dynamic spacing

    // Alternating background
    if (index % 2 === 1) {
      doc.setFillColor(248, 246, 252);
      doc.rect(leftMargin + 0.2, currentRowY + 0.2, contentWidth - 0.4, rowHeight - 0.4, "F");
    }

    // Row bottom border
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.2);
    doc.line(leftMargin, currentRowY + rowHeight, rightMargin, currentRowY + rowHeight);

    // Render columns aligned elegantly to the first baseline row text
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(String(index + 1), xColHash, currentRowY + 6.5, { align: "center" });
    
    // Bold treatment text for premium emphasis
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    itemLines.forEach((line: string, lineIndex: number) => {
      doc.text(line, xColTreatment, currentRowY + 6.5 + (lineIndex * 4.5));
    });
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text("1", xColQty, currentRowY + 6.5, { align: "center" });
    
    // Draw accounting-aligned currency values with vector Rupee symbols
    drawCurrencyAmount(xColRate, currentRowY + 6.5, item.amount);
    drawCurrencyAmount(xColAmount, currentRowY + 6.5, item.amount);

    currentRowY += rowHeight;
  });

  // Table Outer Frame Box and Subtle Vertical Grid separators
  const tableHeight = currentRowY - tableHeaderY;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.rect(leftMargin, tableHeaderY, contentWidth, tableHeight, "S");

  // Vertical separators
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.25);
  const verticalGridX = [colBoundary1, colBoundary2, colBoundary3, colBoundary4];
  verticalGridX.forEach((vX) => {
    doc.line(vX, tableHeaderY + 10, vX, currentRowY);
  });

  currentRowY += 6;

  // --- TOTALS BLOCK ---
  const summaryX = rightCardX;
  const summaryW = cardW;
  const valOffset = summaryX + summaryW - 5; // right aligned with 5mm padding

  doc.saveGraphicsState();
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.35);
  // Rebuild the billing summary card with perfect height (52)
  doc.roundedRect(summaryX, currentRowY, summaryW, 52, 2.5, 2.5, "FD");

  const summaryLabels = [
    "Subtotal",
    "Discount",
    "Tax / GST (Exempted)",
    "Paid Amount",
    "Balance Amount"
  ];

  doc.setFontSize(8.5);
  let rowY = currentRowY + 5.0; // Start at padding
  const rowHeight = 7.0;

  for (let i = 0; i < summaryLabels.length; i++) {
    const centerY = rowY + (rowHeight / 2) + 1.0; // center baseline adjustment
    
    // Label
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(summaryLabels[i], summaryX + 5, centerY);
    
    // Value Amount
    let valAmount = 0;
    if (i === 0) valAmount = receiptData.subtotal;
    else if (i === 1) valAmount = receiptData.discount || 0;
    else if (i === 2) valAmount = receiptData.tax || 0;
    else if (i === 3) valAmount = receiptData.grandTotal;
    else if (i === 4) valAmount = 0; // Balance is 0 since it is paid
    
    drawCurrencyAmount(valOffset, centerY, valAmount);
    
    rowY += rowHeight;
  }

  // Grand Total Highlight with Flat top and rounded bottom at the bottom of the card
  doc.setFillColor(107, 33, 168); // Violet primary
  // Draw rounded rect for the bottom of the card
  doc.roundedRect(summaryX, currentRowY + 40, summaryW, 12, 2.5, 2.5, "F");
  // Overlap top half to make top edge flat
  doc.rect(summaryX, currentRowY + 40, summaryW, 6, "F");

  // Grand Total Text
  const gtCenterY = currentRowY + 40 + 7.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL", summaryX + 5, gtCenterY);
  
  // Highlight Grand Total in clear bold white currency formatting
  drawCurrencyAmount(valOffset, gtCenterY, receiptData.grandTotal, "white", true);
  doc.restoreGraphicsState();

  // --- FOOTER SECTION ---
  const footerY = 260;
  
  // Divider line under content with tiny tooth in the center
  doc.setDrawColor(233, 213, 255); // Light violet
  doc.setLineWidth(0.4);
  doc.line(leftMargin, footerY, rightMargin, footerY);
  drawTinyTooth(105, footerY);

  // Clean, classic, perfectly centered footer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(107, 33, 168); // Violet
  doc.text(receiptData.footerMessage || "Thank you for choosing RK Dental Clinic.", 105, footerY + 8, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text("This is a computer-generated invoice and does not require a physical signature.", 105, footerY + 13, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 33, 168);
  doc.text("Thank you!", 105, footerY + 18, { align: "center" });

  // Elegant very light slate trim frame bounding the workspace margins
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  doc.rect(8, 8, 194, 281, "S");

  return doc;
}

/**
 * Alias of generateThermalReceiptPDF for backward compatibility
 */
export function generateThermalBillPDF(receiptData: ReceiptData): jsPDF {
  return generateThermalReceiptPDF(receiptData);
}

export function triggerThermalBillPrint(bill: Bill, settings: ClinicSettings) {
  try {
    const receiptData = printBridge.getBillReceiptData(bill, settings);
    const doc = generateThermalReceiptPDF(receiptData);
    
    const blob = doc.output("blob");
    const fileName = `Bill_${bill.bill_number}.pdf`;
    
    // Attempt to use native Web Share API (highly compatible with mobile/iPad/Safari/Chrome on Android)
    const file = new File([blob], fileName, { type: "application/pdf" });
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: `Bill ${bill.bill_number}`,
        text: `Receipt for Invoice #${bill.bill_number}`,
      })
      .then(() => {
        console.log("Successfully shared bill PDF via native share dialog");
      })
      .catch((err) => {
        // Log cancel/error and run fallback
        console.warn("Native share canceled or failed:", err);
        fallbackPrintOrSave(doc, fileName);
      });
    } else {
      // Fallback for browsers/devices where navigator.share or sharing of PDF files is not supported
      fallbackPrintOrSave(doc, fileName);
    }
  } catch (err) {
    console.error("Failed to generate thermal bill PDF:", err);
  }
}

function fallbackPrintOrSave(doc: jsPDF, fileName: string) {
  try {
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, "_blank");
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      doc.save(fileName);
    }
  } catch (e) {
    console.error("Fallback print preview or download failed:", e);
    doc.save(fileName);
  }
}

/**
 * Custom PDF Generator for Professional A4 Clinical Prescription PDFs
 */
export function generateA4PrescriptionPDF(prescription: Prescription, settings: ClinicSettings): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const contentWidth = 170; // 210 - 40
  const leftMargin = 20;
  const rightMargin = 190;
  let y = 15;

  // Set standard typography
  doc.setFont("helvetica", "normal");

  // Helper to draw a tiny elegant tooth outline in violet on divider lines
  const drawTinyTooth = (tx: number, ty: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168); // violet-700
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.35);
    doc.circle(tx - 0.7, ty - 0.5, 0.8, "FD");
    doc.circle(tx + 0.7, ty - 0.5, 0.8, "FD");
    doc.ellipse(tx - 0.5, ty + 0.7, 0.6, 1.1, "FD");
    doc.ellipse(tx + 0.5, ty + 0.7, 0.6, 1.1, "FD");
    
    // Clear internal lines
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(255, 255, 255);
    doc.circle(tx, ty, 0.6, "F");
    
    // Outline connections
    doc.setDrawColor(107, 33, 168);
    doc.line(tx - 1.5, ty - 0.5, tx - 1.1, ty + 0.7);
    doc.line(tx + 1.5, ty - 0.5, tx + 1.1, ty + 0.7);
    doc.restoreGraphicsState();
  };

  // Helper to draw high-quality clean vector icons for clinic details
  const drawLocationPin = (ix: number, iy: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168);
    doc.setFillColor(107, 33, 168);
    doc.setLineWidth(0.1);
    doc.circle(ix, iy - 1.2, 0.9, "FD");
    doc.setFillColor(255, 255, 255);
    doc.circle(ix, iy - 1.2, 0.35, "F");
    doc.setFillColor(107, 33, 168);
    doc.line(ix - 0.7, iy - 0.9, ix, iy + 0.4);
    doc.line(ix + 0.7, iy - 0.9, ix, iy + 0.4);
    doc.restoreGraphicsState();
  };

  const drawPhoneIcon = (ix: number, iy: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168);
    doc.setFillColor(107, 33, 168);
    doc.setLineWidth(0.1);
    doc.roundedRect(ix - 0.8, iy - 1.5, 1.6, 3.0, 0.3, 0.3, "FD");
    doc.setFillColor(255, 255, 255);
    doc.rect(ix - 0.5, iy - 1.1, 1.0, 1.8, "F");
    doc.setFillColor(107, 33, 168);
    doc.circle(ix, iy + 1.1, 0.2, "F");
    doc.restoreGraphicsState();
  };

  const drawEnvelopeIcon = (ix: number, iy: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168);
    doc.setFillColor(107, 33, 168);
    doc.setLineWidth(0.1);
    doc.rect(ix - 1.2, iy - 1.0, 2.4, 1.8, "FD");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.line(ix - 1.2, iy - 1.0, ix, iy - 0.1);
    doc.line(ix + 1.2, iy - 1.0, ix, iy - 0.1);
    doc.restoreGraphicsState();
  };

  const drawGlobeIcon = (ix: number, iy: number) => {
    doc.saveGraphicsState();
    doc.setDrawColor(107, 33, 168);
    doc.setLineWidth(0.25);
    doc.line(ix - 1.2, iy, ix + 1.2, iy);
    doc.line(ix, iy - 1.2, ix, iy + 1.2);
    doc.ellipse(ix, iy, 0.5, 1.2, "S");
    doc.restoreGraphicsState();
  };

  // --- HEADER SECTION (Clean, professional text-only header layout) ---
  let textStartX = leftMargin; // 20mm, full width alignment starting at left margin

  // Clinic Details (Prominent clean typography from dynamic settings)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(107, 33, 168); // Violet-700
  const clinicTitle = (settings.clinic_name || "RK DENTAL CLINIC").toUpperCase();
  doc.text(clinicTitle, textStartX, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text("General and Cosmetic Dentistry", textStartX, y + 9);

  // Elegant Vector Icons with dynamic details below Clinic Name
  let currentY = y + 14;
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85); // Slate-700

  // Dynamic Address
  const clinicAddr = settings.address || "123 Dental Street, Suite A";
  const addrLines = doc.splitTextToSize(clinicAddr, 85);
  addrLines.forEach((line: string, index: number) => {
    if (index === 0) {
      drawLocationPin(textStartX + 1.2, currentY - 0.2);
    }
    doc.text(line, textStartX + 4.5, currentY);
    currentY += 4.2;
  });

  // Dynamic Phone
  const clinicPhone = settings.phone || "+91 98765 43210";
  drawPhoneIcon(textStartX + 1.2, currentY - 0.2);
  doc.text(clinicPhone, textStartX + 4.5, currentY);
  currentY += 4.2;

  // Email
  drawEnvelopeIcon(textStartX + 1.2, currentY - 0.2);
  doc.text("contact@rkdental.com", textStartX + 4.5, currentY);
  currentY += 4.2;

  // Website
  drawGlobeIcon(textStartX + 1.2, currentY - 0.2);
  doc.text("www.rkdentalclinic.com", textStartX + 4.5, currentY);

  // Prescription Title (Right aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(107, 33, 168); // Violet
  doc.text("PRESCRIPTION", rightMargin, y + 5, { align: "right" });

  // Divider line under Title with tiny tooth
  doc.setDrawColor(107, 33, 168);
  doc.setLineWidth(0.4);
  doc.line(135, y + 8, rightMargin, y + 8);
  drawTinyTooth(162.5, y + 8);

  // Parse Date cleanly
  let rxDate = prescription.date || "13 July 2026";
  let rxTime = "07:14 PM";
  if (prescription.date) {
    const parts = prescription.date.split(" ");
    if (parts.length >= 2) {
      rxDate = parts.slice(0, parts.length - 2).join(" ") || parts[0];
      rxTime = parts.slice(parts.length - 2).join(" ") || parts[1];
    }
  }

  // Right Aligned Metadata List
  const metaLabels = ["Prescription No.", "Rx Date", "Rx Time", "GSTIN"];
  const metaValues = [
    `RX-${prescription.id}`,
    rxDate,
    rxTime,
    "33RKDENT7890D1Z"
  ];

  let metaY = y + 14;
  doc.setFontSize(8.5);
  for (let i = 0; i < metaLabels.length; i++) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(metaLabels[i], 135, metaY);
    doc.text(":", 158, metaY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(metaValues[i], 161, metaY);
    metaY += 5;
  }

  y = 52.5;
  // Solid primary color horizontal separator
  doc.setDrawColor(107, 33, 168);
  doc.setLineWidth(0.8);
  doc.line(leftMargin, y, rightMargin, y);
  y += 6;

  // --- GRID PANEL DETAILS ---
  const cardW = 81;
  const cardH = 43;

  // Left card (Patient)
  doc.saveGraphicsState();
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, y, cardW, cardH, 2.5, 2.5, "FD");

  // PATIENT DETAILS header with tiny user icon outline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 33, 168);
  doc.text("PATIENT DETAILS", leftMargin + 12, y + 6);
  
  doc.setDrawColor(107, 33, 168);
  doc.setLineWidth(0.35);
  // Head
  const headCx = leftMargin + 6.8;
  const headCy = y + 3.8;
  doc.circle(headCx, headCy, 1.0, "S");

  // Shoulders curve (a smooth open semi-ellipse)
  const shoulderCx = leftMargin + 6.8;
  const shoulderCy = y + 7.6;
  const rx = 2.0;
  const ry = 1.3;
  let prevX = 0;
  let prevY = 0;
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const theta = Math.PI + (i / steps) * Math.PI;
    const px = shoulderCx + rx * Math.cos(theta);
    const py = shoulderCy + ry * Math.sin(theta);
    if (i > 0) {
      doc.line(prevX, prevY, px, py);
    }
    prevX = px;
    prevY = py;
  }

  // Patient Info fields
  const patientLabels = ["Patient Name", "Patient ID", "Age / Gender", "Mobile Number", "Address"];
  const patientValues = [
    prescription.patient_name.toUpperCase(),
    `P-${String(prescription.id).padStart(6, '0')}`,
    "Not Specified",
    prescription.patient_mobile || "Not Specified",
    "Not Specified"
  ];

  let patY = y + 12;
  const patRowGap = 6.2;
  for (let i = 0; i < patientLabels.length; i++) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(patientLabels[i], leftMargin + 4, patY);
    doc.text(":", leftMargin + 28, patY);
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(patientValues[i], leftMargin + 31, patY);
    patY += patRowGap;
  }
  doc.restoreGraphicsState();

  // Right card (Prescription info)
  const rightCardX = leftMargin + 89;
  doc.saveGraphicsState();
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightCardX, y, cardW, cardH, 2.5, 2.5, "FD");

  // PRESCRIPTION INFO header with tiny medical clipboard icon outline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 33, 168);
  doc.text("PRESCRIPTION INFO", rightCardX + 12, y + 6);

  doc.setDrawColor(107, 33, 168);
  doc.setLineWidth(0.35);
  // Clipboard rect
  doc.rect(rightCardX + 5, y + 2.8, 3.5, 4.2);
  // Clipboard clip
  doc.rect(rightCardX + 6.2, y + 2.0, 1.1, 1.0, "S");
  // Small list lines inside clipboard
  doc.line(rightCardX + 5.8, y + 4.2, rightCardX + 7.7, y + 4.2);
  doc.line(rightCardX + 5.8, y + 5.5, rightCardX + 7.7, y + 5.5);

  // Clinic & Doctor details fields
  const docLabels = ["Doctor Name", "Reg No.", "Rx Reference"];
  let docY = y + 12;
  const docRowGap = 7.5;

  for (let i = 0; i < docLabels.length; i++) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(docLabels[i], rightCardX + 4, docY);
    doc.text(":", rightCardX + 28, docY);
    doc.setTextColor(15, 23, 42);

    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    const valText = i === 0 ? "Dr. V. Radhakrishnan\nBDS., D.Endo." : (i === 1 ? "Reg. No: 33/DEN/1234" : `REF-${prescription.id}`);
    const lines = doc.splitTextToSize(valText, 45);
    lines.forEach((line: string, lineIndex: number) => {
      doc.text(line, rightCardX + 31, docY + (lineIndex * 3.8));
    });
    if (i === 0 && lines.length > 1) {
      docY += (lines.length - 1) * 3.8;
    }
    docY += docRowGap;
  }
  doc.restoreGraphicsState();

  y += cardH + 6;

  // --- RX EMBLEM & PRESCRIPTION LIST HEADER ---
  doc.saveGraphicsState();
  
  // Custom headers to hold the medicines list cleanly
  doc.setFillColor(107, 33, 168); // Violet Accent Table Header
  doc.rect(leftMargin, y, contentWidth, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  
  // Column x-coordinates (Sum up to 170)
  const xColSNo = leftMargin + 4; // center aligned
  const xColMed = leftMargin + 10; // left aligned
  const xColDosage = leftMargin + 72; // left aligned
  const xColFreq = leftMargin + 105; // center aligned (shifted from 98 to 105 to give dosage 33mm space instead of 26mm)
  const xColDur = leftMargin + 127; // center aligned (shifted from 124 to 127 to give frequency 22mm space)
  const xColInst = leftMargin + 143; // left aligned (shifted from 140 to 143 to give duration 16mm space and instruction 27mm space)

  doc.text("#", xColSNo, y + 6.3, { align: "center" });
  doc.text("MEDICINE / DRUG NAME", xColMed, y + 6.3);
  doc.text("DOSAGE", xColDosage, y + 6.3);
  doc.text("FREQUENCY", xColFreq, y + 6.3, { align: "center" });
  doc.text("DURATION", xColDur, y + 6.3, { align: "center" });
  doc.text("INSTRUCTIONS", xColInst, y + 6.3);

  y += 10;

  // --- MEDICINE TABLE ROWS ---
  const medicines = prescription.medicines || [];
  medicines.forEach((med, index) => {
    // Determine row height dynamically based on multi-line text (e.g. long medicine name or long instructions)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const medLines: string[] = doc.splitTextToSize(med.name || "N/A", 58);
    
    doc.setFont("helvetica", "normal");
    const dosageLines: string[] = doc.splitTextToSize(med.dosage || "N/A", 30);
    const freqLines: string[] = doc.splitTextToSize(med.frequency || "N/A", 20);
    const durLines: string[] = doc.splitTextToSize(med.duration || "N/A", 18);
    const instLines: string[] = doc.splitTextToSize(med.instructions || "None", 25);
    
    const lineCount = Math.max(medLines.length, dosageLines.length, freqLines.length, durLines.length, instLines.length, 1);
    const rowHeight = 6.0 + (lineCount * 4.2);

    // Zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(250, 245, 255); // very light violet
      doc.rect(leftMargin, y, contentWidth, rowHeight, "F");
    }

    // Border line under each row
    doc.setDrawColor(243, 232, 255); // Light violet divider
    doc.setLineWidth(0.35);
    doc.line(leftMargin, y + rowHeight, rightMargin, y + rowHeight);

    // Render index
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(107, 33, 168); // Violet SNo
    doc.text(String(index + 1), xColSNo, y + 5.5, { align: "center" });

    // Render Medicine Name
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); // slate-900
    medLines.forEach((line, i) => {
      doc.text(line, xColMed, y + 5.5 + (i * 4.2));
    });

    // Render Dosage
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85); // slate-700
    dosageLines.forEach((line, i) => {
      doc.text(line, xColDosage, y + 5.5 + (i * 4.2));
    });

    // Render Frequency
    freqLines.forEach((line, i) => {
      doc.text(line, xColFreq, y + 5.5 + (i * 4.2), { align: "center" });
    });

    // Render Duration
    durLines.forEach((line, i) => {
      doc.text(line, xColDur, y + 5.5 + (i * 4.2), { align: "center" });
    });

    // Render Instructions
    instLines.forEach((line, i) => {
      doc.text(line, xColInst, y + 5.5 + (i * 4.2));
    });

    y += rowHeight;
  });
  doc.restoreGraphicsState();

  // --- DOCTOR NOTES / SPECIAL CLINICAL ADVICE ---
  if (prescription.doctor_notes && prescription.doctor_notes.trim() !== "") {
    let notesY = y + 8;
    doc.saveGraphicsState();
    
    // Split notes text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const notesLines: string[] = doc.splitTextToSize(prescription.doctor_notes, 160);
    const notesHeight = 10 + (notesLines.length * 4.5);
    
    doc.setDrawColor(233, 213, 255); // light violet border
    doc.setFillColor(250, 245, 255); // very soft violet
    doc.setLineWidth(0.35);
    doc.roundedRect(leftMargin, notesY, contentWidth, notesHeight, 2.5, 2.5, "FD");
    
    // Title of Notes
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(107, 33, 168); // violet-700
    doc.text("CLINICAL ADVICE & SPECIAL NOTES", leftMargin + 5, notesY + 5.2);
    
    // Body of Notes
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85); // Slate-600
    let noteLineY = notesY + 10.2;
    notesLines.forEach(line => {
      doc.text(line, leftMargin + 5, noteLineY);
      noteLineY += 4.5;
    });
    doc.restoreGraphicsState();
  }

  // --- FOOTER SECTION ---
  const footerY = 260;
  
  // Divider line under content with tiny tooth in the center
  doc.setDrawColor(233, 213, 255); // Light violet
  doc.setLineWidth(0.4);
  doc.line(leftMargin, footerY, rightMargin, footerY);
  drawTinyTooth(105, footerY);

  // Clean, classic, perfectly centered footer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(107, 33, 168); // Violet
  doc.text(settings.bill_footer_message || "Thank you for choosing RK Dental Clinic.", 105, footerY + 8, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text("This is a computer-generated prescription and does not require a physical signature.", 105, footerY + 13, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 33, 168);
  doc.text("Get well soon!", 105, footerY + 18, { align: "center" });

  // Elegant very light slate trim frame bounding the workspace margins
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  doc.rect(8, 8, 194, 281, "S");

  return doc;
}
