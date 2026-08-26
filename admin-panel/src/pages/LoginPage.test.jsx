import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./LoginPage";

const renderPage = (overrides = {}) => {
  const props = {
    onRequestMobileOtp: jest.fn().mockResolvedValue({
      maskedMobile: "+91 ******3210",
      expiresInSeconds: 300,
      resendAfterSeconds: 60
    }),
    onVerifyMobileOtp: jest.fn().mockResolvedValue({ id: "1" }),
    onLogin: jest.fn(),
    onVerifyOtp: jest.fn(),
    onResendOtp: jest.fn(),
    ...overrides
  };
  render(<LoginPage {...props} />);
  return props;
};

beforeEach(() => localStorage.clear());

test("leads with mobile number sign in", () => {
  renderPage();
  expect(screen.getByRole("form", { name: "Mobile sign in form" })).toBeInTheDocument();
  expect(screen.getByLabelText(/mobile number/i)).toHaveAttribute("autocomplete", "tel");
  expect(screen.getByRole("button", { name: /send otp/i })).toBeEnabled();
  expect(screen.getByText(/authorized access only/i)).toBeInTheDocument();
});

test("sending a code moves to verification and shows the masked destination", async () => {
  const { onRequestMobileOtp } = renderPage();

  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

  await waitFor(() => expect(onRequestMobileOtp).toHaveBeenCalledWith("9876543210"));
  expect(await screen.findByLabelText(/six-digit verification code/i)).toBeInTheDocument();
  // The user has to be able to confirm where the code went.
  expect(screen.getByText(/\+91 \*+3210/)).toBeInTheDocument();
});

test("an empty number is rejected without calling the service", () => {
  const { onRequestMobileOtp } = renderPage();
  fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
  expect(screen.getByText(/valid mobile number/i)).toBeInTheDocument();
  expect(onRequestMobileOtp).not.toHaveBeenCalled();
});

test("the OTP field supports paste and submits once six digits are present", async () => {
  const { onVerifyMobileOtp } = renderPage();

  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
  const otp = await screen.findByLabelText(/six-digit verification code/i);

  // Pasting a spaced code is the normal way a code arrives from a message.
  fireEvent.paste(otp, { clipboardData: { getData: () => "123 456" } });

  await waitFor(() => expect(onVerifyMobileOtp).toHaveBeenCalledWith("9876543210", "123456"));
});

test("the OTP input keeps the autofill and accessibility contract", async () => {
  renderPage();
  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

  const otp = await screen.findByLabelText(/six-digit verification code/i);
  // One real labelled input, not six unlabelled boxes — this is what makes
  // one-time-code autofill and screen readers work.
  expect(otp).toHaveAttribute("autocomplete", "one-time-code");
  expect(otp).toHaveAttribute("inputmode", "numeric");
  expect(screen.getAllByLabelText(/six-digit verification code/i)).toHaveLength(1);
});

test("a server error is shown in the user's language, not raw", async () => {
  const { onRequestMobileOtp } = renderPage({
    onRequestMobileOtp: jest.fn().mockRejectedValue({
      response: {
        status: 404,
        data: {
          code: "MOBILE_NOT_REGISTERED",
          message: "This mobile number is not registered. Please contact your Safety Management System administrator."
        }
      }
    })
  });

  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: "9111111111" } });
  fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

  await waitFor(() => expect(onRequestMobileOtp).toHaveBeenCalled());
  expect(await screen.findByText(/not registered/i)).toBeInTheDocument();
  // Never a stack trace or an axios dump.
  expect(screen.queryByText(/AxiosError|status code/i)).not.toBeInTheDocument();
});

test("email sign in remains reachable so nobody is locked out", async () => {
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: /use email and password/i }));

  expect(await screen.findByRole("form", { name: "Sign in form" })).toBeInTheDocument();
  expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
});

test("a failed code attempt is announced, not just displayed", async () => {
  // Regression: the error used to render in a plain <p> while the panel's
  // assertive region stayed empty. This field auto-submits on the sixth digit,
  // so focus never moves and a screen reader user heard nothing at all.
  const { onVerifyMobileOtp } = renderPage({
    onVerifyMobileOtp: jest.fn().mockRejectedValue({
      response: { status: 401, data: { message: "The OTP is incorrect. Please try again." } }
    })
  });

  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
  const otp = await screen.findByLabelText(/six-digit verification code/i);
  fireEvent.change(otp, { target: { value: "000000" } });

  await waitFor(() => expect(onVerifyMobileOtp).toHaveBeenCalled());
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(/incorrect/i);
  expect(otp).toHaveAttribute("aria-invalid", "true");
});

test("the decorative scene is hidden from assistive technology", () => {
  renderPage();
  // The scene carries no information that is not also stated in the copy, so
  // exposing it would just add noise to a screen reader before the sign-in form.
  const scene = screen.getByTestId("safety-login-scene");
  expect(scene).toHaveAttribute("aria-hidden", "true");
});
