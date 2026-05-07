import type { ChatMessageData } from "@/components/chat/ChatMessage";

function messageText(m: ChatMessageData): string {
  if (m.content && m.content.trim()) return m.content;
  if (m.sections && m.sections.length > 0) {
    return m.sections.map((s) => s.content).join("\n\n");
  }
  return "";
}

export function conversationToMarkdown(
  title: string,
  messages: ChatMessageData[],
): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`_Exported ${new Date().toLocaleString()}_`);
  lines.push("");
  for (const m of messages) {
    const role = m.role === "user" ? "You" : "Companion";
    const ts = m.timestamp ? ` · ${new Date(m.timestamp).toLocaleString()}` : "";
    lines.push(`## ${role}${ts}`);
    lines.push("");
    lines.push(messageText(m));
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

export function conversationToPlainText(
  title: string,
  messages: ChatMessageData[],
): string {
  const lines: string[] = [`${title}`, ""];
  for (const m of messages) {
    const role = m.role === "user" ? "You" : "Companion";
    lines.push(`[${role}]`);
    lines.push(messageText(m).replace(/\*\*/g, "").replace(/^#+\s*/gm, ""));
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 60) || "conversation";
}