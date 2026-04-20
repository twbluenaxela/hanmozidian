import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MePage from "@/app/me/page";

const mockSignInWithPopup = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/lib/firebase", () => ({ auth: {}, db: {} }));
jest.mock("firebase/auth", () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  GoogleAuthProvider: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({}));

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/lib/favorites", () => ({ useFavorites: jest.fn().mockReturnValue([]) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null, loading: false });
});

// ─── loading ──────────────────────────────────────────────────────────────────

describe("loading state", () => {
  it("shows spinner while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<MePage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// ─── sign-in mode (default) ───────────────────────────────────────────────────

describe("sign-in mode", () => {
  it("shows Google button, email input, password input, and 登入 button", () => {
    render(<MePage />);
    expect(screen.getByRole("button", { name: /Google/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("電子郵件")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("密碼")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登入" })).toBeInTheDocument();
  });

  it("calls signInWithEmailAndPassword on 登入", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({});
    render(<MePage />);
    await userEvent.type(screen.getByPlaceholderText("電子郵件"), "a@b.com");
    await userEvent.type(screen.getByPlaceholderText("密碼"), "somepassword");
    await userEvent.click(screen.getByRole("button", { name: "登入" }));
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), "a@b.com", "somepassword");
  });

  it("shows inline error on bad credentials", async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: "auth/invalid-credential" });
    render(<MePage />);
    await userEvent.type(screen.getByPlaceholderText("電子郵件"), "a@b.com");
    await userEvent.type(screen.getByPlaceholderText("密碼"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: "登入" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).not.toMatch(/auth\//);
  });

  it("has a show/hide toggle for the password field", async () => {
    render(<MePage />);
    const input = screen.getByPlaceholderText("密碼");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: /顯示密碼/i }));
    expect(input).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: /隱藏密碼/i }));
    expect(input).toHaveAttribute("type", "password");
  });
});

// ─── register mode ────────────────────────────────────────────────────────────

describe("register mode", () => {
  beforeEach(async () => {
    render(<MePage />);
    await userEvent.click(screen.getByRole("button", { name: /沒有帳號/i }));
  });

  it("shows 註冊 button after switching mode", () => {
    expect(screen.getByRole("button", { name: "註冊" })).toBeInTheDocument();
  });

  it("blocks registration if password is under 12 chars", async () => {
    await userEvent.type(screen.getByPlaceholderText("電子郵件"), "a@b.com");
    await userEvent.type(screen.getByPlaceholderText("密碼"), "short");
    await userEvent.click(screen.getByRole("button", { name: "註冊" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("calls createUserWithEmailAndPassword with a valid password", async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({});
    await userEvent.type(screen.getByPlaceholderText("電子郵件"), "new@example.com");
    await userEvent.type(screen.getByPlaceholderText("密碼"), "validpassword123");
    await userEvent.click(screen.getByRole("button", { name: "註冊" }));
    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(), "new@example.com", "validpassword123"
    );
  });

  it("shows a strength bar while typing", async () => {
    await userEvent.type(screen.getByPlaceholderText("密碼"), "abc");
    expect(screen.getByText("太短")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("密碼"), "defghijk");
    expect(screen.getByText("快到了")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("密碼"), "lmnop");
    expect(screen.getByText("符合要求")).toBeInTheDocument();
  });
});

// ─── forgot password mode ─────────────────────────────────────────────────────

describe("forgot password mode", () => {
  beforeEach(async () => {
    render(<MePage />);
    await userEvent.click(screen.getByRole("button", { name: /忘記密碼/i }));
  });

  it("hides the password field in reset mode", () => {
    expect(screen.queryByPlaceholderText("密碼")).not.toBeInTheDocument();
  });

  it("calls sendPasswordResetEmail with the entered email", async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    await userEvent.type(screen.getByPlaceholderText("電子郵件"), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: /寄送重設連結/i }));
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), "user@example.com");
  });

  it("shows confirmation message after reset email is sent", async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    await userEvent.type(screen.getByPlaceholderText("電子郵件"), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: /寄送重設連結/i }));
    expect(await screen.findByText(/重設連結已寄送/i)).toBeInTheDocument();
  });

  it("shows an error if email is missing", async () => {
    await userEvent.click(screen.getByRole("button", { name: /寄送重設連結/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("can navigate back to sign-in", async () => {
    await userEvent.click(screen.getByRole("button", { name: /返回登入/i }));
    expect(screen.getByRole("button", { name: "登入" })).toBeInTheDocument();
  });
});

// ─── signed-in profile ────────────────────────────────────────────────────────

describe("signed-in profile", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { displayName: "王羲之", email: "wang@example.com", photoURL: null, uid: "u1" },
      loading: false,
    });
  });

  it("shows name, email, and sign-out link", () => {
    render(<MePage />);
    expect(screen.getByText("王羲之")).toBeInTheDocument();
    expect(screen.getByText("wang@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登出" })).toBeInTheDocument();
  });

  it("calls signOut when 登出 is clicked", async () => {
    render(<MePage />);
    await userEvent.click(screen.getByRole("button", { name: "登出" }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
