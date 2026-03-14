"use client";

import { useState, useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  agentName: string;
  onSend: (message: string) => void;
  onClear: () => void;
  isStreaming: boolean;
  hasMessages: boolean;
}

export function ChatInput({
  agentName,
  onSend,
  onClear,
  isStreaming,
  hasMessages,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || isStreaming || uploading) return;

    let message = trimmed;

    // Upload files first
    if (files.length > 0) {
      setUploading(true);
      try {
        const formData = new FormData();
        for (const file of files) {
          formData.append("files", file);
        }
        const res = await fetch(`/api/upload/${agentName}`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { uploaded } = await res.json();
        const fileList = uploaded.map((f: string) => f).join(", ");
        const prefix = `[Uploaded files to workspace/uploads/: ${fileList}]`;
        message = message ? `${prefix}\n${message}` : prefix;
      } catch {
        message = message || "Upload failed";
      } finally {
        setUploading(false);
      }
    }

    setValue("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onSend(message);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (selected) {
      setFiles(Array.from(selected));
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="border-t border-border p-4">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs font-mono bg-amber/10 border border-amber/20 rounded px-2 py-0.5 text-amber/80"
            >
              {file.name}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {hasMessages && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isStreaming}
            className="text-muted-foreground"
          >
            Clear
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || uploading}
          className="text-muted-foreground px-2"
          title="Attach files"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 8.5l-5.5 5.5a3.5 3.5 0 01-5-5l6.5-6.5a2 2 0 013 3L6.5 12a.5.5 0 01-.7-.7L11.5 5.5" />
          </svg>
        </Button>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={uploading ? "Uploading..." : "Send a message..."}
          disabled={isStreaming || uploading}
          className="flex-1"
          autoFocus
        />
        <Button
          type="submit"
          disabled={(!value.trim() && files.length === 0) || isStreaming || uploading}
          size="sm"
        >
          {uploading ? "..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
