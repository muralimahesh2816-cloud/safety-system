import { render, screen } from "@testing-library/react";
import PageHeader from "./PageHeader";

test("renders centralized portal branding, module title, and breadcrumb", () => {
  render(<PageHeader title="Work Approvals" subtitle="Official work records" />);
  expect(screen.getByText("Safety Management System")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Work Approvals" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toHaveTextContent("DashboardWork Approvals");
});
