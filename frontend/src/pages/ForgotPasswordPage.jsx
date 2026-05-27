import { useState } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { Button, Input, LogoIcon } from "../components";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { validateEmail } from "../utils/helpers";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleChange = (event) => {
    setEmail(event.target.value);

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const emailError = validateEmail(trimmedEmail);

    if (emailError) {
      setError(emailError);
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await axiosInstance.post(
        API_ENDPOINTS.AUTH.REQUEST_PASSWORD_RESET,
        { email: trimmedEmail }
      );

      setHasSubmitted(true);
      toast.success(data?.message || "Check your email for a reset link.");
    } catch (requestError) {
      console.error("Error requesting password reset:", requestError?.message);

      const errorMessage =
        requestError?.response?.data?.error ||
        requestError?.response?.data?.message ||
        "Unable to send reset email. Please try again.";

      setError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 flex justify-center items-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="size-14 sm:size-16 bg-linear-to-br from-violet-400 to-violet-500 rounded-full mx-auto mb-3 sm:mb-4 shadow-md flex justify-center items-center">
            <LogoIcon className="size-7 sm:size-8 text-white" />
          </div>

          <h1 className="text-slate-900 text-2xl sm:text-3xl font-bold">
            Reset Your Password
          </h1>

          <p className="text-slate-600 text-sm sm:text-base mt-2">
            Enter your account email and we'll send you a secure reset link.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-lg">
          {hasSubmitted ? (
            <div className="text-center">
              <div className="size-12 rounded-full bg-emerald-50 mx-auto mb-4 flex items-center justify-center">
                <MailCheck className="size-6 text-emerald-600" />
              </div>

              <h2 className="text-lg font-semibold text-slate-900">
                Check your inbox
              </h2>

              <p className="text-sm text-slate-600 mt-2">
                If an account exists for {email.trim()}, a reset link will
                arrive shortly.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-y-5 sm:gap-y-6"
            >
              <Input
                type="email"
                label="Email"
                name="email"
                value={email}
                onChange={handleChange}
                required
                placeholder="email@example.com"
                icon={Mail}
                error={error}
              />

              <Button
                type="submit"
                isLoading={isLoading}
                ariaLabel={isLoading ? "Sending reset link..." : "Send reset link"}
                className="w-full"
              >
                Send reset link
              </Button>
            </form>
          )}

          <p className="text-slate-600 text-center text-xs sm:text-sm mt-6 sm:mt-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-violet-600 font-medium transition-all duration-200 hover:text-violet-700 hover:underline focus-visible:text-violet-700 focus-visible:underline"
            >
              <ArrowLeft className="size-3.5" />
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default ForgotPasswordPage;
