import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./api/services", () => {
  const actual = jest.requireActual("./api/services");
  return {
    ...actual,
    authService: {
      ...actual.authService,
      getCsrf: jest.fn().mockResolvedValue({ csrfToken: "test-csrf-token" })
    }
  };
});

test("renders login shell", async () => {
  localStorage.clear();
  render(<App />);
  expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
});
