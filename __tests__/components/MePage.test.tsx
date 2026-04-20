import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MePage from "@/app/me/page";

const mockSignInWithPopup = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/lib/firebase", () => ({ auth: {}, db: {} }));
jest.mock("firebase/auth", () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  GoogleAuthProvider: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({}));

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("MePage — loading + profile", () => {
  it("shows a loading indicator while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<MePage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows user profile when signed in", () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: "王羲之", email: "wang@example.com", photoURL: null },
      loading: false,
    });
    render(<MePage />);
    expect(screen.getByText("王羲之")).toBeInTheDocument();
    expect(screen.getByText("wang@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /登出|sign.?out/i })).toBeInTheDocument();
  });

  it("calls signOut when sign-out button is clicked", async () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: "王羲之", email: "wang@example.com", photoURL: null },
      loading: false,
    });
    render(<MePage />);
    await userEvent.click(screen.getByRole("button", { name: /登出|sign.?out/i }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe("MePage — sign-in UI", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
  });

  it("shows Google sign-in button", () => {
    render(<MePage />);
    expect(screen.getByRole("button", { name: /Google/i })).toBeInTheDocument();
  });

  it("shows email and password inputs", () => {
    render(<MePage />);
    expect(screen.getByPlaceholderText(/電子郵件|email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/密碼|password/i)).toBeInTheDocument();
  });

  it("shows 登入 and 註冊 buttons", () => {
    render(<MePage />);
    expect(screen.getByRole("button", { name: "登入" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "註冊" })).toBeInTheDocument();
  });

  it("calls signInWithEmailAndPassword when 登入 is clicked", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({});
    render(<MePage />);
    await userEvent.type(screen.getByPlaceholderText(/電子郵件|email/i), "test@example.com");
    await userEvent.type(screen.getByPlaceholderText(/密碼|password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: "登入" }));
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "test@example.com",
      "password123"
    );
  });

  it("calls createUserWithEmailAndPassword when 註冊 is clicked", async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({});
    render(<MePage />);
    await userEvent.type(screen.getByPlaceholderText(/電子郵件|email/i), "new@example.com");
    await userEvent.type(screen.getByPlaceholderText(/密碼|password/i), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: "註冊" }));
    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "new@example.com",
      "newpass123"
    );
  });

  it("shows an error message on wrong-password", async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: "auth/wrong-password" });
    render(<MePage />);
    await userEvent.type(screen.getByPlaceholderText(/電子郵件|email/i), "test@example.com");
    await userEvent.type(screen.getByPlaceholderText(/密碼|password/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: "登入" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).not.toMatch(/auth\//);
  });

  it("shows an error message when email is already in use", async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: "auth/email-already-in-use" });
    render(<MePage />);
    await userEvent.type(screen.getByPlaceholderText(/電子郵件|email/i), "dupe@example.com");
    await userEvent.type(screen.getByPlaceholderText(/密碼|password/i), "somepass");
    await userEvent.click(screen.getByRole("button", { name: "註冊" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).not.toMatch(/auth\//);
  });
});
