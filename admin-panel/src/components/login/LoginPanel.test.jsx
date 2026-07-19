import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPanel from "./LoginPanel";

const renderPanel = (overrides = {}) => {
  const props = {
    onLogin: jest.fn().mockResolvedValue({ user: { id: "1" } }),
    onVerifyOtp: jest.fn().mockResolvedValue({ user: { id: "1" } }),
    onResendOtp: jest.fn().mockResolvedValue({
      pendingOtp: true,
      maskedEmail: "sa****@company.com",
      expiresInSeconds: 300,
      resendAfterSeconds: 60
    }),
    ...overrides
  };

  render(<LoginPanel {...props} />);
  return props;
};

const completeLoginFields = () => {
  fireEvent.change(screen.getByLabelText(/work email/i), {
    target: { value: "safety@company.com" }
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: "SafePassword1" }
  });
};

beforeEach(() => {
  localStorage.clear();
});

test("renders the accessible login fields and secure submit action", () => {
  renderPanel();

  expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/work email/i)).toHaveAttribute("autocomplete", "username");
  expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
    "autocomplete",
    "current-password"
  );
  expect(screen.getByRole("button", { name: /sign in securely/i })).toBeEnabled();
});

test("password visibility control is keyboard-accessible", () => {
  renderPanel();
  const password = screen.getByLabelText(/^password$/i);
  const toggle = screen.getByRole("button", { name: /show password/i });

  expect(password).toHaveAttribute("type", "password");
  fireEvent.click(toggle);
  expect(password).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: /hide password/i })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("announces empty-field validation without calling the login service", () => {
  const { onLogin } = renderPanel();

  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

  expect(screen.getByText(/please enter your work email/i)).toBeInTheDocument();
  expect(screen.getByText(/please enter your password/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/work email/i)).toHaveAttribute("aria-invalid", "true");
  expect(onLogin).not.toHaveBeenCalled();
});

test("form submission disables the action and prevents duplicate requests", async () => {
  let resolveLogin;
  const onLogin = jest.fn(
    () => new Promise((resolve) => {
      resolveLogin = resolve;
    })
  );
  renderPanel({ onLogin });
  completeLoginFields();
  const form = screen.getByRole("form", { name: /sign in form/i });

  fireEvent.submit(form);
  fireEvent.submit(form);

  expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  expect(onLogin).toHaveBeenCalledTimes(1);

  await act(async () => resolveLogin({ user: { id: "1" } }));
  expect(await screen.findByText(/authentication successful/i)).toBeInTheDocument();
});

test("transitions to OTP, accepts a pasted six-digit value, and verifies", async () => {
  const onLogin = jest.fn().mockResolvedValue({
    pendingOtp: true,
    maskedEmail: "sa****@company.com",
    expiresInSeconds: 300,
    resendAfterSeconds: 60
  });
  const onVerifyOtp = jest.fn().mockResolvedValue({ user: { id: "1" } });
  renderPanel({ onLogin, onVerifyOtp });
  completeLoginFields();

  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));
  expect(await screen.findByRole("heading", { name: /verify your identity/i })).toBeInTheDocument();
  expect(screen.getByText("sa****@company.com")).toBeInTheDocument();

  const otpInput = screen.getByLabelText(/six-digit verification code/i);
  fireEvent.change(otpInput, { target: { value: "123456" } });
  expect(otpInput).toHaveValue("123456");
  fireEvent.submit(screen.getByRole("form", { name: /verification form/i }));

  await waitFor(() => expect(onVerifyOtp).toHaveBeenCalledWith("safety@company.com", "123456"));
});

test("enforces the resend cooldown and supports returning to login", async () => {
  renderPanel({
    onLogin: jest.fn().mockResolvedValue({
      pendingOtp: true,
      maskedEmail: "sa****@company.com",
      expiresInSeconds: 300,
      resendAfterSeconds: 60
    })
  });
  completeLoginFields();
  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

  const resend = await screen.findByRole("button", { name: /resend in 60s/i });
  expect(resend).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
  expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
});

test("shows friendly service errors in an announced alert", async () => {
  renderPanel({
    onLogin: jest.fn().mockRejectedValue({ response: { status: 401, data: {} } })
  });
  completeLoginFields();
  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(/email or password is incorrect/i);
  expect(alert).not.toHaveTextContent(/401|axios|stack/i);
});

test("forgot password opens an honest administrator-managed recovery state", () => {
  renderPanel();
  fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));

  expect(screen.getByRole("heading", { name: /password assistance/i })).toBeInTheDocument();
  expect(screen.getByText(/password resets are managed/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
  expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
});

test("resends OTP once the backend-provided cooldown has elapsed", async () => {
  const onResendOtp = jest.fn().mockResolvedValue({
    pendingOtp: true,
    maskedEmail: "sa****@company.com",
    expiresInSeconds: 300,
    resendAfterSeconds: 60
  });
  renderPanel({
    onLogin: jest.fn().mockResolvedValue({
      pendingOtp: true,
      maskedEmail: "sa****@company.com",
      expiresInSeconds: 300,
      resendAfterSeconds: 0
    }),
    onResendOtp
  });
  completeLoginFields();
  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

  fireEvent.click(await screen.findByRole("button", { name: /resend code/i }));

  await waitFor(() => expect(onResendOtp).toHaveBeenCalledWith("safety@company.com"));
  expect(await screen.findByText(/new verification code has been sent/i)).toBeInTheDocument();
});

test("disables verification when the OTP is expired", async () => {
  renderPanel({
    onLogin: jest.fn().mockResolvedValue({
      pendingOtp: true,
      maskedEmail: "sa****@company.com",
      expiresInSeconds: 0,
      resendAfterSeconds: 0
    })
  });
  completeLoginFields();
  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

  expect(await screen.findByText(/code has expired/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /verify & continue/i })).toBeDisabled();
});

test("announces invalid OTP responses without exposing backend details", async () => {
  const onVerifyOtp = jest.fn().mockRejectedValue({
    response: { status: 401, data: { message: "internal otp hash mismatch" } }
  });
  renderPanel({
    onLogin: jest.fn().mockResolvedValue({
      pendingOtp: true,
      maskedEmail: "sa****@company.com",
      expiresInSeconds: 300,
      resendAfterSeconds: 60
    }),
    onVerifyOtp
  });
  completeLoginFields();
  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));
  const otpInput = await screen.findByLabelText(/six-digit verification code/i);
  fireEvent.change(otpInput, { target: { value: "654321" } });
  fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(/incorrect or has expired/i);
  expect(alert).not.toHaveTextContent(/hash mismatch/i);
});

test("uses a safe connection message for network failures", async () => {
  renderPanel({ onLogin: jest.fn().mockRejectedValue(new Error("socket refused")) });
  completeLoginFields();
  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/unable to connect to the server/i);
});

test("maps blocked accounts to administrator guidance", async () => {
  renderPanel({
    onLogin: jest.fn().mockRejectedValue({
      response: { status: 403, data: { code: "USER_BLOCKED", message: "User is blocked" } }
    })
  });
  completeLoginFields();
  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/account is inactive/i);
});

test("stores only the remembered email preference after successful sign in", async () => {
  renderPanel();
  completeLoginFields();
  fireEvent.click(screen.getByLabelText(/remember my email/i));
  fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

  await screen.findByText(/authentication successful/i);
  expect(localStorage.getItem("rememberLogin")).toBe("true");
  expect(localStorage.getItem("rememberedLoginEmail")).toBe("safety@company.com");
  expect(localStorage.getItem("password")).toBeNull();
});
