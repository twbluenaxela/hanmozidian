import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FavoriteButton from "@/components/FavoriteButton";

const mockAddFavorite = jest.fn();
const mockRemoveFavorite = jest.fn();

jest.mock("@/lib/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  onSnapshot: jest.fn(),
  collection: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock("@/lib/favorites", () => ({
  addFavorite: (...args: unknown[]) => mockAddFavorite(...args),
  removeFavorite: (...args: unknown[]) => mockRemoveFavorite(...args),
}));

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

const image = { id: 1, imagePath: "/img.png", character: "永", styleSlug: "kaishu", calligrapherName: "顏真卿" };

beforeEach(() => jest.clearAllMocks());

describe("FavoriteButton", () => {
  it("renders nothing when user is not signed in", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { container } = render(<FavoriteButton image={image} isFavorited={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the button when signed in", () => {
    mockUseAuth.mockReturnValue({ user: { uid: "u1" }, loading: false });
    render(<FavoriteButton image={image} isFavorited={false} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls addFavorite when not yet favorited and clicked", async () => {
    mockAddFavorite.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: { uid: "u1" }, loading: false });
    render(<FavoriteButton image={image} isFavorited={false} />);
    await userEvent.click(screen.getByRole("button"));
    expect(mockAddFavorite).toHaveBeenCalledWith("u1", image);
    expect(mockRemoveFavorite).not.toHaveBeenCalled();
  });

  it("calls removeFavorite when already favorited and clicked", async () => {
    mockRemoveFavorite.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: { uid: "u1" }, loading: false });
    render(<FavoriteButton image={image} isFavorited={true} />);
    await userEvent.click(screen.getByRole("button"));
    expect(mockRemoveFavorite).toHaveBeenCalledWith("u1", image.id);
    expect(mockAddFavorite).not.toHaveBeenCalled();
  });
});
