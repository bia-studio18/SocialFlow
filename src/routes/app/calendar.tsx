import { Link, createFileRoute } from "@tanstack/react-router";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, PageHeader } from "@/components/ui";
import { PLATFORM_LABEL, isPlatform } from "@/lib/socialflow/domain";
import { actions, errText, useAction, useBoard } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/calendar")({ component: CalendarPage });

type View = "month" | "week" | "day";

function CalendarPage() {
  const board = useBoard();
  const move = useAction(actions.movePost);
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<View>("month");
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");

  const posts = useMemo(() => {
    return (board.data?.posts ?? []).filter((post) => {
      if (status !== "all" && post.status !== status) return false;
      if (platform !== "all" && !post.platforms.includes(platform as never)) return false;
      return true;
    });
  }, [board.data, status, platform]);

  const days = useMemo(() => {
    if (view === "day") return [cursor];
    if (view === "week") {
      return eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor)),
      end: endOfWeek(endOfMonth(cursor)),
    });
  }, [cursor, view]);

  if (board.isPending) return <p className="text-sm text-muted">Loading calendar…</p>;
  if (board.isError) return <p className="text-sm text-danger">{errText(board.error)}</p>;
  const canEdit = board.data?.workspace.role !== "viewer";

  function onDrop(day: Date, event: React.DragEvent) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/post-id");
    if (!id || !canEdit) return;
    const at = new Date(day);
    at.setHours(9, 0, 0, 0);
    move.mutate(
      { postId: id, scheduledAt: at.toISOString() },
      {
        onSuccess: () => toast.success("Moved on the calendar"),
        onError: (error) => toast.error(errText(error)),
      },
    );
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        lede={`Times follow this browser. Workspace timezone is ${board.data?.workspace.timezone}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn tone="quiet" type="button" onClick={() => setCursor(view === "month" ? addMonths(cursor, -1) : addDays(cursor, view === "week" ? -7 : -1))}>
              Back
            </Btn>
            <Btn tone="quiet" type="button" onClick={() => setCursor(new Date())}>
              Today
            </Btn>
            <Btn tone="quiet" type="button" onClick={() => setCursor(view === "month" ? addMonths(cursor, 1) : addDays(cursor, view === "week" ? 7 : 1))}>
              Next
            </Btn>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["month", "week", "day"] as View[]).map((item) => (
          <button key={item} type="button" className={`sf-btn ${view === item ? "sf-btn-navy" : "sf-btn-quiet"}`} onClick={() => setView(item)}>
            {item}
          </button>
        ))}
        <select className="sf-input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="blocked">Blocked</option>
          <option value="failed">Failed</option>
          <option value="published">Published</option>
        </select>
        <select className="sf-input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
          <option value="tiktok">TikTok</option>
        </select>
      </div>
      <p className="mb-3 font-display text-2xl">{format(cursor, view === "day" ? "EEEE d MMMM" : "MMMM yyyy")}</p>
      {view === "month" ? (
        <div className="mb-2 grid grid-cols-7 text-xs text-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-1 py-1">
              {d}
            </div>
          ))}
        </div>
      ) : null}
      <div className={`grid gap-2 ${view === "day" ? "grid-cols-1" : view === "week" ? "grid-cols-2 md:grid-cols-7" : "grid-cols-2 md:grid-cols-7"}`}>
        {days.map((day) => {
          const items = posts.filter((post) => post.scheduledAt && isSameDay(new Date(post.scheduledAt), day));
          const faded = view === "month" && !isSameMonth(day, cursor);
          return (
            <div
              key={day.toISOString()}
              className={`min-h-28 rounded-card border border-line bg-card p-2 ${faded ? "opacity-50" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(day, event)}
            >
              <p className="text-xs font-semibold tabular-nums">{format(day, "d")}</p>
              <div className="mt-1 space-y-1">
                {items.map((post) => (
                  <Link
                    key={post.id}
                    to="/app/compose"
                    search={{ post: post.id }}
                    draggable={canEdit}
                    onDragStart={(event) => event.dataTransfer.setData("text/post-id", post.id)}
                    className="block rounded-control bg-paper px-2 py-1 text-xs"
                  >
                    <span className="line-clamp-2">{post.caption || "Untitled"}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge value={post.status} />
                      {post.platforms.filter(isPlatform).slice(0, 2).map((p) => (
                        <span key={p} className="text-muted">
                          {PLATFORM_LABEL[p].split(" ")[0]}
                        </span>
                      ))}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
