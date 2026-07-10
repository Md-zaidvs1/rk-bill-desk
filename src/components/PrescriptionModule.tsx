import React, { useState, useEffect } from "react";
import { Plus, Trash2, Printer, Download, Share2, Save, FileText, Search, PlusCircle, CheckCircle, RefreshCw, Eye, Stethoscope, X, Bluetooth } from "lucide-react";
import { Prescription, Medicine, ClinicSettings } from "../types";
import jsPDF from "jspdf";
import { supabase } from "../supabaseClient";
import { bluetoothPrinter } from "../BluetoothPrinter";

interface PrescriptionModuleProps {
  settings: ClinicSettings;
  initialTab?: "create" | "history";
  activePatient?: { name: string; phone: string };
  onActivePatientChange?: (p: { name: string; phone: string }) => void;
}

const COMMON_DENTAL_MEDICINES = [
  { name: "Amoxicillin (500mg)", dosage: "1 Capsule", frequency: "1-1-1", duration: "5 Days", instructions: "After Food" },
  { name: "Metronidazole (400mg)", dosage: "1 Tablet", frequency: "1-1-1", duration: "5 Days", instructions: "After Food" },
  { name: "Paracetamol (650mg)", dosage: "1 Tablet", frequency: "1-0-1", duration: "3 Days", instructions: "After Food (for pain/fever)" },
  { name: "Ketorolac DT (10mg)", dosage: "1 Tablet (Dissolvable)", frequency: "As needed (SOS)", duration: "3 Days", instructions: "After Food (extreme pain)" },
  { name: "Pantoprazole (40mg)", dosage: "1 Tablet", frequency: "1-0-0", duration: "5 Days", instructions: "30 Mins Before Food" },
  { name: "Mouthwash (Chlorhexidine 0.2%)", dosage: "10 ml", frequency: "Rinse twice daily", duration: "7 Days", instructions: "After brushing (do not swallow)" },
  { name: "Choline Salicylate Gel", dosage: "Apply topically", frequency: "3 to 4 times daily", duration: "5 Days", instructions: "Apply on affected ulcer/gums" }
];

export default function PrescriptionModule({ settings, initialTab = "create", activePatient, onActivePatientChange }: PrescriptionModuleProps) {
  // Mode: "create" or "history"
  const [activeTab, setActiveTab] = useState<"create" | "history">(initialTab);
  
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Prescription Form State
  const [patientName, setPatientName] = useState("");
  const [patientMobile, setPatientMobile] = useState("");

  // Sync with global activePatient prop if provided
  useEffect(() => {
    if (activePatient) {
      setPatientName(activePatient.name || "");
      setPatientMobile(activePatient.phone || "");
    }
  }, [activePatient]);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([
    { name: "", dosage: "", frequency: "", duration: "", instructions: "" }
  ]);

  // Dynamic Prescription Quick-Picks list
  const [prescriptionPicks, setPrescriptionPicks] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem("rk_prescription_picks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { name: "Amoxicillin (500mg)", dosage: "1 Capsule", frequency: "1-1-1", duration: "5 Days", instructions: "After Food" },
      { name: "Metronidazole (400mg)", dosage: "1 Tablet", frequency: "1-1-1", duration: "5 Days", instructions: "After Food" },
      { name: "Paracetamol (650mg)", dosage: "1 Tablet", frequency: "1-0-1", duration: "3 Days", instructions: "After Food (for pain/fever)" },
      { name: "Ketorolac DT (10mg)", dosage: "1 Tablet (Dissolvable)", frequency: "As needed (SOS)", duration: "3 Days", instructions: "After Food (extreme pain)" },
      { name: "Pantoprazole (40mg)", dosage: "1 Tablet", frequency: "1-0-0", duration: "5 Days", instructions: "30 Mins Before Food" },
      { name: "Mouthwash (Chlorhexidine 0.2%)", dosage: "10 ml", frequency: "Rinse twice daily", duration: "7 Days", instructions: "After brushing (do not swallow)" },
      { name: "Choline Salicylate Gel", dosage: "Apply topically", frequency: "3 to 4 times daily", duration: "5 Days", instructions: "Apply on affected ulcer/gums" }
    ];
  });

  const [showAddMedForm, setShowAddMedForm] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [newMedFreq, setNewMedFreq] = useState("");
  const [newMedDuration, setNewMedDuration] = useState("");
  const [newMedInst, setNewMedInst] = useState("");

  const handleAddMedPick = () => {
    if (!newMedName.trim()) return;
    const newMed: Medicine = {
      name: newMedName.trim(),
      dosage: newMedDosage.trim(),
      frequency: newMedFreq.trim(),
      duration: newMedDuration.trim(),
      instructions: newMedInst.trim()
    };
    const updated = [...prescriptionPicks, newMed];
    setPrescriptionPicks(updated);
    localStorage.setItem("rk_prescription_picks", JSON.stringify(updated));
    setNewMedName("");
    setNewMedDosage("");
    setNewMedFreq("");
    setNewMedDuration("");
    setNewMedInst("");
    setShowAddMedForm(false);
  };

  const handleDeleteMedPick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = prescriptionPicks.filter((_, idx) => idx !== index);
    setPrescriptionPicks(updated);
    localStorage.setItem("rk_prescription_picks", JSON.stringify(updated));
  };

  // Archives State
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selected prescription for previewing/printing/sharing from history
  const [previewPrescription, setPreviewPrescription] = useState<Prescription | null>(null);

  // Modal view for a specific prescription loaded from server
  const [selectedModalPrescription, setSelectedModalPrescription] = useState<Prescription | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);

  const fetchPrescriptions = async (queryParam = "") => {
    setLoading(true);
    setError(null);
    try {
      let queryBuilder = supabase
        .from("prescriptions")
        .select("*")
        .order("id", { ascending: false });

      const cleanQuery = queryParam.trim();
      if (cleanQuery) {
        queryBuilder = queryBuilder.or(
          `patient_name.ilike.%${cleanQuery}%,patient_mobile.ilike.%${cleanQuery}%`
        );
      } else {
        queryBuilder = queryBuilder.limit(150);
      }

      const { data, error: err } = await queryBuilder;

      if (err) {
        throw new Error(err.message);
      }

      // Format medicines field to parsed JSON if stored as string
      const formatted = (data || []).map((p: any) => ({
        ...p,
        medicines: typeof p.medicines === "string" ? JSON.parse(p.medicines) : p.medicines
      }));

      setPrescriptions(formatted);
    } catch (err: any) {
      setError(err.message || "Failed to load prescription archives from cloud.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "history") return;
    const delayDebounceFn = setTimeout(() => {
      fetchPrescriptions(searchQuery);
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab]);

  const handleAddMedicine = () => {
    setMedicines([...medicines, { name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  };

  const handleRemoveMedicine = (index: number) => {
    if (medicines.length === 1) {
      setMedicines([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
    } else {
      setMedicines(medicines.filter((_, i) => i !== index));
    }
  };

  const handleMedicineFieldChange = (index: number, field: keyof Medicine, value: string) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const handleQuickAddMedicine = (med: Medicine) => {
    const emptyIdx = medicines.findIndex(m => !m.name);
    if (emptyIdx !== -1) {
      const updated = [...medicines];
      updated[emptyIdx] = { 
        name: med.name, 
        dosage: med.dosage || "", 
        frequency: med.frequency || "", 
        duration: med.duration || "", 
        instructions: med.instructions || "" 
      };
      setMedicines(updated);
    } else {
      setMedicines([...medicines, { 
        name: med.name, 
        dosage: med.dosage || "", 
        frequency: med.frequency || "", 
        duration: med.duration || "", 
        instructions: med.instructions || "" 
      }]);
    }
  };

  const handleResetForm = () => {
    setPatientName("");
    setPatientMobile("");
    if (onActivePatientChange) {
      onActivePatientChange({ name: "", phone: "" });
    }
    setDoctorNotes("");
    setMedicines([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
    setError(null);
    setSuccess(null);
    setPreviewPrescription(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!patientName.trim()) {
      setError("Patient name is required.");
      return;
    }

    const validMedicines = medicines.filter(m => m.name.trim() !== "");
    if (validMedicines.length === 0) {
      setError("Please add at least one medicine to the prescription.");
      return;
    }

    setSaving(true);
    const currentDate = new Date().toISOString().split("T")[0];

    try {
      const { data, error: err } = await supabase
        .from("prescriptions")
        .insert([
          {
            patient_name: patientName.trim(),
            patient_mobile: patientMobile.trim(),
            date: currentDate,
            doctor_notes: doctorNotes.trim(),
            medicines: validMedicines
          }
        ])
        .select();

      if (err || !data || data.length === 0) {
        throw new Error(err?.message || "Could not write prescription to the cloud.");
      }

      const savedRecord = {
        ...data[0],
        medicines: typeof data[0].medicines === "string" ? JSON.parse(data[0].medicines) : data[0].medicines
      };

      setSuccess("Prescription saved successfully!");
      setPreviewPrescription(savedRecord);
    } catch (err: any) {
      setError(err.message || "Error saving prescription to cloud database.");
    } finally {
      setSaving(false);
    }
  };

  // WhatsApp Share Construction
  const handleWhatsAppShare = (pres: Prescription) => {
    const rawMobile = pres?.patient_mobile || "";
    let cleanMobile = rawMobile.replace(/\D/g, "");
    if (cleanMobile.startsWith("0")) {
      cleanMobile = cleanMobile.substring(1);
    }

    if (!cleanMobile) {
      alert("Friendly reminder: Please make sure a valid mobile number is registered for the patient to share via WhatsApp.");
      return;
    }

    const formattedMobile = cleanMobile.startsWith("91") ? cleanMobile : `91${cleanMobile}`;

    // Format medicines into structured text block
    const medText = pres.medicines.map((m, idx) => 
      `${idx + 1}. ${m.name}\n   Dosage: ${m.dosage || "--"} | Freq: ${m.frequency || "--"} | Dur: ${m.duration || "--"}${m.instructions ? `\n   Inst: ${m.instructions}` : ""}`
    ).join("\n\n");

    const text = settings.whatsapp_message_template
      .replace("{patient_name}", pres.patient_name)
      .replace("{clinic_name}", settings.clinic_name)
      .replace("{medicines_text}", medText)
      .replace("{notes}", pres.doctor_notes || "None");

    const url = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  // Generate and download formal A4 PDF
  const handleDownloadPDF = (pres: Prescription) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Outer border
    doc.setDrawColor(30, 64, 175); // Deep Blue border
    doc.setLineWidth(1.5);
    doc.rect(5, 5, 200, 287, "S");

    // Letterhead header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 64, 175); // Deep Blue (#1E40AF)
    doc.text(settings.clinic_name, 15, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    
    // Split address into multiple lines if needed
    const addressLines = doc.splitTextToSize(settings.address, 120);
    doc.text(addressLines, 15, 26);
    
    const addressHeight = addressLines.length * 4;
    doc.text(`Phone: ${settings.phone}`, 15, 28 + addressHeight);

    // Letterhead right side (rx metadata)
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(75, 85, 99);
    doc.text("PRESCRIPTION (Rx)", 150, 20);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${pres.date}`, 150, 26);
    doc.text(`Doc ID: DR-RK-001`, 150, 31);

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(15, 36 + addressHeight, 195, 36 + addressHeight);

    // Patient Details
    const patientY = 42 + addressHeight;
    doc.setFillColor(243, 244, 246);
    doc.rect(15, patientY, 180, 18, "F");
    doc.setDrawColor(229, 231, 235);
    doc.rect(15, patientY, 180, 18, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.text("Patient Name :", 20, patientY + 7);
    doc.text("Patient Phone:", 20, patientY + 13);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 24, 39);
    doc.text(pres.patient_name, 50, patientY + 7);
    doc.text(pres.patient_mobile || "N/A", 50, patientY + 13);

    let startY = patientY + 28;

    // Doctor Clinical Notes
    if (pres.doctor_notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 64, 175);
      doc.text("Clinical Notes / Diagnosis:", 15, startY);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      const notesLines = doc.splitTextToSize(pres.doctor_notes, 180);
      doc.text(notesLines, 15, startY + 6);
      
      startY += 12 + notesLines.length * 5;
    }

    // Medicine Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Prescribed Medicines (Rx):", 15, startY);
    startY += 6;

    // Draw Table Header
    doc.setFillColor(30, 64, 175);
    doc.rect(15, startY, 180, 8, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Medicine Name", 20, startY + 5.5);
    doc.text("Dosage", 80, startY + 5.5);
    doc.text("Frequency", 115, startY + 5.5);
    doc.text("Duration", 145, startY + 5.5);
    doc.text("Instructions", 168, startY + 5.5);
    
    startY += 8;

    // Draw Items
    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 41, 55);
    
    pres.medicines.forEach((med, i) => {
      // Background shading alternate lines
      if (i % 2 === 1) {
        doc.setFillColor(249, 250, 251);
        doc.rect(15, startY, 180, 8, "F");
      }
      doc.text(med.name, 20, startY + 5.5);
      doc.text(med.dosage || "--", 80, startY + 5.5);
      doc.text(med.frequency || "--", 115, startY + 5.5);
      doc.text(med.duration || "--", 145, startY + 5.5);
      doc.text(med.instructions || "--", 168, startY + 5.5);
      
      startY += 8;
    });

    // Signature Block (Fixed near the bottom)
    const pageHeight = doc.internal.pageSize.height;
    doc.setDrawColor(229, 231, 235);
    doc.line(15, pageHeight - 35, 195, pageHeight - 35);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.text("Dr. V. Radhakrishnan BDS., D.Endo.", 195, pageHeight - 25, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("Registered Dental Surgeon", 195, pageHeight - 21, { align: "right" });
    doc.text("Authorized Signature & Seal", 195, pageHeight - 17, { align: "right" });

    // Footer info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text("Thank you for trusting us with your dental health!", 15, pageHeight - 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("Complete the course of prescribed medication. Keep out of reach of children.", 15, pageHeight - 21);
    doc.text("Contact the clinic in case of any allergy or adverse reactions.", 15, pageHeight - 17);

    doc.save(`Prescription_${pres.patient_name.replace(/\s+/g, "_")}_${pres.date}.pdf`);
  };

  const handlePrintPrescription = (pres: Prescription) => {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow popups to print prescriptions.");
      return;
    }

    // Generate nice printable HTML markup for printing
    win.document.write(`
      <html>
        <head>
          <title>Prescription_${pres.patient_name}</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; line-height: 1.5; color: #1f2937; }
            }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1f2937; }
            .header { border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; }
            .clinic-name { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 5px; }
            .clinic-details { font-size: 11px; color: #4b5563; line-height: 1.4; }
            .rx-title { text-align: right; }
            .rx-title h2 { margin: 0; font-size: 20px; color: #1e40af; letter-spacing: 0.5px; }
            .patient-box { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; border-radius: 6px; }
            .patient-col { width: 48%; }
            .patient-row { margin-bottom: 4px; }
            .patient-row strong { display: inline-block; width: 110px; color: #4b5563; font-size: 12px; }
            .section-title { font-size: 14px; font-weight: bold; border-bottom: 1.5px solid #1e40af; padding-bottom: 4px; margin-bottom: 10px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; }
            .notes { margin-bottom: 25px; white-space: pre-line; color: #374151; font-size: 13px; line-height: 1.5; background: #fafafa; padding: 10px; border-left: 3px solid #1e40af; }
            .med-table { width: 100%; border-collapse: collapse; margin-bottom: 50px; table-layout: fixed; }
            .med-table th { background: #1e40af; color: #ffffff; text-align: left; padding: 10px; font-weight: bold; font-size: 12px; border: 1px solid #1e40af; word-wrap: break-word; overflow-wrap: break-word; }
            .med-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; word-wrap: break-word; overflow-wrap: break-word; }
            .med-table tr:nth-child(even) { background-color: #f9fafb; }
            .signature-block { margin-top: 100px; text-align: right; border-top: 1px solid #e5e7eb; padding-top: 15px; }
            .signature-block strong { font-size: 14px; color: #1e40af; }
            .stamp { color: #6b7280; font-size: 10px; margin-top: 2px; line-height: 1.3; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="clinic-name">${settings.clinic_name}</div>
              <div class="clinic-details">${settings.address.replace(/\n/g, "<br>")}</div>
              <div class="clinic-details" style="margin-top: 3px;"><strong>Phone:</strong> ${settings.phone}</div>
            </div>
            <div class="rx-title">
              <h2>PRESCRIPTION</h2>
              <div style="font-size: 11px; color: #4b5563; margin-top: 8px; line-height: 1.4;">
                <strong>Date:</strong> ${pres.date}<br>
                <strong>Rx ID:</strong> RX-${pres.id || "000"}
              </div>
            </div>
          </div>

          <div class="patient-box">
            <div class="patient-col">
              <div class="patient-row"><strong>Patient Name:</strong> ${pres.patient_name}</div>
            </div>
            <div class="patient-col">
              <div class="patient-row"><strong>Mobile Phone:</strong> ${pres.patient_mobile || "N/A"}</div>
            </div>
          </div>

          ${pres.doctor_notes ? `
            <div class="section-title">Clinical Notes & Diagnosis</div>
            <div class="notes">${pres.doctor_notes}</div>
          ` : ""}

          <div class="section-title" style="margin-top: 25px;">Rx Medications</div>
          <table class="med-table">
            <thead>
              <tr>
                <th style="width: 25%;">Medicine Name</th>
                <th style="width: 15%;">Dosage</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 15%;">Duration</th>
                <th style="width: 30%;">Instructions</th>
              </tr>
            </thead>
            <tbody>
              ${pres.medicines.map(m => `
                <tr>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.dosage || "—"}</td>
                  <td>${m.frequency || "—"}</td>
                  <td>${m.duration || "—"}</td>
                  <td>${m.instructions || "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="signature-block">
            <strong>Dr. V. Radhakrishnan BDS., D.Endo.</strong><br>
            <span class="stamp">Registered Dental Surgeon<br>Clinic Seal / Signature</span>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleBluetoothPrintRx = async (pres: Prescription) => {
    try {
      await bluetoothPrinter.printPrescription(pres, settings);
    } catch (err: any) {
      alert(err.message || "Failed to print prescription via Bluetooth. Ensure the printer is powered on and within range.");
    }
  };

  const handleArchiveDelete = async (id: number) => {
    const ok = window.confirm("Are you sure you want to permanently delete this prescription record?");
    if (!ok) return;

    try {
      const { error: err } = await supabase
        .from("prescriptions")
        .delete()
        .eq("id", id);

      if (err) {
        throw new Error(err.message);
      }

      setPrescriptions(prescriptions.filter(p => p.id !== id));
      if (previewPrescription?.id === id) {
        setPreviewPrescription(null);
      }
      if (selectedModalPrescription?.id === id) {
        setSelectedModalPrescription(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete prescription from database.");
    }
  };

  const handleViewPrescription = async (id: number) => {
    setLoadingModal(true);
    try {
      const { data, error: err } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (err) {
        throw new Error(err.message);
      }

      const formatted = {
        ...data,
        medicines: typeof data.medicines === "string" ? JSON.parse(data.medicines) : data.medicines
      };

      setSelectedModalPrescription(formatted);
    } catch (err: any) {
      alert(err.message || "Failed to load prescription archive details.");
    } finally {
      setLoadingModal(false);
    }
  };

  // Filter archived prescriptions
  const filteredPrescriptions = prescriptions.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.patient_name.toLowerCase().includes(q) ||
      p.patient_mobile.toLowerCase().includes(q) ||
      p.date.includes(q)
    );
  });

  return (
    <div className="bg-white border border-gray-250 p-6 shadow-sm rounded-lg">
      
      {/* Dynamic Tabs Navigation Header inside module */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => {
            setActiveTab("create");
            setSuccess(null);
            setError(null);
          }}
          className={`py-2.5 px-5 text-xs font-bold uppercase tracking-wider cursor-pointer rounded-t-lg border-t border-x -mb-[1px] transition-all flex items-center space-x-2 ${
            activeTab === "create"
              ? "border-gray-200 border-b-white bg-white text-blue-800"
              : "border-transparent bg-gray-50 text-gray-500 hover:text-gray-800"
          }`}
        >
          <PlusCircle className="w-4 h-4 text-blue-800" />
          <span>Create Prescription</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("history");
            setSuccess(null);
            setError(null);
          }}
          className={`py-2.5 px-5 text-xs font-bold uppercase tracking-wider cursor-pointer rounded-t-lg border-t border-x -mb-[1px] transition-all flex items-center space-x-2 ${
            activeTab === "history"
              ? "border-gray-200 border-b-white bg-white text-blue-800"
              : "border-transparent bg-gray-50 text-gray-500 hover:text-gray-800"
          }`}
        >
          <FileText className="w-4 h-4 text-blue-800" />
          <span>Search Archives</span>
        </button>
      </div>

      {activeTab === "create" ? (
        // CREATE TAB
        <div>
          <div className="border-b border-gray-100 pb-3 mb-5">
            <h3 className="text-md font-bold text-gray-900 tracking-tight flex items-center space-x-2">
              <Stethoscope className="w-4 h-4 text-blue-800" />
              <span>Dental Rx Dispensing Sheet</span>
            </h3>
            <p className="text-xs text-gray-500">Draft full medical orders, diagnostic advice, and share responsive prescriptions</p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 mb-5 text-xs rounded-r-md">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 mb-5 text-xs rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
                <span className="font-semibold">{success}</span>
              </div>
              <button
                onClick={handleResetForm}
                className="bg-blue-800 hover:bg-blue-900 text-white text-[10px] py-1.5 px-3 rounded-md font-bold uppercase tracking-wider cursor-pointer transition-all shadow-sm"
              >
                Draft Next Rx
              </button>
            </div>
          )}

          <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Patient Details & Quick Selection */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Demographics Card */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Patient Demographics</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Patient Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatientName(val);
                        if (onActivePatientChange) {
                          onActivePatientChange({ name: val, phone: patientMobile });
                        }
                      }}
                      placeholder="e.g. John Doe"
                      className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-955 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Mobile Number (WhatsApp)
                    </label>
                    <input
                      type="text"
                      value={patientMobile}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatientMobile(val);
                        if (onActivePatientChange) {
                          onActivePatientChange({ name: patientName, phone: val });
                        }
                      }}
                      placeholder="e.g. +919876543210"
                      className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Clinical notes card */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Clinical Findings & Diagnostics</h4>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter diagnosis, complaints, tooth numbers, or special guidelines (e.g. RCT teeth #46, review in 7 days, rinse twice daily)"
                  rows={4}
                  className="w-full bg-white border border-gray-300 p-3 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all font-sans leading-relaxed"
                />
              </div>

              {/* Quick Select Medicines */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div className="mb-3 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Prescription Quick-Picks</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">Click to instantly populate a medicine row.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddMedForm(!showAddMedForm)}
                    className="bg-blue-800 hover:bg-blue-900 text-white p-1.5 rounded cursor-pointer transition-colors"
                    title="Add new pick"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {showAddMedForm && (
                  <div className="bg-white p-3 border border-gray-200 rounded-md mb-3 space-y-2 text-xs shadow-sm">
                    <div className="font-bold text-gray-700 text-[10px] uppercase tracking-wider">Add Quick-Pick</div>
                    <div>
                      <input
                        type="text"
                        placeholder="Medicine Name (required)"
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        className="w-full bg-white border border-gray-300 px-2.5 py-1.5 text-xs text-gray-950 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 rounded"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        placeholder="Dosage"
                        value={newMedDosage}
                        onChange={(e) => setNewMedDosage(e.target.value)}
                        className="w-full bg-white border border-gray-300 px-2 py-1 text-[11px] text-gray-950 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Freq (1-0-1)"
                        value={newMedFreq}
                        onChange={(e) => setNewMedFreq(e.target.value)}
                        className="w-full bg-white border border-gray-300 px-2 py-1 text-[11px] text-gray-950 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Duration"
                        value={newMedDuration}
                        onChange={(e) => setNewMedDuration(e.target.value)}
                        className="w-full bg-white border border-gray-300 px-2 py-1 text-[11px] text-gray-950 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 rounded"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Instructions (e.g. After Food)"
                        value={newMedInst}
                        onChange={(e) => setNewMedInst(e.target.value)}
                        className="w-full bg-white border border-gray-300 px-2.5 py-1.5 text-xs text-gray-955 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 rounded"
                      />
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddMedForm(false)}
                        className="px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 rounded cursor-pointer font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddMedPick}
                        disabled={!newMedName.trim()}
                        className="bg-blue-800 hover:bg-blue-900 disabled:bg-gray-300 text-white px-3 py-1 text-[11px] rounded font-bold cursor-pointer transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {prescriptionPicks.map((med, i) => (
                    <div
                      key={i}
                      className="w-full bg-white border border-gray-200 hover:border-blue-800 hover:bg-blue-50/10 rounded-md text-xs flex justify-between items-center transition-all text-gray-800 group"
                    >
                      <button
                        type="button"
                        onClick={() => handleQuickAddMedicine(med)}
                        className="flex-1 text-left p-2.5 cursor-pointer truncate flex justify-between items-center"
                      >
                        <span className="font-semibold truncate pr-1 group-hover:text-blue-900">{med.name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0 font-mono">{med.frequency || med.dosage || ""}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMedPick(i, e)}
                        className="p-2 mr-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer shrink-0 opacity-100"
                        title="Delete pick template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Medicines Editor and Layout Previews */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-100 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Prescribed Medicines Ledger</span>
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    className="bg-white border border-gray-300 hover:border-blue-800 hover:bg-blue-50/10 text-gray-750 py-1.5 px-3 rounded text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-800" />
                    <span>Add Drug Row</span>
                  </button>
                </div>

                <div className="p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="pb-3 w-8 text-center">#</th>
                          <th className="pb-3 pl-2">Medicine / Drug Description</th>
                          <th className="pb-3 w-28 pl-2">Dosage</th>
                          <th className="pb-3 w-28 pl-2">Frequency</th>
                          <th className="pb-3 w-28 pl-2">Duration</th>
                          <th className="pb-3 pl-2">Instructions</th>
                          <th className="pb-3 w-28 text-center">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {medicines.map((med, index) => (
                          <tr key={index} className="hover:bg-gray-50/40">
                            <td className="py-2.5 text-center text-xs font-mono text-gray-400">{index + 1}</td>
                            <td className="py-2 pl-2">
                              <input
                                type="text"
                                required
                                value={med.name}
                                onChange={(e) => handleMedicineFieldChange(index, "name", e.target.value)}
                                placeholder="e.g. Amoxicillin (500mg)"
                                className="w-full bg-transparent border-b border-transparent focus:border-blue-800 py-1 focus:outline-none text-xs font-bold text-gray-900 placeholder-gray-300"
                              />
                            </td>
                            <td className="py-2 pl-2">
                              <input
                                type="text"
                                value={med.dosage}
                                onChange={(e) => handleMedicineFieldChange(index, "dosage", e.target.value)}
                                placeholder="e.g. 1 cap"
                                className="w-full bg-transparent border-b border-transparent focus:border-blue-800 py-1 focus:outline-none text-xs text-gray-700"
                              />
                            </td>
                            <td className="py-2 pl-2">
                              <input
                                type="text"
                                value={med.frequency}
                                onChange={(e) => handleMedicineFieldChange(index, "frequency", e.target.value)}
                                placeholder="e.g. 1-0-1"
                                className="w-full bg-transparent border-b border-transparent focus:border-blue-800 py-1 focus:outline-none text-xs text-gray-700"
                              />
                            </td>
                            <td className="py-2 pl-2">
                              <input
                                type="text"
                                value={med.duration}
                                onChange={(e) => handleMedicineFieldChange(index, "duration", e.target.value)}
                                placeholder="e.g. 5 Days"
                                className="w-full bg-transparent border-b border-transparent focus:border-blue-800 py-1 focus:outline-none text-xs text-gray-700"
                              />
                            </td>
                            <td className="py-2 pl-2">
                              <input
                                type="text"
                                value={med.instructions}
                                onChange={(e) => handleMedicineFieldChange(index, "instructions", e.target.value)}
                                placeholder="e.g. After Food"
                                className="w-full bg-transparent border-b border-transparent focus:border-blue-800 py-1 focus:outline-none text-xs text-gray-750"
                              />
                            </td>
                            <td className="py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMedicine(index)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded transition-colors cursor-pointer shadow-sm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gray-50 border-t border-gray-200 px-5 py-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-2.5 px-6 rounded-md text-xs tracking-wider uppercase flex items-center justify-center space-x-2 disabled:bg-gray-400 cursor-pointer shadow-md transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? "Registering Rx..." : "Save Prescription Record"}</span>
                  </button>
                </div>
              </div>

              {/* Instant Controls for Newly Saved Rx */}
              {previewPrescription && (
                <div className="bg-blue-50/50 p-5 border border-dashed border-blue-200 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4 shadow-inner">
                  <div>
                    <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Dispensing Actions</h5>
                    <p className="text-xs text-gray-600 mt-1">
                      Prescription for <strong className="text-gray-950">{previewPrescription.patient_name}</strong> is registered.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleBluetoothPrintRx(previewPrescription)}
                      className="bg-sky-700 text-white hover:bg-sky-800 py-1.5 px-3.5 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <Bluetooth className="w-4 h-4 animate-pulse" />
                      <span>POS Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintPrescription(previewPrescription)}
                      className="bg-white border border-gray-300 text-gray-750 hover:bg-gray-50 hover:border-gray-400 py-1.5 px-3.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <Printer className="w-4 h-4 text-gray-500" />
                      <span>Print (A4 Sheet)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPDF(previewPrescription)}
                      className="bg-white border border-gray-300 text-gray-750 hover:bg-gray-50 hover:border-gray-400 py-1.5 px-3.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                      <span>Save PDF File</span>
                    </button>
                    {previewPrescription.patient_mobile && (
                      <button
                        type="button"
                        onClick={() => handleWhatsAppShare(previewPrescription)}
                        className="bg-emerald-700 text-white hover:bg-emerald-800 py-1.5 px-3.5 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Send WhatsApp</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>

          </form>
        </div>
      ) : (
        // ARCHIVES HISTORY TAB
        <div>
          <div className="border-b border-gray-100 pb-3 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-md font-bold text-gray-900 tracking-tight">Prescription Database Archives</h3>
              <p className="text-xs text-gray-500">Query, print, or share previously generated patient medical prescriptions</p>
            </div>
            <button
              onClick={fetchPrescriptions}
              className="bg-white border border-gray-300 text-gray-750 hover:bg-gray-50 hover:border-gray-400 py-1.5 px-3.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shrink-0 self-start"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              <span>Refresh Archives</span>
            </button>
          </div>

          <div className="mb-5">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search className="w-4 h-4 text-gray-400" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prescription database by Patient Name, Phone, or date..."
                className="w-full bg-white border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* List Table */}
            <div className="xl:col-span-2 border border-gray-200 rounded-lg overflow-hidden shadow-sm h-fit">
              {loading ? (
                <div className="p-12 text-center text-sm font-mono text-gray-500">
                  Scanning clinical records...
                </div>
              ) : filteredPrescriptions.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-450 font-medium">
                  No matching prescription records found in database.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="p-3.5 pl-4">Date</th>
                      <th className="p-3.5">Patient Name</th>
                      <th className="p-3.5">Mobile Phone</th>
                      <th className="p-3.5 w-24 text-center">Meds</th>
                      <th className="p-3.5 text-center w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredPrescriptions.map((pres) => (
                      <tr
                        key={pres.id}
                        onClick={() => setPreviewPrescription(pres)}
                        className={`hover:bg-gray-50/70 transition-all cursor-pointer ${
                          previewPrescription?.id === pres.id ? "bg-blue-50/40 font-semibold" : ""
                        }`}
                      >
                        <td className="p-3.5 pl-4 font-mono text-gray-500">{pres.date}</td>
                        <td className="p-3.5 font-semibold text-gray-900">{pres.patient_name}</td>
                        <td className="p-3.5 font-mono text-gray-600">{pres.patient_mobile || "--"}</td>
                        <td className="p-3.5 text-center font-bold text-blue-800">
                          {pres.medicines?.length || 0}
                        </td>
                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center space-x-1.5">
                            <button
                              onClick={() => handleViewPrescription(pres.id)}
                              title="View Prescription Details"
                              className="bg-white border border-gray-300 text-gray-700 hover:border-blue-800 hover:bg-blue-50/10 p-1.5 rounded cursor-pointer transition-all shadow-sm"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchiveDelete(pres.id)}
                              title="Delete Prescription"
                              className="bg-white border border-red-200 p-1.5 hover:bg-red-50 text-red-500 hover:border-red-500 rounded cursor-pointer transition-all shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Preview Box */}
            <div className="xl:col-span-1">
              {previewPrescription ? (
                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-left space-y-4">
                  <div className="border-b border-gray-200 pb-3">
                    <h4 className="font-bold text-gray-900 text-sm tracking-tight">Prescription Sheet Preview</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">Rx Serial: RX-{previewPrescription.id}</p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span className="text-gray-400">Date:</span> 
                      <span className="font-mono text-gray-800">{previewPrescription.date}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span className="text-gray-400">Patient:</span> 
                      <strong className="text-gray-900">{previewPrescription.patient_name}</strong>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span className="text-gray-400">WhatsApp No:</span> 
                      <span className="font-mono text-gray-800">{previewPrescription.patient_mobile || "N/A"}</span>
                    </div>
                  </div>

                  {previewPrescription.doctor_notes && (
                    <div className="bg-white p-3 border border-gray-100 text-xs text-gray-650 italic rounded-md leading-relaxed shadow-sm">
                      <span className="font-bold not-italic block uppercase text-[9px] text-blue-800 tracking-wider mb-1">Clinical Findings & Diagnosis</span>
                      {previewPrescription.doctor_notes}
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="font-bold uppercase text-[9px] text-gray-400 tracking-wider block">Rx Medication Details</span>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {previewPrescription.medicines?.map((m, i) => (
                        <div key={i} className="bg-white p-3 rounded-md border border-gray-100 text-xs shadow-sm">
                          <div className="font-bold text-gray-800">{m.name}</div>
                          <div className="text-[10px] text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono">
                            <span>Dosage: <strong className="text-gray-700">{m.dosage || "--"}</strong></span>
                            <span>•</span>
                            <span>Freq: <strong className="text-gray-700">{m.frequency || "--"}</strong></span>
                            <span>•</span>
                            <span>Dur: <strong className="text-gray-700">{m.duration || "--"}</strong></span>
                          </div>
                          {m.instructions && (
                            <div className="text-[10px] text-blue-800/80 bg-blue-50/30 px-1.5 py-0.5 rounded border border-blue-100/20 mt-1.5 font-sans italic w-fit">
                              Inst: {m.instructions}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handlePrintPrescription(previewPrescription)}
                      className="flex-1 bg-blue-800 hover:bg-blue-900 text-white py-2 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(previewPrescription)}
                      className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 py-2 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    {previewPrescription.patient_mobile && (
                      <button
                        onClick={() => handleWhatsAppShare(previewPrescription)}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white py-2 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-md"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-12 text-center rounded-lg border border-gray-200 text-xs font-mono text-gray-400 shadow-inner">
                  Select a registered prescription row from the archive table to see clinical notes, drug breakdowns, and print/share controls.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* View Prescription Details Modal */}
      {selectedModalPrescription && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-2xl w-full overflow-hidden text-left flex flex-col">
            {/* Modal Header */}
            <div className="bg-gray-100 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-800" />
                <h3 className="font-bold text-gray-900 text-base">Prescription Details</h3>
              </div>
              <button
                onClick={() => setSelectedModalPrescription(null)}
                className="text-gray-400 hover:text-gray-650 p-1.5 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-md border border-gray-150">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Patient Name</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">{selectedModalPrescription.patient_name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Mobile Phone</div>
                  <div className="text-sm font-mono font-semibold text-gray-800 mt-0.5">{selectedModalPrescription.patient_mobile || "N/A"}</div>
                </div>
                <div className="col-span-2 border-t border-gray-200 pt-2.5">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Prescription Date</div>
                  <div className="text-sm font-mono font-semibold text-gray-800 mt-0.5">{selectedModalPrescription.date}</div>
                </div>
              </div>

              {selectedModalPrescription.doctor_notes && (
                <div className="bg-blue-50/30 p-4 border border-blue-100 rounded-md text-xs leading-relaxed text-gray-700 italic">
                  <span className="font-bold not-italic block uppercase text-[10px] text-blue-800 tracking-wider mb-1.5">Diagnosis / Clinical Findings</span>
                  {selectedModalPrescription.doctor_notes}
                </div>
              )}

              <div className="space-y-3">
                <span className="font-bold uppercase text-[10px] text-gray-400 tracking-wider block">Prescribed Medicines</span>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="p-3 pl-4">Medicine Name</th>
                        <th className="p-3">Dosage</th>
                        <th className="p-3">Frequency</th>
                        <th className="p-3">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedModalPrescription.medicines?.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50/30">
                          <td className="p-3 pl-4 font-bold text-gray-800">
                            <div>{m.name}</div>
                            {m.instructions && (
                              <div className="text-[10px] font-normal text-blue-800/80 italic mt-0.5">Instructions: {m.instructions}</div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-gray-600">{m.dosage || "--"}</td>
                          <td className="p-3 font-mono text-gray-600">{m.frequency || "--"}</td>
                          <td className="p-3 font-mono text-gray-600">{m.duration || "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => handleBluetoothPrintRx(selectedModalPrescription)}
                className="bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 px-3.5 rounded-md text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-md"
              >
                <Bluetooth className="w-4 h-4 animate-pulse" />
                <span>Bluetooth POS Print</span>
              </button>
              <button
                onClick={() => handlePrintPrescription(selectedModalPrescription)}
                className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-2 px-3.5 rounded-md text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Browser Print</span>
              </button>
              <button
                onClick={() => handleDownloadPDF(selectedModalPrescription)}
                className="bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 font-bold py-2 px-3.5 rounded-md text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>PDF Download</span>
              </button>
              {selectedModalPrescription.patient_mobile && (
                <button
                  onClick={() => handleWhatsAppShare(selectedModalPrescription)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 rounded-md text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-md"
                >
                  <Share2 className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>
              )}
              <button
                onClick={() => setSelectedModalPrescription(null)}
                className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold py-2 px-4 rounded-md text-xs uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal Overlay */}
      {loadingModal && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-xs flex items-center justify-center">
          <div className="bg-white p-5 rounded-lg shadow-lg border border-gray-200 text-xs font-semibold text-gray-800 flex items-center space-x-2.5">
            <RefreshCw className="w-4 h-4 text-blue-800 animate-spin" />
            <span>Fetching complete prescription from database...</span>
          </div>
        </div>
      )}

    </div>
  );
}
