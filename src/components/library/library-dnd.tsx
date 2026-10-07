"use client";

import { createElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { moveItem } from "@/app/app/library/actions";
import { uploadToLibrary } from "@/lib/library-upload";
import { createClient } from "@/lib/supabase/client";

// Drag and drop in the resource library: files and folders onto folders (move), and files from the
// computer onto a folder or the open folder (upload). Every move also has a "move to…" form.

const TYPE = "application/x-reform-library";
type Payload = { kind: "file" | "folder"; id: string; name: string };

/** Announces what a drop did (polite live region shared by every drop target). */
function announce(message: string, tone: "ok" | "error" = "ok") {
  window.dispatchEvent(new CustomEvent("library:status", { detail: { message, tone } }));
}

export function DropStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<{ message: string; tone: "ok" | "error" } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (event: Event) => {
      setStatus((event as CustomEvent).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setStatus(null), 6000);
    };
    window.addEventListener("library:status", on);
    return () => {
      window.removeEventListener("library:status", on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <p role="status" aria-live="polite" className={`${className ?? ""} ${status ? "" : "sr-only"} ${status?.tone === "error" ? "text-vermilion" : ""}`}>
      {status?.message}
    </p>
  );
}

function useDragSource(kind: "file" | "folder", id: string, name: string, enabled: boolean) {
  const [dragging, setDragging] = useState(false);
  if (!enabled) return { props: {}, dragging: false };
  return {
    dragging,
    props: {
      draggable: true,
      "data-drag": `${kind}:${id}`,
      onDragStart: (event: React.DragEvent) => {
        event.stopPropagation();
        event.dataTransfer.setData(TYPE, JSON.stringify({ kind, id, name } satisfies Payload));
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      },
      onDragEnd: () => setDragging(false),
    },
  };
}

function useDropTarget(folderId: string, folderName: string, canUpload: boolean, profileId: string) {
  const t = useTranslations("library");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [over, setOver] = useState(0);
  const accepts = (event: React.DragEvent) => event.dataTransfer.types.includes(TYPE) || (canUpload && event.dataTransfer.types.includes("Files"));

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setOver(0);
    const raw = event.dataTransfer.getData(TYPE);
    if (raw) {
      const item = JSON.parse(raw) as Payload;
      if ((item.kind === "folder" && item.id === folderId) || (item.kind === "file" && folderId === "root")) return;
      const result = await moveItem({ kind: item.kind, id: item.id, to: folderId });
      if (result.error) announce(t(result.error.replace(/^library\./, "") as never), "error");
      else announce(t("movedInto", { name: item.name, folder: folderName }));
      router.refresh();
      return;
    }
    const files = Array.from(event.dataTransfer.files);
    if (!files.length || !canUpload) return;
    const { saved, problems } = await uploadToLibrary(supabase, folderId, files, profileId, t, (current, total) => announce(t("uploadingCount", { current, total })));
    announce([saved ? t("uploaded", { count: saved }) : "", ...problems].filter(Boolean).join(" "), problems.length ? "error" : "ok");
    router.refresh();
  }

  return {
    over: over > 0,
    props: {
      "data-drop": folderId,
      onDragEnter: (event: React.DragEvent) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setOver((n) => n + 1);
      },
      onDragOver: (event: React.DragEvent) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes(TYPE) ? "move" : "copy";
      },
      onDragLeave: (event: React.DragEvent) => {
        event.stopPropagation();
        setOver((n) => Math.max(0, n - 1));
      },
      onDrop: (event: React.DragEvent) => void onDrop(event),
    },
  };
}

const highlight = "outline outline-2 -outline-offset-2 outline-teal bg-teal/15";

/** A file that can be picked up and dropped on a folder. */
export function Draggable({
  kind,
  id,
  name,
  as = "div",
  className,
  children,
}: {
  kind: "file" | "folder";
  id: string;
  name: string;
  as?: "div" | "li" | "tr";
  className?: string;
  children: ReactNode;
}) {
  const drag = useDragSource(kind, id, name, true);
  return createElement(as, { ...drag.props, className: `${className ?? ""} ${drag.dragging ? "opacity-50" : ""}` }, children);
}

/** The open folder (or any area standing for a folder) taking drops. */
export function DropTarget({
  folderId,
  folderName,
  canUpload,
  profileId,
  as = "div",
  className,
  children,
}: {
  folderId: string;
  folderName: string;
  canUpload: boolean;
  profileId: string;
  as?: "div" | "li" | "tr" | "section";
  className?: string;
  children: ReactNode;
}) {
  const drop = useDropTarget(folderId, folderName, canUpload, profileId);
  return createElement(as, { ...drop.props, className: `${className ?? ""} ${drop.over ? highlight : ""}` }, children);
}

/** A folder in a list or the sidebar: things drop onto it, and (if allowed) it can be dragged itself. */
export function FolderItem({
  id,
  name,
  canDrag,
  canDrop,
  canUpload,
  profileId,
  as = "div",
  className,
  children,
}: {
  id: string;
  name: string;
  canDrag: boolean;
  canDrop: boolean;
  canUpload: boolean;
  profileId: string;
  as?: "div" | "li" | "tr";
  className?: string;
  children: ReactNode;
}) {
  const drag = useDragSource("folder", id, name, canDrag);
  const drop = useDropTarget(id, name, canUpload, profileId);
  return createElement(
    as,
    { ...drag.props, ...(canDrop ? drop.props : {}), className: `${className ?? ""} ${drag.dragging ? "opacity-50" : ""} ${canDrop && drop.over ? highlight : ""}` },
    children,
  );
}
