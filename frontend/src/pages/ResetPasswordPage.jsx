import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Button, Input, LogoIcon } from "../components";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { validatePassword } from "../utils/helpers";

function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    password: "",
    confirmPassword: "",
    token: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name] || errors.token) {
      setErrors((prev) => ({ ...prev, [name]: "", token: "" }));
    }
  };

  const validateForm = (trimmedData) => {
    const passwordError = validatePassword(trimmedData.password);
    const confirmPasswordError =
      trimmedData.password !== trimmedData.confirmPassword
        ? "Passwords do not match"
        : "";
    const tokenError = token ? "" : "Reset link is missing or invalid.";

    setErrors({
      password: passwordError,
      confirmPassword: confirmPasswordError,
      token: tokenError,
    });

    return !passwordError && !confirmPasswordError && !tokenError;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedData = {
      password: formData.password.trim(),
      confirmPassword: formData.confirmPassword.trim(),
    };

    if (!validateForm(trimmedData)) {
      return;
    }

    setIsLoading(true);

    try {
      await axiosInstance.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token,
        password: trimmedData.password,
      });

      toast.success("Password reset. You can sign in now.");
      navigate("/login", { replace: true });
    } catch (resetError) {
      console.error("Error resetting password:", resetError?.message);

      const errorMessage =
        resetError?.response?.data?.error ||
        resetError?.response?.data?.message ||
        "Unable to reset password. Please request a new link.";

      setErrors((prev) => ({ ...prev, token: errorMessage }));
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
            Choose a New Password
          </h1>

          <p className="text-slate-600 text-sm sm:text-base mt-2">
            Create a strong password to regain access to your account.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-lg">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-y-5 sm:gap-y-6"
          >
            {errors.token && (
              <p
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {errors.token}
              </p>
            )}

            <Input
              type="password"
              label="New password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter a new password"
              icon={LockKeyhole}
              error={errors.password}
              helperText={
                !errors.password &&
                "Min 8 chars, with upper and lowercase letters and a number"
              }
            />

            <Input
              type="password"
              label="Confirm password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your new password"
              icon={LockKeyhole}
              error={errors.confirmPassword}
            />

            <Button
              type="submit"
              isLoading={isLoading}
              ariaLabel={isLoading ? "Resetting password..." : "Reset password"}
              className="w-full"
            >
              Reset password
            </Button>
          </form>

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

export default ResetPasswordPage;
