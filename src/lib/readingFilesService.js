import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  extractTextFromFile,
  extractTextFromImage,
  extractTextFromImages,
  formatTextToParagraphs,
} from "@/lib/textExtractor";

export const BUCKET_NAME = "reader-files";
const LOCAL_STORAGE_HISTORY_KEY = "neurobridge_reading_files_local_v1";

function sanitizeFilename(fileName) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getLocalHistory() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(list) {
  try {
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Upload single or multi-page file(s) to Supabase Storage, insert DB record, and execute OCR.
 */
export async function uploadAndProcessReadingFile({
  user,
  file,
  files = [],
  source = "upload",
  onProgress,
}) {
  const isMultiPage = Array.isArray(files) && files.length > 0;
  const inputFiles = isMultiPage ? files : file ? [file] : [];

  if (inputFiles.length === 0) {
    throw new Error("No file provided for upload.");
  }

  const primaryFile = inputFiles[0];
  const fileId = generateUUID();
  const userId = user?.id || "guest-user";
  const fileName = isMultiPage
    ? `Scan ${inputFiles.length} Pages - ${new Date().toLocaleDateString()}`
    : primaryFile.name || "Untitled Document";
  const fileType = primaryFile.type || "application/octet-stream";
  const totalFileSize = inputFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  const pageCount = isMultiPage ? inputFiles.length : 1;

  let storagePath = null;
  let previewUrl = null;

  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;

  // 1. Storage Upload
  if (isSupabaseUser) {
    try {
      onProgress?.({ stage: "uploading", message: "Uploading file to Supabase Storage..." });
      const cleanName = sanitizeFilename(primaryFile.name || "scanned_doc.png");
      storagePath = `${userId}/${fileId}/${cleanName}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, primaryFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadErr) {
        console.warn("Supabase storage upload failed, continuing with local processing:", uploadErr.message);
        storagePath = null;
      } else {
        const { data: pubUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
        previewUrl = pubUrlData?.publicUrl || null;
      }
    } catch (err) {
      console.warn("Storage upload exception:", err);
    }
  }

  // Generate blob preview URL for local images if thumbnail needed
  if (!previewUrl && fileType.startsWith("image/")) {
    try {
      previewUrl = URL.createObjectURL(primaryFile);
    } catch {}
  }

  // Initial Record Metadata
  const initialRecord = {
    id: fileId,
    user_id: userId,
    file_name: fileName,
    file_type: fileType,
    file_size: totalFileSize,
    storage_path: storagePath,
    preview_url: previewUrl,
    source,
    page_count: pageCount,
    ocr_status: "processing",
    ocr_text: null,
    metadata: {
      progress: 0,
      currentWordIndex: 0,
      readingSettings: {},
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 2. Database Insert (initial processing state)
  if (isSupabaseUser) {
    try {
      const { error: insertErr } = await supabase
        .from("reading_files")
        .insert([{
          id: initialRecord.id,
          user_id: initialRecord.user_id,
          file_name: initialRecord.file_name,
          file_type: initialRecord.file_type,
          file_size: initialRecord.file_size,
          storage_path: initialRecord.storage_path,
          source: initialRecord.source,
          page_count: initialRecord.page_count,
          ocr_status: "processing",
          metadata: initialRecord.metadata,
        }]);

      if (insertErr) {
        console.warn("DB insert error, saving locally:", insertErr.message);
      }
    } catch (err) {
      console.warn("DB insert exception:", err);
    }
  }

  // Save to local cache as well
  const localHistory = getLocalHistory().filter((r) => r.id !== fileId);
  saveLocalHistory([initialRecord, ...localHistory]);

  // 3. OCR Text Extraction
  let extractedText = "";
  try {
    if (isMultiPage) {
      extractedText = await extractTextFromImages(inputFiles, onProgress);
    } else if (fileType.startsWith("image/")) {
      onProgress?.({ stage: "ocr", message: "Extracting text using Gemini Vision OCR..." });
      extractedText = await extractTextFromImage(primaryFile);
    } else {
      extractedText = await extractTextFromFile(primaryFile, onProgress);
    }
  } catch (ocrErr) {
    console.error("OCR Extraction failed:", ocrErr);

    // Update DB & local with failure
    const failedRecord = { ...initialRecord, ocr_status: "failed", updated_at: new Date().toISOString() };
    if (isSupabaseUser) {
      try {
        await supabase
          .from("reading_files")
          .update({ ocr_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", fileId);
      } catch (err) {
        console.warn("Failed to update status to failed:", err);
      }
    }
    const updatedLocal = getLocalHistory().map((r) => (r.id === fileId ? failedRecord : r));
    saveLocalHistory(updatedLocal);

    throw ocrErr;
  }

  // 4. Update Record with Completed OCR Text
  const completedRecord = {
    ...initialRecord,
    ocr_status: "completed",
    ocr_text: extractedText,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseUser) {
    try {
      const { error: updateErr } = await supabase
        .from("reading_files")
        .update({
          ocr_status: "completed",
          ocr_text: extractedText,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fileId);

      if (updateErr) {
        console.warn("DB update ocr_text error:", updateErr.message);
      }
    } catch (err) {
      console.warn("DB update exception:", err);
    }
  }

  const finalLocal = getLocalHistory().filter((r) => r.id !== fileId);
  saveLocalHistory([completedRecord, ...finalLocal]);

  return completedRecord;
}

/**
 * Fetch persistent reading history for the current user from Supabase & local storage
 */
export async function fetchUserReadingHistory(user) {
  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;

  let dbRecords = [];
  if (isSupabaseUser) {
    try {
      const { data, error } = await supabase
        .from("reading_files")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        dbRecords = data.map((item) => {
          let previewUrl = item.preview_url;
          if (!previewUrl && item.storage_path) {
            const { data: pubUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(item.storage_path);
            previewUrl = pubUrlData?.publicUrl || null;
          }
          return {
            ...item,
            preview_url: previewUrl,
          };
        });
      }
    } catch (err) {
      console.warn("Error fetching reading files from Supabase:", err);
    }
  }

  const localRecords = getLocalHistory();

  // Merge DB records and local records by id (DB records take priority)
  const map = new Map();
  dbRecords.forEach((r) => map.set(r.id, r));
  localRecords.forEach((r) => {
    if (!map.has(r.id)) {
      map.set(r.id, r);
    }
  });

  const combined = Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  return combined;
}

/**
 * Fetch a single reading file record by ID
 */
export async function getReadingFileById(fileId, user) {
  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;

  if (isSupabaseUser) {
    try {
      const { data, error } = await supabase
        .from("reading_files")
        .select("*")
        .eq("id", fileId)
        .single();

      if (!error && data) {
        let previewUrl = data.preview_url;
        if (!previewUrl && data.storage_path) {
          const { data: pubUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.storage_path);
          previewUrl = pubUrlData?.publicUrl;
        }
        return { ...data, preview_url: previewUrl };
      }
    } catch (err) {
      console.warn("Error fetching document by ID from Supabase:", err);
    }
  }

  const local = getLocalHistory().find((r) => r.id === fileId);
  return local || null;
}

/**
 * Delete a reading file record from Database and Supabase Storage
 */
export async function deleteReadingFile(fileId, storagePath, user) {
  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;

  // 1. Delete Storage file if path exists
  if (isSupabaseUser && storagePath) {
    try {
      const { error: storageErr } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      if (storageErr) {
        console.warn("Storage deletion warning:", storageErr.message);
      }
    } catch (err) {
      console.warn("Storage deletion exception:", err);
    }
  }

  // 2. Delete Database record
  if (isSupabaseUser) {
    try {
      const { error: dbErr } = await supabase
        .from("reading_files")
        .delete()
        .eq("id", fileId);

      if (dbErr) {
        console.warn("Database record deletion warning:", dbErr.message);
      }
    } catch (err) {
      console.warn("Database deletion exception:", err);
    }
  }

  // 3. Remove from local history
  const updatedLocal = getLocalHistory().filter((r) => r.id !== fileId);
  saveLocalHistory(updatedLocal);

  return true;
}

/**
 * Save user reading progress/settings for a specific document
 */
export async function updateReadingFileProgress(fileId, progress, currentWordIndex, user, metadataPatch = {}) {
  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;

  const currentLocal = getLocalHistory();
  const existing = currentLocal.find((r) => r.id === fileId);
  const updatedMetadata = {
    ...(existing?.metadata || {}),
    progress,
    currentWordIndex,
    ...metadataPatch,
  };

  if (existing) {
    existing.metadata = updatedMetadata;
    existing.updated_at = new Date().toISOString();
    saveLocalHistory(currentLocal);
  }

  if (isSupabaseUser) {
    try {
      await supabase
        .from("reading_files")
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fileId);
    } catch (err) {
      console.warn("Supabase progress update exception:", err);
    }
  }
}
