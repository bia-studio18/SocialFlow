import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Btn, ConfirmDialog, Empty, PageHeader } from "@/components/ui";
import { actions, errText, useAction, useBoard, useMedia } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/media")({ component: MediaPage });

function MediaPage() {
  const media = useMedia();
  const board = useBoard();
  const upload = useAction(actions.uploadMedia);
  const remove = useAction(actions.deleteMedia);
  const [pending, setPending] = useState<string | null>(null);
  const viewer = board.data?.workspace.role === "viewer";

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Video and other files need object storage, which is not connected.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      upload.mutate(
        { name: file.name, mime: file.type, dataUrl },
        {
          onSuccess: () => toast.success("Image stored in this workspace"),
          onError: (error) => toast.error(errText(error)),
        },
      );
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <PageHeader
        title="Media library"
        lede="JPEG, PNG, WebP, or GIF under about 300 KB. Videos stay unavailable until object storage is connected."
        actions={
          <label className={`sf-btn sf-btn-primary ${viewer ? "pointer-events-none opacity-50" : ""}`}>
            Upload image
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={viewer || upload.isPending}
              onChange={(event) => {
                onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        }
      />
      {media.isPending ? <p className="text-sm text-muted">Loading images…</p> : null}
      {media.isError ? <p className="text-sm text-danger">{errText(media.error)}</p> : null}
      {media.data && media.data.length === 0 ? (
        <Empty title="No images yet" body="Upload a photo to attach it in the composer. Nothing is sent to a social network from this library alone." />
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(media.data ?? []).map((item) => (
          <figure key={item.id} className="overflow-hidden rounded-card border border-line bg-card">
            <img src={item.dataUrl} alt={item.name} className="aspect-square w-full object-cover" />
            <figcaption className="flex items-center justify-between gap-2 p-3 text-xs">
              <span className="truncate">{item.name}</span>
              {viewer ? null : (
                <button type="button" className="text-danger" onClick={() => setPending(item.id)}>
                  Remove
                </button>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Remove this image?"
        body="Posts that used it will lose the attachment."
        confirmLabel="Remove"
        danger
        busy={remove.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          remove.mutate(
            { id: pending },
            {
              onSuccess: () => {
                toast.success("Removed");
                setPending(null);
              },
              onError: (error) => toast.error(errText(error)),
            },
          );
        }}
      />
    </div>
  );
}
