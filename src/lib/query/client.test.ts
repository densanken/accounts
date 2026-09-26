import { MutationObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdpApiError } from "../idp/client";
import { createQueryClient } from "./client";

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assign = vi.fn();
  vi.stubGlobal("location", {
    pathname: "/connections",
    search: "?tab=github",
    assign,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createQueryClient", () => {
  it.each([
    ["validation", 400],
    ["unauthorized", 401],
    ["forbidden", 403],
  ] as const)("does not retry on a %s (%d) error", async (code, status) => {
    const queryFn = vi.fn().mockRejectedValue(new IdpApiError(code, status));
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery({ queryKey: ["t"], queryFn, retryDelay: 0 })
    ).rejects.toBeInstanceOf(IdpApiError);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["network", new IdpApiError("network")],
    ["server", new IdpApiError("server", 500)],
  ] as const)("retries at most once on a %s error", async (_, error) => {
    const queryFn = vi.fn().mockRejectedValue(error);
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery({ queryKey: ["t"], queryFn, retryDelay: 0 })
    ).rejects.toBeInstanceOf(IdpApiError);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("redirects to login on a 401", async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValue(new IdpApiError("unauthorized", 401));
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery({ queryKey: ["t"], queryFn, retryDelay: 0 })
    ).rejects.toBeInstanceOf(IdpApiError);
    expect(assign).toHaveBeenCalledWith(
      "/auth/login?return_to=%2Fconnections%3Ftab%3Dgithub"
    );
  });

  it("redirects to login on a 401 from a mutation", async () => {
    const mutationFn = vi
      .fn()
      .mockRejectedValue(new IdpApiError("unauthorized", 401));
    const queryClient = createQueryClient();

    await expect(
      new MutationObserver(queryClient, { mutationFn }).mutate(undefined)
    ).rejects.toBeInstanceOf(IdpApiError);
    expect(assign).toHaveBeenCalledWith(
      "/auth/login?return_to=%2Fconnections%3Ftab%3Dgithub"
    );
  });

  it("doesn't redirect to login for non-401 errors", async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValue(new IdpApiError("forbidden", 403));
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery({ queryKey: ["t"], queryFn, retryDelay: 0 })
    ).rejects.toBeInstanceOf(IdpApiError);
    expect(assign).not.toHaveBeenCalled();
  });
});
