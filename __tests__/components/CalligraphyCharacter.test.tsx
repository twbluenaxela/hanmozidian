import { render, screen } from "@testing-library/react";
import CalligraphyCharacter from "@/components/CalligraphyCharacter";

describe("CalligraphyCharacter", () => {
  const baseProps = {
    imageUrl: "https://example.com/char.png",
    char: "永",
  };

  it("renders an img element with the character URL", () => {
    render(<CalligraphyCharacter {...baseProps} />);
    const img = screen.getByAltText("永");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toContain("https://example.com/char.png");
  });

  it("falls back to the character glyph when imageUrl is empty", () => {
    render(<CalligraphyCharacter {...baseProps} imageUrl="" />);
    expect(screen.queryByAltText("永")).not.toBeInTheDocument();
    expect(screen.getByText("永")).toBeInTheDocument();
  });

  it("falls back to the character glyph when imageUrl is too short", () => {
    render(<CalligraphyCharacter {...baseProps} imageUrl="x" />);
    expect(screen.queryByAltText("永")).not.toBeInTheDocument();
    expect(screen.getByText("永")).toBeInTheDocument();
  });

  it("applies the given size as width and height", () => {
    const { container } = render(
      <CalligraphyCharacter {...baseProps} size={200} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: "200px", height: "200px" });
  });

  it("uses 128px as the default size", () => {
    const { container } = render(<CalligraphyCharacter {...baseProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: "128px", height: "128px" });
  });

  it("renders a circle border when borderShape is circle", () => {
    const { container } = render(
      <CalligraphyCharacter {...baseProps} showBorder borderShape="circle" borderWidth={2} borderColor="#000" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ borderRadius: "50%" });
  });

  it("renders a rounded-rect border when borderShape is square", () => {
    const { container } = render(
      <CalligraphyCharacter {...baseProps} showBorder borderShape="square" borderWidth={2} borderColor="#000" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ borderRadius: "12px" });
  });

  it("hides the border when showBorder is false", () => {
    const { container } = render(
      <CalligraphyCharacter {...baseProps} showBorder={false} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ border: "none" });
  });

  it("renders the 九宮格 SVG overlay when grid is jiu", () => {
    const { container } = render(
      <CalligraphyCharacter {...baseProps} grid="jiu" />
    );
    // 九宮格 uses 4 dashed lines; each is a <line> element
    const lines = container.querySelectorAll("svg line");
    expect(lines.length).toBeGreaterThanOrEqual(4);
  });

  it("renders the 米字格 SVG overlay when grid is mi", () => {
    const { container } = render(
      <CalligraphyCharacter {...baseProps} grid="mi" />
    );
    const lines = container.querySelectorAll("svg line");
    expect(lines.length).toBeGreaterThanOrEqual(4);
  });

  it("renders no grid lines when grid is none", () => {
    const { container } = render(
      <CalligraphyCharacter {...baseProps} grid="none" />
    );
    // The only SVG present is the filter defs SVG (no <line> elements inside)
    const lines = container.querySelectorAll("svg line");
    expect(lines.length).toBe(0);
  });
});
