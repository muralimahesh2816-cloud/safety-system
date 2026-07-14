import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders login shell", async () => {
  render(<App />);
  expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
});
