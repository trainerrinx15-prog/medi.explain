import React, { useState, useRef } from "react";
import { Upload, FileText, Search, ShieldCheck, Download, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { extractTextFromImage } from "./utils/ocr";
import { encryptText } from "./utils/crypto";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type LabValue = {
  testName: string;
  value: string;
  unit: string;
  status: "Normal" | "Slightly Abnormal" | "High" | "Low" | "Unknown";
  explanation: string;
};

type MedicalTerm = {
  term: string;
  explanation: string;
};

type AIResult = {
  summary: string;
  medicalTerms: MedicalTerm[];
  labValues: LabValue[];
  keyObservations: string[];
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "ocr" | "encrypting" | "analyzing" | "done" | "error">("idle");
  const [result, setResult] = useState<AIResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;
    try {
      setStatus("ocr");
      const text = await extractTextFromImage(file);
      
      setStatus("encrypting");
      const encryptedPayload = await encryptText(text);

      setStatus("analyzing");
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(encryptedPayload),
      });

      if (!response.ok) throw new Error("Failed to analyze document");
      const data = await response.json();
      setResult(data);
      setStatus("done");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred");
      setStatus("error");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setStatus("analyzing");
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) throw new Error("Failed to search term");
      const data = await response.json();
      setResult(data);
      setStatus("done");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred");
      setStatus("error");
    }
  };

  const downloadPDF = async () => {
    if (!resultRef.current) return;
    const canvas = await html2canvas(resultRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("MediExplain-Report.pdf");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Normal": return "bg-sage-500/10 text-sage-500 border-sage-500/20";
      case "Slightly Abnormal": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "High":
      case "Low": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-sky-500/20">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-ocean-700 flex items-center justify-center text-white font-serif text-xl">M</div>
            <span className="font-serif text-2xl font-medium tracking-tight text-ocean-700">MediExplain</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-sage-500 bg-sage-500/10 px-3 py-1.5 rounded-full font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>AES-256 Encrypted</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-6xl font-serif text-gray-900 leading-tight">
            Understand your medical data in <span className="text-sky-500 italic">simple language</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Upload prescriptions, lab reports, or search for medical terms. Our AI securely analyzes and explains everything without medical jargon.
          </p>
        </section>

        {/* Search & Upload Grid */}
        <section className="grid md:grid-cols-2 gap-8">
          {/* Upload Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-mist-50 rounded-2xl flex items-center justify-center text-sky-500 mb-6">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif mb-2">Upload Document</h3>
            <p className="text-sm text-gray-500 mb-6">JPG, PNG, or PDF up to 10MB</p>
            
            <label 
              className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-8 cursor-pointer hover:border-sky-500 hover:bg-mist-50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input type="file" className="hidden" accept="image/jpeg, image/png, application/pdf" onChange={handleFileChange} />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-ocean-700 font-medium">
                  <FileText className="w-5 h-5" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                </div>
              ) : (
                <span className="text-gray-500 font-medium">Click or drag file here</span>
              )}
            </label>
            
            <button 
              onClick={processFile}
              disabled={!file || status !== "idle" && status !== "done" && status !== "error"}
              className="mt-6 w-full bg-ocean-700 hover:bg-sky-500 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Analyze Document
            </button>
          </div>

          {/* Search Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif mb-2">Search Term</h3>
            <p className="text-sm text-gray-500 mb-6">Look up medicines, diseases, or lab tests</p>
            
            <form onSubmit={handleSearch} className="w-full relative">
              <input 
                type="text" 
                placeholder="e.g., Paracetamol, Hemoglobin..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
              <button 
                type="submit"
                disabled={!searchQuery.trim() || status !== "idle" && status !== "done" && status !== "error"}
                className="absolute right-2 top-2 bottom-2 bg-amber-500 hover:bg-amber-600 text-white px-6 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Search
              </button>
            </form>
          </div>
        </section>

        {/* Progress Indicator */}
        <AnimatePresence>
          {status !== "idle" && status !== "done" && status !== "error" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-mist-50 rounded-2xl p-6 flex items-center justify-center gap-4"
            >
              <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
              <span className="font-medium text-ocean-700">
                {status === "uploading" && "Uploading file..."}
                {status === "ocr" && "Extracting text from document..."}
                {status === "encrypting" && "Encrypting data securely..."}
                {status === "analyzing" && "AI is analyzing the information..."}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {status === "error" && (
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Results Section */}
        <AnimatePresence>
          {result && status === "done" && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="text-3xl font-serif text-gray-900">Analysis Results</h2>
                <button onClick={downloadPDF} className="flex items-center gap-2 text-sky-500 hover:text-ocean-700 font-medium transition-colors">
                  <Download className="w-5 h-5" />
                  <span>Download PDF</span>
                </button>
              </div>

              <div ref={resultRef} className="space-y-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                
                {/* Summary */}
                <div className="space-y-3">
                  <h3 className="text-xl font-serif text-ocean-700 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-sage-500" />
                    Summary
                  </h3>
                  <p className="text-gray-600 leading-relaxed">{result.summary}</p>
                </div>

                {/* Key Observations */}
                {result.keyObservations.length > 0 && (
                  <div className="space-y-3 pt-6 border-t border-gray-50">
                    <h3 className="text-xl font-serif text-ocean-700">Key Observations</h3>
                    <ul className="space-y-2">
                      {result.keyObservations.map((obs, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-2 shrink-0" />
                          <span>{obs}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Medical Terms */}
                {result.medicalTerms.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-gray-50">
                    <h3 className="text-xl font-serif text-ocean-700">Medical Terms Explained</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {result.medicalTerms.map((term, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <h4 className="font-medium text-gray-900 mb-1">{term.term}</h4>
                          <p className="text-sm text-gray-600">{term.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lab Values */}
                {result.labValues.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-gray-50">
                    <h3 className="text-xl font-serif text-ocean-700">Lab Values</h3>
                    <div className="space-y-3">
                      {result.labValues.map((lab, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-100 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900">{lab.testName}</h4>
                            <p className="text-sm text-gray-500 mt-1">{lab.explanation}</p>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <span className="font-mono font-medium text-gray-900">{lab.value}</span>
                              <span className="text-xs text-gray-500 ml-1">{lab.unit}</span>
                            </div>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusColor(lab.status)}`}>
                              {lab.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Disclaimer */}
        <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <strong>Medical Disclaimer:</strong> This tool explains medical information using AI and is not medical advice. Always consult a healthcare professional.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} MediExplain. All rights reserved.</p>
          <p className="mt-2">Your medical data is encrypted and never stored.</p>
        </div>
      </footer>
    </div>
  );
}
