import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

jest.mock("./hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Safety Admin", role: "super_admin", permissions: {} },
    loading: false,
    isAuthenticated: true,
    login: jest.fn(),
    verifyOtp: jest.fn(),
    resendOtp: jest.fn(),
    logout: jest.fn()
  })
}));
jest.mock("./api/services", () => ({ settingsService: { get: jest.fn().mockResolvedValue({ settings: {} }) } }));
jest.mock("./components/common/NotificationCenter", () => () => <div>Notifications</div>);
jest.mock("./components/common/ThemeToggle", () => () => <button type="button">Theme</button>);
jest.mock("./pages/DashboardPage", () => () => <div>Dashboard content</div>);
jest.mock("./pages/WorkApprovalsPage", () => () => <div>Work approvals content</div>);
jest.mock("./pages/HazardsPage", () => () => <div>Hazards content</div>);
jest.mock("./pages/TrainingPage", () => () => <div>Training content</div>);
jest.mock("./pages/UsersPage", () => () => <div>Users content</div>);
jest.mock("./pages/ReportsPage", () => () => <div>Reports content</div>);
jest.mock("./pages/SystemHealthPage", () => () => <div>Health content</div>);
jest.mock("./pages/SettingsPage", () => () => <div>Settings content</div>);

beforeEach(() => localStorage.clear());

test("shows the topbar only on Dashboard and keeps the mobile menu trigger elsewhere", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Safety Management System" })).toBeInTheDocument();
  expect(document.title).toBe("Dashboard | Safety Management System");

  fireEvent.click(screen.getByRole("button", { name: /work approvals/i }));
  await screen.findByText("Work approvals content");
  await waitFor(() => expect(document.title).toBe("Work Approvals | Safety Management System"));
  expect(screen.queryByRole("heading", { name: "Safety Management System" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /expand sidebar|collapse sidebar/i })).not.toBeInTheDocument();
});
