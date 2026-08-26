import mammoth from "mammoth";

let pdfjsLibPromise = null;
async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      if (typeof window !== "undefined" && lib) {
        lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version || "4.0.379"}/pdf.worker.min.mjs`;
      }
      return lib;
    });
  }
  return pdfjsLibPromise;
}

/**
 * Convert File or Blob to Base64 string (data without prefix)
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === "string" ? result.split(",")[1] : "";
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Perform Gemini Vision OCR on an image file using gemini-3.6-flash (with fallbacks)
 */
export async function extractTextFromImage(file) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing (VITE_GEMINI_API_KEY).");
  }

  const base64Data = await fileToBase64(file);
  const mimeType = file.type || "image/jpeg";

  const models = ["gemini-3.6-flash", "gemini-1.5-flash"];
  let lastErrorMsg = "";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Extract all legible text from this document or image verbatim. Group logical lines into clear paragraphs. Do not add intro text, notes, or commentary.",
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        lastErrorMsg = errorData.error?.message || `Status ${response.status}`;
        if (lastErrorMsg.includes("no longer available") || lastErrorMsg.includes("not found")) {
          continue;
        }
        throw new Error(lastErrorMsg);
      }

      const data = await response.json();
      const extractedText =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!extractedText) {
        throw new Error("No readable text was detected in the provided image.");
      }

      return extractedText;
    } catch (err) {
      if (err.message?.includes("No readable text")) throw err;
      lastErrorMsg = err.message;
    }
  }

  throw new Error(lastErrorMsg || "OCR Request failed across models.");
}

/**
 * Render a PDF page onto a canvas and return it as a Blob
 */
async function pdfPageToImageBlob(page) {
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });
}

/**
 * Extract text from document file (.pdf, .docx, .doc, .txt)
 */
export async function extractTextFromFile(file, onProgress) {
  const fileName = file.name.toLowerCase();

  // TXT files
  if (fileName.endsWith(".txt") || file.type === "text/plain") {
    onProgress?.({ stage: "extracting", message: "Reading text file..." });
    const text = await file.text();
    if (!text.trim()) {
      throw new Error("The selected text file is empty.");
    }
    return text;
  }

  // DOCX / DOC files
  if (
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc") ||
    file.type.includes("wordprocessingml") ||
    file.type.includes("msword")
  ) {
    onProgress?.({ stage: "extracting", message: "Extracting text from DOCX..." });
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value?.trim() || "";
    if (!text) {
      throw new Error("Could not extract any text from the Word document.");
    }
    return text;
  }

  // PDF files
  if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
    onProgress?.({ stage: "extracting", message: "Reading PDF pages..." });
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.({
        stage: "extracting",
        page: i,
        total: pdf.numPages,
        message: `Extracting page ${i} of ${pdf.numPages}...`,
      });
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }

    // Fall back to OCR if extracted PDF text is too short (likely scanned image PDF)
    if (fullText.trim().length < 50 && pdf.numPages > 0) {
      onProgress?.({
        stage: "ocr",
        message: "Scanned PDF detected. Running Gemini Vision OCR...",
      });

      let ocrText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        onProgress?.({
          stage: "ocr",
          page: i,
          total: pdf.numPages,
          message: `Performing OCR on page ${i} of ${pdf.numPages}...`,
        });
        const page = await pdf.getPage(i);
        const imageBlob = await pdfPageToImageBlob(page);
        const pageOcr = await extractTextFromImage(imageBlob);
        ocrText += pageOcr + "\n\n";
      }

      if (ocrText.trim()) {
        return ocrText.trim();
      }
    }

    if (!fullText.trim()) {
      throw new Error("No readable text found in the PDF.");
    }

    return fullText.trim();
  }

  throw new Error(
    "Unsupported file format. Please upload a PDF, DOCX, TXT, or image file.",
  );
}

/**
 * Extract text from multiple images sequentially using Gemini Vision OCR
 */
export async function extractTextFromImages(files, onProgress) {
  let combinedText = [];

  for (let i = 0; i < files.length; i++) {
    onProgress?.({
      stage: "ocr",
      page: i + 1,
      total: files.length,
      message: `Scanning page ${i + 1} of ${files.length}...`,
    });

    const pageText = await extractTextFromImage(files[i]);
    if (pageText) {
      combinedText.push(pageText);
    }
  }

  const result = combinedText.join("\n\n").trim();
  if (!result) {
    throw new Error("No readable text could be detected across the pages.");
  }

  return result;
}

/**
 * Format raw text string into paragraph array for ReaderScreen
 */
export function formatTextToParagraphs(rawText) {
  if (!rawText) return [];
  const rawParagraphs = rawText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  if (rawParagraphs.length > 0) {
    return rawParagraphs;
  }

  // Fallback: chunk long text by sentences if no paragraph breaks
  const sentences = (rawText.match(/[^.!?]+[.!?]?/g) || []).map((s) => s.trim());
  const paragraphs = [];
  let chunk = [];

  for (const sentence of sentences) {
    chunk.push(sentence);
    if (chunk.length >= 3) {
      paragraphs.push(chunk.join(" "));
      chunk = [];
    }
  }
  if (chunk.length > 0) {
    paragraphs.push(chunk.join(" "));
  }

  return paragraphs.length > 0 ? paragraphs : [rawText.trim()];
}
