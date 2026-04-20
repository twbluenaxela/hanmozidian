import { render, screen, act } from "@testing-library/react";
import { useAuth, AuthProvider } from "@/lib/auth-context";

// Mock firebase/auth so tests don't need real credentials
jest.mock("@/lib/firebase", () => ({
  auth: {},
}));

let mockOnAuthStateChangedCallback: ((user: unknown) => void) | null = null;

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    mockOnAuthStateChangedCallback = cb;
    return () => { mockOnAuthStateChangedCallback = null; };
  },
  signOut: jest.fn(),
}));

function TestConsumer() {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? "loading" : "ready"}</span>
      <span data-testid="user">{user ? (user as { email: string }).email : "none"}</span>
    </div>
  );
}

describe("AuthProvider + useAuth", () => {
  it("starts in loading state then resolves to no user", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Before Firebase responds, loading should be true
    expect(screen.getByTestId("loading").textContent).toBe("loading");

    // Firebase calls the callback with null (signed out)
    await act(async () => {
      mockOnAuthStateChangedCallback?.(null);
    });

    expect(screen.getByTestId("loading").textContent).toBe("ready");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("exposes the signed-in user after auth state change", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      mockOnAuthStateChangedCallback?.({ email: "test@example.com" });
    });

    expect(screen.getByTestId("loading").textContent).toBe("ready");
    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
  });

  it("unsubscribes from onAuthStateChanged on unmount", async () => {
    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    unmount();
    expect(mockOnAuthStateChangedCallback).toBeNull();
  });
});
