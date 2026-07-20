import { render, screen } from "@testing-library/react";
import EvidenceLocationDetails from "./EvidenceLocationDetails";

test("shows complete location to a read-only viewer without edit controls", () => {
  render(
    <EvidenceLocationDetails
      location={{
        formattedAddress: "Saligrama, Karnataka 576225",
        latitude: 13.494759,
        longitude: 74.719246,
        accuracyMeters: 18,
        capturedAt: "2026-07-20T10:52:00.000Z",
        source: "device_gps",
        status: "captured"
      }}
      readOnly
      canRetry
      canRemove
      onRetry={() => {}}
      onRemove={() => {}}
    />
  );

  expect(screen.getByText("Saligrama, Karnataka 576225")).toBeInTheDocument();
  expect(screen.getByText("13.494759, 74.719246")).toBeInTheDocument();
  expect(screen.getByText("±18 metres")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open captured location in Google Maps" })).toHaveAttribute(
    "href",
    "https://www.google.com/maps?q=13.494759,74.719246"
  );
  expect(screen.queryByRole("button", { name: /retry location/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /remove location/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("shows clean missing-coordinate text and hides Open Location", () => {
  render(<EvidenceLocationDetails location={{ formattedAddress: "Address only" }} readOnly />);
  expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: /open captured location/i })).not.toBeInTheDocument();
});
