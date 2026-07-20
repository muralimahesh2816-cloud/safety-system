import { render, screen } from "@testing-library/react";
import LoginPage from "./LoginPage";

test("uses one accessible Vertis logo inside the glass authentication card", () => {
  render(
    <LoginPage onLogin={jest.fn()} onVerifyOtp={jest.fn()} onResendOtp={jest.fn()} />
  );

  expect(screen.getAllByAltText("Vertis")).toHaveLength(1);
  expect(screen.getByTestId("rotating-momentum-svg")).toBeInTheDocument();
});

test("keeps the authorization notice and semantic sign-in form", () => {
  render(<LoginPage onLogin={jest.fn()} onVerifyOtp={jest.fn()} onResendOtp={jest.fn()} />);
  expect(screen.getByRole("form", { name: "Sign in form" })).toBeInTheDocument();
  expect(screen.getByText(/authorized access only/i)).toBeInTheDocument();
});
