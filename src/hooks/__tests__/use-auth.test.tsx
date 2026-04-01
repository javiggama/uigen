import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";

// --- Mocks ---

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

// --- Helpers ---

function renderUseAuth() {
  return renderHook(() => useAuth());
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────

describe("initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderUseAuth();
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderUseAuth();
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// signIn — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe("signIn", () => {
  test("sets isLoading to true during sign-in, then false after", async () => {
    let resolveSignIn!: (v: unknown) => void;
    (signInAction as any).mockReturnValue(
      new Promise((res) => (resolveSignIn = res))
    );
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "new-1" });

    const { result } = renderUseAuth();

    act(() => {
      result.current.signIn("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: true });
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from the signIn action", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getProjects as any).mockResolvedValue([{ id: "p1" }]);

    const { result } = renderUseAuth();
    let returnValue: unknown;

    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "pass");
    });

    expect(returnValue).toEqual({ success: true });
  });

  test("returns failure result without navigating when credentials are wrong", async () => {
    (signInAction as any).mockResolvedValue({
      success: false,
      error: "Invalid credentials",
    });
    (getAnonWorkData as any).mockReturnValue(null);

    const { result } = renderUseAuth();
    let returnValue: unknown;

    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrong");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  // post-sign-in routing: anon work present
  test("migrates anon work into a new project and redirects", async () => {
    const anonWork = {
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/App.tsx": "code" },
    };
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(anonWork);
    (createProject as any).mockResolvedValue({ id: "migrated-project" });

    const { result } = renderUseAuth();
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
    expect(clearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/migrated-project");
    expect(getProjects).not.toHaveBeenCalled();
  });

  // post-sign-in routing: no anon work, existing projects
  test("redirects to most recent project when no anon work", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([
      { id: "recent" },
      { id: "older" },
    ]);

    const { result } = renderUseAuth();
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent");
    expect(createProject).not.toHaveBeenCalled();
  });

  // post-sign-in routing: no anon work, no projects
  test("creates a new project and redirects when user has no projects", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "brand-new" });

    const { result } = renderUseAuth();
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// signUp — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe("signUp", () => {
  test("sets isLoading to true during sign-up, then false after", async () => {
    let resolveSignUp!: (v: unknown) => void;
    (signUpAction as any).mockReturnValue(
      new Promise((res) => (resolveSignUp = res))
    );
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "new-1" });

    const { result } = renderUseAuth();

    act(() => {
      result.current.signUp("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: true });
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from the signUp action", async () => {
    (signUpAction as any).mockResolvedValue({ success: true });
    (getProjects as any).mockResolvedValue([{ id: "p1" }]);

    const { result } = renderUseAuth();
    let returnValue: unknown;

    await act(async () => {
      returnValue = await result.current.signUp("new@b.com", "password123");
    });

    expect(returnValue).toEqual({ success: true });
  });

  test("returns failure result without navigating", async () => {
    (signUpAction as any).mockResolvedValue({
      success: false,
      error: "Email already registered",
    });

    const { result } = renderUseAuth();
    let returnValue: unknown;

    await act(async () => {
      returnValue = await result.current.signUp("existing@b.com", "pass");
    });

    expect(returnValue).toEqual({
      success: false,
      error: "Email already registered",
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("runs the same post-sign-in flow after successful sign-up", async () => {
    (signUpAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([{ id: "existing-p" }]);

    const { result } = renderUseAuth();
    await act(async () => {
      await result.current.signUp("new@b.com", "password123");
    });

    expect(mockPush).toHaveBeenCalledWith("/existing-p");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  test("anon work with empty messages array does NOT trigger migration", async () => {
    // getAnonWorkData returns an object but messages is empty — branch is skipped
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue({
      messages: [],
      fileSystemData: {},
    });
    (getProjects as any).mockResolvedValue([{ id: "p1" }]);

    const { result } = renderUseAuth();
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(createProject).not.toHaveBeenCalled();
    expect(clearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/p1");
  });

  test("new project name includes a random number suffix", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "x" });

    const { result } = renderUseAuth();
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    const callArg = (createProject as any).mock.calls[0][0];
    expect(callArg.name).toMatch(/^New Design #\d+$/);
  });

  test("anon project name includes a time string", async () => {
    const anonWork = {
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    };
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(anonWork);
    (createProject as any).mockResolvedValue({ id: "a" });

    const { result } = renderUseAuth();
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    const callArg = (createProject as any).mock.calls[0][0];
    expect(callArg.name).toMatch(/^Design from /);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("error handling", () => {
  test("resets isLoading if signIn action throws", async () => {
    (signInAction as any).mockRejectedValue(new Error("Network error"));

    const { result } = renderUseAuth();

    await act(async () => {
      await result.current.signIn("a@b.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading if signUp action throws", async () => {
    (signUpAction as any).mockRejectedValue(new Error("Server error"));

    const { result } = renderUseAuth();

    await act(async () => {
      await result.current.signUp("a@b.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading if createProject throws during post-sign-in", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockRejectedValue(new Error("DB error"));

    const { result } = renderUseAuth();

    await act(async () => {
      await result.current.signIn("a@b.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading if getProjects throws", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockRejectedValue(new Error("Unauthorized"));

    const { result } = renderUseAuth();

    await act(async () => {
      await result.current.signIn("a@b.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});
