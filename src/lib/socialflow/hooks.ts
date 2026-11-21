import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminOverview,
  aiAssist,
  bootstrap,
  connectAccount,
  createWorkspace,
  decidePost,
  deleteMedia,
  deletePost,
  deleteWorkspace,
  disconnectAccount,
  duplicatePost,
  inviteMember,
  listMedia,
  loadAnalytics,
  loadBoard,
  markNotesRead,
  movePost,
  removeMember,
  requestPlan,
  retryAttempt,
  savePost,
  setActiveWorkspace,
  updateMember,
  updateProfile,
  updateWorkspace,
  uploadMedia,
} from "@/lib/socialflow/api";

export function errText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong. Try again.";
}

export function useBoot() {
  return useQuery({ queryKey: ["sf", "boot"], queryFn: () => bootstrap() });
}

export function useBoard() {
  return useQuery({ queryKey: ["sf", "board"], queryFn: () => loadBoard() });
}

export function useMedia() {
  return useQuery({ queryKey: ["sf", "media"], queryFn: () => listMedia() });
}

function useRefresh() {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: ["sf"] });
  };
}

export function useSaver() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (data: Parameters<typeof savePost>[0]["data"]) => savePost({ data }),
    onSuccess: refresh,
  });
}

export function useAction<T>(fn: (input: { data: T }) => Promise<unknown>) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (data: T) => fn({ data }),
    onSuccess: refresh,
  });
}

export const actions = {
  updateProfile,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  setActiveWorkspace,
  deletePost,
  duplicatePost,
  decidePost,
  movePost,
  uploadMedia,
  deleteMedia,
  connectAccount,
  disconnectAccount,
  retryAttempt,
  markNotesRead,
  inviteMember,
  updateMember,
  removeMember,
  requestPlan,
  aiAssist,
  loadAnalytics,
  adminOverview,
};
