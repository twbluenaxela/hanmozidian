import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JiziPicker from "@/components/JiziPicker";

const baseProps = {
  text: "永",
  style: "kai",
  open: true,
  selectedCalligraphers: [],
  selectedWorks: [],
  onToggleCalligrapher: jest.fn(),
  onToggleWork: jest.fn(),
  onReset: jest.fn(),
};

const mockCoverageResponse = {
  calligraphers: [
    { id: 1, nameZh: "歐陽詢", imageCount: 5 },
    { id: 2, nameZh: "顏真卿", imageCount: 3 },
    { id: 3, nameZh: "柳公權", imageCount: 0 },
  ],
  works: [
    { id: 10, nameZh: "九成宮", imageCount: 5 },
    { id: 11, nameZh: "多寶塔碑", imageCount: 3 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(mockCoverageResponse),
  } as Response);
});

describe("JiziPicker", () => {
  it("returns null when open is false", () => {
    const { container } = render(<JiziPicker {...baseProps} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows prompt to input text when text is empty", () => {
    render(<JiziPicker {...baseProps} text="" />);
    expect(screen.getByText("請先輸入漢字")).toBeInTheDocument();
  });

  it("fetches coverage from the API when open and text is set", async () => {
    render(<JiziPicker {...baseProps} />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/jizi/coverage")
      );
    });
  });

  it("renders calligrapher chips after fetch", async () => {
    render(<JiziPicker {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("歐陽詢")).toBeInTheDocument();
      expect(screen.getByText("顏真卿")).toBeInTheDocument();
    });
  });

  it("disables chips whose imageCount is 0", async () => {
    render(<JiziPicker {...baseProps} />);
    await waitFor(() => screen.getByText("柳公權"));
    const btn = screen.getByText("柳公權").closest("button");
    expect(btn).toBeDisabled();
  });

  it("calls onToggleCalligrapher when an enabled calligrapher chip is clicked", async () => {
    const user = userEvent.setup();
    render(<JiziPicker {...baseProps} />);
    await waitFor(() => screen.getByText("歐陽詢"));
    await user.click(screen.getByText("歐陽詢").closest("button")!);
    expect(baseProps.onToggleCalligrapher).toHaveBeenCalledWith(1);
  });

  it("switches to the works tab and shows work chips", async () => {
    const user = userEvent.setup();
    render(<JiziPicker {...baseProps} />);
    await waitFor(() => screen.getByText("歐陽詢"));
    await user.click(screen.getByRole("button", { name: "作品" }));
    expect(screen.getByText("九成宮")).toBeInTheDocument();
    expect(screen.getByText("多寶塔碑")).toBeInTheDocument();
  });

  it("calls onToggleWork when a work chip is clicked", async () => {
    const user = userEvent.setup();
    render(<JiziPicker {...baseProps} />);
    await waitFor(() => screen.getByText("歐陽詢"));
    await user.click(screen.getByRole("button", { name: "作品" }));
    await user.click(screen.getByText("九成宮").closest("button")!);
    expect(baseProps.onToggleWork).toHaveBeenCalledWith(10);
  });

  it("filters calligrapher chips by search input", async () => {
    const user = userEvent.setup();
    render(<JiziPicker {...baseProps} />);
    await waitFor(() => screen.getByText("歐陽詢"));
    await user.type(screen.getByPlaceholderText("搜索名家..."), "顏");
    expect(screen.getByText("顏真卿")).toBeInTheDocument();
    expect(screen.queryByText("歐陽詢")).not.toBeInTheDocument();
  });

  it("shows 無匹配項 when search yields no results", async () => {
    const user = userEvent.setup();
    render(<JiziPicker {...baseProps} />);
    await waitFor(() => screen.getByText("歐陽詢"));
    await user.type(screen.getByPlaceholderText("搜索名家..."), "zzz");
    expect(screen.getByText("無匹配項")).toBeInTheDocument();
  });

  it("calls onReset when Clear All is clicked", async () => {
    const user = userEvent.setup();
    render(<JiziPicker {...baseProps} />);
    await user.click(screen.getByText("Clear All"));
    expect(baseProps.onReset).toHaveBeenCalledTimes(1);
  });

  it("highlights selected calligrapher chips", async () => {
    render(<JiziPicker {...baseProps} selectedCalligraphers={[1]} />);
    await waitFor(() => screen.getByText("歐陽詢"));
    const btn = screen.getByText("歐陽詢").closest("button");
    // Selected chips get the accent background class
    expect(btn?.className).toContain("bg-[var(--accent)]");
  });
});
