import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const bootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { bootstrapFor } = await import("./logic.server");
    return bootstrapFor(context.userId);
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName: string; timezone: string }) => input)
  .handler(async ({ context, data }) => {
    const { updateProfileFor } = await import("./logic.server");
    return updateProfileFor(context.userId, data);
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; timezone: string }) => input)
  .handler(async ({ context, data }) => {
    const { createWorkspaceFor } = await import("./logic.server");
    return createWorkspaceFor(context.userId, data);
  });

export const updateWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; timezone: string }) => input)
  .handler(async ({ context, data }) => {
    const { updateWorkspaceFor } = await import("./logic.server");
    return updateWorkspaceFor(context.userId, data);
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { confirmName: string }) => input)
  .handler(async ({ context, data }) => {
    const { deleteWorkspaceFor } = await import("./logic.server");
    return deleteWorkspaceFor(context.userId, data.confirmName);
  });

export const setActiveWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const { setActiveFor } = await import("./logic.server");
    return setActiveFor(context.userId, data.workspaceId);
  });

export const loadBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadBoardFor } = await import("./logic.server");
    return loadBoardFor(context.userId);
  });

export const savePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id?: string;
      caption: string;
      hashtags: string;
      platforms: string[];
      mediaIds: string[];
      scheduledAt: string | null;
      intent: "draft" | "schedule" | "publish";
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { savePostFor } = await import("./logic.server");
    return savePostFor(context.userId, data);
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { deletePostFor } = await import("./logic.server");
    return deletePostFor(context.userId, data.id);
  });

export const duplicatePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { duplicatePostFor } = await import("./logic.server");
    return duplicatePostFor(context.userId, data.id);
  });

export const decidePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { postId: string; decision: "approved" | "changes" }) => input)
  .handler(async ({ context, data }) => {
    const { decidePostFor } = await import("./logic.server");
    return decidePostFor(context.userId, data);
  });

export const movePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { postId: string; scheduledAt: string }) => input)
  .handler(async ({ context, data }) => {
    const { movePostFor } = await import("./logic.server");
    return movePostFor(context.userId, data);
  });

export const listMedia = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listMediaFor } = await import("./logic.server");
    return listMediaFor(context.userId);
  });

export const uploadMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; mime: string; dataUrl: string }) => input)
  .handler(async ({ context, data }) => {
    const { uploadMediaFor } = await import("./logic.server");
    return uploadMediaFor(context.userId, data);
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { deleteMediaFor } = await import("./logic.server");
    return deleteMediaFor(context.userId, data.id);
  });

export const connectAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { platform: string; displayName: string }) => input)
  .handler(async ({ context, data }) => {
    const { connectAccountFor } = await import("./logic.server");
    return connectAccountFor(context.userId, data);
  });

export const disconnectAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { disconnectAccountFor } = await import("./logic.server");
    return disconnectAccountFor(context.userId, data.id);
  });

export const retryAttempt = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { retryAttemptFor } = await import("./logic.server");
    return retryAttemptFor(context.userId, data.id);
  });

export const markNotesRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ok: true }) => input)
  .handler(async ({ context }) => {
    const { markNotesReadFor } = await import("./logic.server");
    return markNotesReadFor(context.userId);
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email: string; role: string }) => input)
  .handler(async ({ context, data }) => {
    const { inviteMemberFor } = await import("./logic.server");
    return inviteMemberFor(context.userId, data);
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { membershipId: string; role: string }) => input)
  .handler(async ({ context, data }) => {
    const { updateMemberFor } = await import("./logic.server");
    return updateMemberFor(context.userId, data);
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { membershipId: string }) => input)
  .handler(async ({ context, data }) => {
    const { removeMemberFor } = await import("./logic.server");
    return removeMemberFor(context.userId, data.membershipId);
  });

export const requestPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { plan: string; currency: string; interval: string }) => input)
  .handler(async ({ context, data }) => {
    const { requestPlanFor } = await import("./logic.server");
    return requestPlanFor(context.userId, data);
  });

export const aiAssist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind: string; draft: string; platform: string }) => input)
  .handler(async ({ context, data }) => {
    const { aiAssistFor } = await import("./logic.server");
    return aiAssistFor(context.userId, data);
  });

export const loadAnalytics = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { platform: string; from: string; to: string }) => input)
  .handler(async ({ context, data }) => {
    const { analyticsFor } = await import("./logic.server");
    return analyticsFor(context.userId, data);
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { adminOverviewFor } = await import("./logic.server");
    return adminOverviewFor(context.userId);
  });
