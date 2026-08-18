"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  completeAssistantSourceUploadAction,
  prepareAssistantSourceUploadAction,
  uploadAssistantSourceAction,
} from "@/app/actions/guidebook-creation-assistant";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const SERVER_ACTION_BYTES = 4 * 1024 * 1024;
const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
const mediaTypeFor = (file: File) =>
  /\.(md|markdown)$/i.test(file.name)
    ? "text/plain"
    : file.type || "application/octet-stream";

export function SourceUpload({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload() {
    if (!file || busy) return;
    if (file.size > MAX_SOURCE_BYTES) {
      setStatus(
        `This file is ${megabytes(file.size)} MB. The maximum source size is 25 MB.`,
      );
      return;
    }
    setBusy(true);
    setStatus("Uploading source…");
    try {
      const mediaType = mediaTypeFor(file);
      if (file.size <= SERVER_ACTION_BYTES) {
        const form = new FormData();
        form.set("jobId", jobId);
        form.set("file", file);
        await uploadAssistantSourceAction(form);
        setStatus("Source uploaded.");
        setFile(null);
        router.refresh();
        return;
      }
      setStatus("Preparing secure upload…");
      const signed = await prepareAssistantSourceUploadAction({
        jobId,
        filename: file.name,
        mediaType,
        byteSize: file.size,
      });
      setStatus("Uploading source…");
      const { error } = await createClient().storage
        .from("guidebook-creation-sources")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: mediaType,
        });
      if (error) throw new Error("Secure upload failed.");
      setStatus("Validating source…");
      await completeAssistantSourceUploadAction({
        jobId,
        path: signed.path,
        filename: file.name,
        mediaType,
      });
      setStatus("Source uploaded.");
      setFile(null);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        accept=".pdf,.docx,.txt,.md,.markdown,image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setFile(selected);
          setStatus(
            selected && selected.size > MAX_SOURCE_BYTES
              ? `This file is ${megabytes(selected.size)} MB. The maximum source size is 25 MB.`
              : "",
          );
        }}
      />
      <button
        type="button"
        disabled={!file || file.size > MAX_SOURCE_BYTES || busy}
        onClick={upload}
        className="rounded-lg border px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload source"}
      </button>
      {status ? <span className="text-sm text-stone-600">{status}</span> : null}
    </div>
  );
}
