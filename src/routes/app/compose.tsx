import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader } from "@/components/ui";
import { PLATFORM_LABEL, PLATFORMS, normalizeHashtags, validateContent } from "@/lib/socialflow/domain";
import { actions, errText, useAction, useBoard, useMedia, useSaver } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/compose")({
  validateSearch: (search: Record<string, unknown>) => ({
    post: typeof search.post === "string" ? search.post : "",
  }),
  component: Composer,
});

function Composer() {
  const { post } = Route.useSearch();
  const navigate = useNavigate();
  const board = useBoard();
  const media = useMedia();
  const save = useSaver();
  const ai = useAction(actions.aiAssist);
  const remove = useAction(actions.deletePost);
  const copy = useAction(actions.duplicatePost);
  const decide = useAction(actions.decidePost);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [when, setWhen] = useState("");
  const [loaded, setLoaded] = useState("");

  const current = board.data?.posts.find((item) => item.id === post);

  useEffect(() => {
    if (!post) {
      if (loaded !== "") {
        setCaption("");
        setHashtags("");
        setPlatforms([]);
        setMediaIds([]);
        setWhen("");
        setLoaded("");
      }
      return;
    }
    if (!current || loaded === current.id) return;
    setCaption(current.caption);
    setHashtags(current.hashtags);
    setPlatforms(current.platforms);
    setMediaIds(current.mediaIds);
    setWhen(current.scheduledAt ? current.scheduledAt.slice(0, 16) : "");
    setLoaded(current.id);
  }, [post, current, loaded]);

  if (board.isPending) return <p className="text-sm text-muted">Loading composer…</p>;
  if (board.isError) return <p className="text-sm text-danger">{errText(board.error)}</p>;
  const role = board.data?.workspace.role;
  const locked = role === "viewer" || current?.status === "published";
  const previewTags = normalizeHashtags(hashtags);
  const issues = validateContent({
    caption,
    hashtags,
    platforms: platforms.filter((p): p is (typeof PLATFORMS)[number] => PLATFORMS.includes(p as never)),
    mediaCount: mediaIds.length,
    hasVideo: false,
  });

  function payload(intent: "draft" | "schedule" | "publish") {
    return {
      id: post || undefined,
      caption,
      hashtags,
      platforms,
      mediaIds,
      scheduledAt: when ? new Date(when).toISOString() : null,
      intent,
    };
  }

  function run(intent: "draft" | "schedule" | "publish") {
    save.mutate(payload(intent), {
      onSuccess: (result) => {
        const note =
          result.approval === "pending"
            ? "Sent for approval. It will not publish until an admin accepts it."
            : intent === "publish"
              ? "Publishing ran. Check history for the official result."
              : "Saved.";
        toast.success(note);
        void navigate({ to: "/app/compose", search: { post: result.id } });
      },
      onError: (error) => toast.error(errText(error)),
    });
  }

  return (
    <div>
      <PageHeader
        title={post ? "Edit post" : "New post"}
        lede="Drafts can be incomplete. Scheduling and publishing check each network’s rules."
        actions={
          <Link to="/app/calendar" className="sf-btn sf-btn-quiet">
            Back to calendar
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Field label="Caption">
            <textarea
              className="sf-input min-h-40 py-3"
              value={caption}
              disabled={locked}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Field>
          <Field label="Hashtags">
            <input className="sf-input" value={hashtags} disabled={locked} onChange={(e) => setHashtags(e.target.value)} placeholder="launch week brand" />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium">Destinations</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
                const on = platforms.includes(platform);
                const ready = board.data?.accounts.some((a) => a.platform === platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    disabled={locked || !ready}
                    className={`sf-btn ${on ? "sf-btn-navy" : "sf-btn-quiet"}`}
                    onClick={() =>
                      setPlatforms((list) => (list.includes(platform) ? list.filter((p) => p !== platform) : [...list, platform]))
                    }
                  >
                    {PLATFORM_LABEL[platform]}
                    {!ready ? " · add profile" : ""}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div>
            <p className="text-sm font-medium">Images</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(media.data ?? []).map((item) => {
                const on = mediaIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={locked}
                    className={`overflow-hidden rounded-control border ${on ? "border-accent" : "border-line"}`}
                    onClick={() =>
                      setMediaIds((list) => (list.includes(item.id) ? list.filter((id) => id !== item.id) : [...list, item.id]))
                    }
                  >
                    <img src={item.dataUrl} alt={item.name} className="aspect-square w-full object-cover" />
                  </button>
                );
              })}
            </div>
            {(media.data ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No images yet. <Link to="/app/media" className="text-accent">Upload in the library.</Link>
              </p>
            ) : null}
          </div>
          <Field label="Schedule">
            <input className="sf-input" type="datetime-local" value={when} disabled={locked} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          {issues.length && platforms.length ? (
            <ul className="list-disc pl-5 text-sm text-warn">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          {current?.approval === "pending" ? <p className="text-sm text-warn">Waiting for an owner or admin to approve.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Btn type="button" tone="quiet" disabled={locked || save.isPending} onClick={() => run("draft")}>
              Save draft
            </Btn>
            <Btn type="button" tone="navy" disabled={locked || save.isPending} onClick={() => run("schedule")}>
              Schedule
            </Btn>
            <Btn type="button" disabled={locked || save.isPending} onClick={() => run("publish")}>
              Publish now
            </Btn>
            <Btn
              type="button"
              tone="quiet"
              disabled={ai.isPending || locked}
              onClick={() =>
                ai.mutate(
                  { kind: "caption", draft: caption, platform: platforms[0] ?? "facebook" },
                  {
                    onSuccess: (result) => {
                      const text = (result as { text: string }).text;
                      setCaption(text);
                      toast.success("Caption added. It counts against this month’s AI limit.");
                    },
                    onError: (error) => toast.error(errText(error)),
                  },
                )
              }
            >
              {ai.isPending ? "Writing…" : "AI caption"}
            </Btn>
            {post ? (
              <>
                <Btn
                  type="button"
                  tone="quiet"
                  onClick={() =>
                    copy.mutate(
                      { id: post },
                      {
                        onSuccess: (result) => {
                          const id = (result as { id: string }).id;
                          toast.success("Duplicated as a draft");
                          void navigate({ to: "/app/compose", search: { post: id } });
                        },
                        onError: (error) => toast.error(errText(error)),
                      },
                    )
                  }
                >
                  Duplicate
                </Btn>
                <Btn
                  type="button"
                  tone="danger"
                  disabled={locked}
                  onClick={() =>
                    remove.mutate(
                      { id: post },
                      {
                        onSuccess: () => {
                          toast.success("Deleted");
                          void navigate({ to: "/app/compose", search: { post: "" } });
                        },
                        onError: (error) => toast.error(errText(error)),
                      },
                    )
                  }
                >
                  Delete
                </Btn>
              </>
            ) : null}
          </div>
          {current?.approval === "pending" && (role === "owner" || role === "admin") ? (
            <div className="flex gap-2">
              <Btn type="button" onClick={() => decide.mutate({ postId: post, decision: "approved" }, { onError: (e) => toast.error(errText(e)) })}>
                Approve
              </Btn>
              <Btn type="button" tone="quiet" onClick={() => decide.mutate({ postId: post, decision: "changes" }, { onError: (e) => toast.error(errText(e)) })}>
                Request changes
              </Btn>
            </div>
          ) : null}
        </div>
        <aside className="sf-card h-fit bg-navy text-accent-ink">
          <p className="text-xs tracking-wide text-accent-ink/70">Preview</p>
          <p className="mt-4 text-sm leading-6 whitespace-pre-wrap">{caption || "Your caption will show here."}</p>
          {previewTags.length ? <p className="mt-3 text-sm text-accent-ink/80">{previewTags.map((t) => `#${t}`).join(" ")}</p> : null}
          <p className="mt-6 text-xs text-accent-ink/60">
            {mediaIds.length} image{mediaIds.length === 1 ? "" : "s"} · {platforms.length || "no"} destination
            {platforms.length === 1 ? "" : "s"}
          </p>
        </aside>
      </div>
    </div>
  );
}
