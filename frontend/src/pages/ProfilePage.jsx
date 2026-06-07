import { createElement, useCallback, useEffect, useState, useRef } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { validateName } from "../utils/helpers";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS, resolveImageUrl } from "../utils/api-endpoints";
import DashboardLayout from "../layouts/DashboardLayout";
import { Button, Input } from "../components";
import {
  Mail,
  User2,
  Camera,
  Trash2,
  Store,
  BookOpen,
  Image as ImageIcon,
  Heading,
  TextQuote,
  Globe2,
  Search,
  Sparkles,
  KeyRound,
  Plus,
  Copy,
  Pencil,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";

function validateOptionalUrl(value = "", label = "link") {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(normalized);

    return ["http:", "https:"].includes(parsed.protocol)
      ? ""
      : `${label} must start with http:// or https://`;
  } catch {
    return `Please enter a valid ${label}`;
  }
}

function validateStoreUrl(value = "") {
  return validateOptionalUrl(value, "store link");
}

function validateShelfPhotoUrl(value = "") {
  return validateOptionalUrl(value, "shelf photo URL");
}

function validateShelfPageName(value = "") {
  return String(value || "").trim().length <= 80
    ? ""
    : "Shelf page name cannot exceed 80 characters";
}

function validateShareMetaTitle(value = "") {
  return String(value || "").trim().length <= 80
    ? ""
    : "Share meta title cannot exceed 80 characters";
}

function validateShareMetaDescription(value = "") {
  return String(value || "").trim().length <= 180
    ? ""
    : "Share meta description cannot exceed 180 characters";
}

function validateShareImageUrl(value = "") {
  return validateOptionalUrl(value, "share image URL");
}

function resolvePreviewUrl(value = "") {
  const trimmed = String(value || "").trim();

  if (!trimmed || validateOptionalUrl(trimmed)) return "";

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  return resolveImageUrl(normalized);
}

function formatApiKeyDate(value) {
  if (!value) return "Never";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Never";
  }
}

function SectionHeader({ icon: HeaderIcon, eyebrow, title, description }) {
  const iconElement = HeaderIcon
    ? createElement(HeaderIcon, { className: "size-5" })
    : null;

  return (
    <div className="flex items-start gap-3">
      <div className="size-10 shrink-0 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-sm">
        {iconElement}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">
          {eyebrow}
        </p>
        <h2 className="text-lg font-black text-slate-950 mt-1">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
    </div>
  );
}

function ProfilePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("Default integration");
  const [newApiKeySecret, setNewApiKeySecret] = useState("");
  const [editingApiKeyId, setEditingApiKeyId] = useState("");
  const [editingApiKeyName, setEditingApiKeyName] = useState("");
  const [revokingApiKeyId, setRevokingApiKeyId] = useState("");
  const [errors, setErrors] = useState({
    name: "",
    storeUrl: "",
    shelfPageName: "",
    shelfPhotoUrl: "",
    publicShareMetaTitle: "",
    publicShareMetaDescription: "",
    publicShareImageUrl: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    storeUrl: "",
    shelfPageName: "",
    shelfPhotoUrl: "",
    publicShareMetaTitle: "",
    publicShareMetaDescription: "",
    publicShareImageUrl: "",
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [hasNameChanged, setHasNameChanged] = useState(false);
  const [hasStoreUrlChanged, setHasStoreUrlChanged] = useState(false);
  const [hasShelfPageNameChanged, setHasShelfPageNameChanged] = useState(false);
  const [hasShelfPhotoUrlChanged, setHasShelfPhotoUrlChanged] = useState(false);
  const [hasShareMetaTitleChanged, setHasShareMetaTitleChanged] =
    useState(false);
  const [
    hasShareMetaDescriptionChanged,
    setHasShareMetaDescriptionChanged,
  ] = useState(false);
  const [hasShareImageUrlChanged, setHasShareImageUrlChanged] = useState(false);
  const [hasAvatarChanged, setHasAvatarChanged] = useState(false);

  const fileInputRef = useRef(null);
  const { user, updateUser, isLoading: authContextLoading } = useAuthContext();
  const currentUserId = user?._id;

  // Fetch user whenever user changes
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name,
        email: user.email,
        storeUrl: user.storeUrl || "",
        shelfPageName: user.shelfPageName || "",
        shelfPhotoUrl: user.shelfPhotoUrl || "",
        publicShareMetaTitle: user.publicShareMetaTitle || "",
        publicShareMetaDescription: user.publicShareMetaDescription || "",
        publicShareImageUrl: user.publicShareImageUrl || "",
      }));
      setAvatarPreview(user.avatar ? resolveImageUrl(user.avatar) : null);
    }
  }, [user]);

  const loadApiKeys = useCallback(async () => {
    setIsLoadingApiKeys(true);

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.PROFILE.API_KEYS);
      setApiKeys(Array.isArray(data.apiKeys) ? data.apiKeys : []);
    } catch (error) {
      console.error("Error loading API keys:", error?.message);
      toast.error(
        error?.response?.data?.error || "Failed to load API keys.",
        { duration: 5000 }
      );
    } finally {
      setIsLoadingApiKeys(false);
    }
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadApiKeys();
    }
  }, [currentUserId, loadApiKeys]);

  const handleCreateApiKey = async () => {
    const name = apiKeyName.trim() || "API key";

    setIsCreatingApiKey(true);

    try {
      const { data } = await axiosInstance.post(
        API_ENDPOINTS.PROFILE.API_KEYS,
        { name }
      );

      setApiKeys((prev) => [data.apiKey, ...prev].filter(Boolean));
      setNewApiKeySecret(data.key || "");
      setApiKeyName("");
      toast.success("API key created.");
    } catch (error) {
      console.error("Error creating API key:", error?.message);
      toast.error(error?.response?.data?.error || "Failed to create API key.", {
        duration: 5000,
      });
    } finally {
      setIsCreatingApiKey(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (!newApiKeySecret) return;

    try {
      await navigator.clipboard.writeText(newApiKeySecret);
      toast.success("API key copied.");
    } catch (error) {
      console.error("Error copying API key:", error?.message);
      toast.error("Could not copy API key.");
    }
  };

  const handleStartRenameApiKey = (apiKey) => {
    setEditingApiKeyId(apiKey.id);
    setEditingApiKeyName(apiKey.name || "");
  };

  const handleCancelRenameApiKey = () => {
    setEditingApiKeyId("");
    setEditingApiKeyName("");
  };

  const handleSaveApiKeyName = async (apiKeyId) => {
    const name = editingApiKeyName.trim();

    if (!name) {
      toast.error("API key name is required.");
      return;
    }

    try {
      const { data } = await axiosInstance.patch(
        `${API_ENDPOINTS.PROFILE.API_KEYS}/${apiKeyId}`,
        { name }
      );

      setApiKeys((prev) =>
        prev.map((apiKey) => (apiKey.id === apiKeyId ? data.apiKey : apiKey))
      );
      handleCancelRenameApiKey();
      toast.success("API key renamed.");
    } catch (error) {
      console.error("Error renaming API key:", error?.message);
      toast.error(error?.response?.data?.error || "Failed to rename API key.", {
        duration: 5000,
      });
    }
  };

  const handleRevokeApiKey = async (apiKeyId) => {
    setRevokingApiKeyId(apiKeyId);

    try {
      await axiosInstance.delete(`${API_ENDPOINTS.PROFILE.API_KEYS}/${apiKeyId}`);
      setApiKeys((prev) => prev.filter((apiKey) => apiKey.id !== apiKeyId));
      if (editingApiKeyId === apiKeyId) {
        handleCancelRenameApiKey();
      }
      toast.success("API key revoked.");
    } catch (error) {
      console.error("Error revoking API key:", error?.message);
      toast.error(error?.response?.data?.error || "Failed to revoke API key.", {
        duration: 5000,
      });
    } finally {
      setRevokingApiKeyId("");
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Check if name has changed from original
    if (name === "name") {
      setHasNameChanged(value.trim() !== user?.name);
    }

    if (name === "storeUrl") {
      setHasStoreUrlChanged(value.trim() !== (user?.storeUrl || ""));
    }

    if (name === "shelfPageName") {
      setHasShelfPageNameChanged(
        value.trim() !== (user?.shelfPageName || "")
      );
    }

    if (name === "shelfPhotoUrl") {
      setHasShelfPhotoUrlChanged(value.trim() !== (user?.shelfPhotoUrl || ""));
    }

    if (name === "publicShareMetaTitle") {
      setHasShareMetaTitleChanged(
        value.trim() !== (user?.publicShareMetaTitle || "")
      );
    }

    if (name === "publicShareMetaDescription") {
      setHasShareMetaDescriptionChanged(
        value.trim() !== (user?.publicShareMetaDescription || "")
      );
    }

    if (name === "publicShareImageUrl") {
      setHasShareImageUrlChanged(
        value.trim() !== (user?.publicShareImageUrl || "")
      );
    }

    // clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPEG, PNG, GIF, and WebP images are allowed!", {
        duration: 5000,
      });

      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB!", { duration: 5000 });

      return;
    }

    setSelectedAvatarFile(file);

    // create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
      setHasAvatarChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteAvatar = async () => {
    if (!user?.avatar) {
      toast.error("No avatar to delete!", { duration: 5000 });

      return;
    }

    setIsDeletingAvatar(true);

    try {
      const { data } = await axiosInstance.delete(
        API_ENDPOINTS.PROFILE.DELETE_AVATAR
      );

      updateUser(data.user);
      setAvatarPreview(null);
      setSelectedAvatarFile(null);
      setHasAvatarChanged(false);

      toast.success("Avatar deleted successfully!");
    } catch (error) {
      console.error("Error deleting avatar:", error?.message);

      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to delete avatar. Please try again.";

      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const validateForm = (trimmedData) => {
    const nameError = validateName(trimmedData.name);
    const storeUrlError = validateStoreUrl(trimmedData.storeUrl);
    const shelfPageNameError = validateShelfPageName(
      trimmedData.shelfPageName
    );
    const shelfPhotoUrlError = validateShelfPhotoUrl(
      trimmedData.shelfPhotoUrl
    );
    const shareMetaTitleError = validateShareMetaTitle(
      trimmedData.publicShareMetaTitle
    );
    const shareMetaDescriptionError = validateShareMetaDescription(
      trimmedData.publicShareMetaDescription
    );
    const shareImageUrlError = validateShareImageUrl(
      trimmedData.publicShareImageUrl
    );

    setErrors({
      name: nameError,
      storeUrl: storeUrlError,
      shelfPageName: shelfPageNameError,
      shelfPhotoUrl: shelfPhotoUrlError,
      publicShareMetaTitle: shareMetaTitleError,
      publicShareMetaDescription: shareMetaDescriptionError,
      publicShareImageUrl: shareImageUrlError,
    });

    return (
      !nameError &&
      !storeUrlError &&
      !shelfPageNameError &&
      !shelfPhotoUrlError &&
      !shareMetaTitleError &&
      !shareMetaDescriptionError &&
      !shareImageUrlError
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedData = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      storeUrl: formData.storeUrl.trim(),
      shelfPageName: formData.shelfPageName.trim(),
      shelfPhotoUrl: formData.shelfPhotoUrl.trim(),
      publicShareMetaTitle: formData.publicShareMetaTitle.trim(),
      publicShareMetaDescription: formData.publicShareMetaDescription.trim(),
      publicShareImageUrl: formData.publicShareImageUrl.trim(),
    };

    // upload avatar first if there's a new file
    if (selectedAvatarFile) {
      setIsUploadingAvatar(true);

      try {
        const avatarFormData = new FormData();
        avatarFormData.append("avatar", selectedAvatarFile);

        const { data: avatarData } = await axiosInstance.put(
          API_ENDPOINTS.PROFILE.UPLOAD_AVATAR,
          avatarFormData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        updateUser(avatarData.user);
        setSelectedAvatarFile(null);
        setHasAvatarChanged(false);

        toast.success("Avatar updated successfully!");
      } catch (error) {
        console.error("Error uploading avatar:", error?.message);

        const errorMessage =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Avatar upload failed. Please try again.";

        toast.error(errorMessage, { duration: 5000 });
        setIsUploadingAvatar(false);
        return;
      } finally {
        setIsUploadingAvatar(false);
      }
    }

    if (!validateForm(trimmedData)) {
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await axiosInstance.put(API_ENDPOINTS.PROFILE.EDIT, {
        name: trimmedData.name,
        storeUrl: trimmedData.storeUrl,
        shelfPageName: trimmedData.shelfPageName,
        shelfPhotoUrl: trimmedData.shelfPhotoUrl,
        publicShareMetaTitle: trimmedData.publicShareMetaTitle,
        publicShareMetaDescription: trimmedData.publicShareMetaDescription,
        publicShareImageUrl: trimmedData.publicShareImageUrl,
      });

      updateUser(data.user);
      setHasNameChanged(false);
      setHasStoreUrlChanged(false);
      setHasShelfPageNameChanged(false);
      setHasShelfPhotoUrlChanged(false);
      setHasShareMetaTitleChanged(false);
      setHasShareMetaDescriptionChanged(false);
      setHasShareImageUrlChanged(false);

      toast.success("Your profile has been updated successfully!", {
        duration: 5000,
      });
    } catch (error) {
      console.error("Error updating profile:", error?.message);

      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Profile update failed. Please try again.";

      toast.error(errorMessage, { duration: 5000 });

      const lowerErrorMessage = errorMessage.toLowerCase();
      let errorField = "name";

      if (lowerErrorMessage.includes("store")) {
        errorField = "storeUrl";
      } else if (lowerErrorMessage.includes("image")) {
        errorField = "publicShareImageUrl";
      } else if (lowerErrorMessage.includes("photo")) {
        errorField = "shelfPhotoUrl";
      } else if (lowerErrorMessage.includes("description")) {
        errorField = "publicShareMetaDescription";
      } else if (lowerErrorMessage.includes("title")) {
        errorField = "publicShareMetaTitle";
      } else if (lowerErrorMessage.includes("shelf")) {
        errorField = "shelfPageName";
      }

      setErrors((prev) => ({
        ...prev,
        [errorField]: errorMessage,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const isSaveDisabled =
    !hasNameChanged &&
    !hasStoreUrlChanged &&
    !hasShelfPageNameChanged &&
    !hasShelfPhotoUrlChanged &&
    !hasShareMetaTitleChanged &&
    !hasShareMetaDescriptionChanged &&
    !hasShareImageUrlChanged &&
    !hasAvatarChanged;
  const displayName = formData.name.trim() || user?.name || "Author";
  const shelfDisplayName =
    formData.shelfPageName.trim() || `${displayName}'s bookshelf`;
  const shelfPhotoPreviewUrl = resolvePreviewUrl(formData.shelfPhotoUrl);
  const shareImagePreviewUrl =
    resolvePreviewUrl(formData.publicShareImageUrl) || shelfPhotoPreviewUrl;
  const shareMetaTitle =
    formData.publicShareMetaTitle.trim() || shelfDisplayName;
  const shareMetaDescription =
    formData.publicShareMetaDescription.trim() ||
    "A short description for your shared bookshelf and book preview links.";

  return (
    <DashboardLayout>
      <main className="max-w-6xl px-4 py-6 mx-auto">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
              Profile
            </p>
            <h1 className="text-slate-950 text-2xl md:text-3xl font-black mt-2">
              Account and public links
            </h1>
            <p className="text-slate-500 text-sm mt-2 max-w-2xl">
              Keep your account identity, bookshelf page, and share-card details
              in one place.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            <Sparkles className="size-4 text-violet-600" />
            {isSaveDisabled ? "Saved" : "Unsaved changes"}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6 items-start"
        >
          <aside className="lg:sticky lg:top-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-xl shadow-slate-950/15">
            <div className="bg-[radial-gradient(circle_at_25%_10%,rgba(168,85,247,0.42),transparent_16rem),radial-gradient(circle_at_90%_20%,rgba(14,165,233,0.28),transparent_13rem)] p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative group">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Profile avatar"
                      className="size-28 object-cover rounded-2xl ring-4 ring-white/10 transition-all duration-200 group-hover:ring-white/20"
                    />
                  ) : (
                    <div className="size-28 rounded-2xl bg-white/10 ring-4 ring-white/10 flex items-center justify-center transition-all duration-200 group-hover:ring-white/20">
                      <span className="text-white text-4xl font-black">
                        {displayName.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/35 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <Camera className="size-6 text-white" />
                  </div>
                </div>

                <h2 className="text-xl font-black mt-5">{displayName}</h2>
                <p className="text-sm text-slate-300 mt-1 break-all">
                  {formData.email || user?.email}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleAvatarButtonClick}
                  disabled={isUploadingAvatar || isDeletingAvatar}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-950 px-4 py-2.5 text-sm font-bold transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="size-4" />
                  {avatarPreview ? "Change Avatar" : "Upload Avatar"}
                </button>

                {user?.avatar && (
                  <button
                    type="button"
                    onClick={handleDeleteAvatar}
                    disabled={isUploadingAvatar || isDeletingAvatar}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingAvatar ? (
                      <>
                        <div className="size-4 border-2 border-red-100 border-t-transparent rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="size-4" />
                        Remove Avatar
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="text-slate-400 text-xs leading-5 text-center mt-5">
                Square image, 200x200px or larger. Max 2MB.
              </p>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
              <SectionHeader
                icon={User2}
                eyebrow="Account"
                title="Identity"
                description="The core details used inside your workspace."
              />

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  type="text"
                  label="Full Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  icon={User2}
                  required
                  placeholder="John Doe"
                  error={errors.name}
                />

                <Input
                  type="email"
                  label="Email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  icon={Mail}
                  disabled
                  helperText="Registered email cannot be modified."
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <SectionHeader
                  icon={KeyRound}
                  eyebrow="Developer API"
                  title="API keys"
                  description="Programmatic book generation uses your account credits."
                />

                <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                  <ShieldCheck className="size-4" />
                  Same credits
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4">
                {newApiKeySecret && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                          New key
                        </p>
                        <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-900 ring-1 ring-amber-200">
                          {newApiKeySecret}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyApiKey}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
                      >
                        <Copy className="size-4" />
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                  <Input
                    type="text"
                    label="Key Name"
                    name="apiKeyName"
                    value={apiKeyName}
                    onChange={(event) => setApiKeyName(event.target.value)}
                    icon={KeyRound}
                    maxLength={80}
                    placeholder="Zapier"
                  />
                  <button
                    type="button"
                    onClick={handleCreateApiKey}
                    disabled={isCreatingApiKey}
                    className="mt-0 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:mt-7"
                  >
                    {isCreatingApiKey ? (
                      <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Create Key
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  {isLoadingApiKeys ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm font-semibold text-slate-500">
                      <div className="size-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                      Loading keys...
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <KeyRound className="mx-auto size-8 text-slate-300" />
                      <p className="mt-3 text-sm font-bold text-slate-700">
                        No active API keys
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {apiKeys.map((apiKey) => {
                        const isEditing = editingApiKeyId === apiKey.id;
                        const isRevoking = revokingApiKeyId === apiKey.id;

                        return (
                          <div
                            key={apiKey.id}
                            className="grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center"
                          >
                            <div className="min-w-0">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  label="Rename Key"
                                  name={`api-key-${apiKey.id}`}
                                  value={editingApiKeyName}
                                  onChange={(event) =>
                                    setEditingApiKeyName(event.target.value)
                                  }
                                  maxLength={80}
                                />
                              ) : (
                                <>
                                  <p className="text-sm font-black text-slate-950">
                                    {apiKey.name}
                                  </p>
                                  <p className="mt-1 break-all font-mono text-xs text-slate-500">
                                    {apiKey.maskedKey}
                                  </p>
                                  <p className="mt-2 text-xs font-medium text-slate-500">
                                    Last used {formatApiKeyDate(apiKey.lastUsedAt)}
                                  </p>
                                </>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveApiKeyName(apiKey.id)}
                                    className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                                    aria-label="Save API key name"
                                  >
                                    <Check className="size-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelRenameApiKey}
                                    className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                                    aria-label="Cancel API key rename"
                                  >
                                    <X className="size-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartRenameApiKey(apiKey)}
                                  className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                                  aria-label="Rename API key"
                                >
                                  <Pencil className="size-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRevokeApiKey(apiKey.id)}
                                disabled={isRevoking}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isRevoking ? (
                                  <div className="size-4 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                                Revoke
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
              <SectionHeader
                icon={Globe2}
                eyebrow="Public shelf"
                title="Bookshelf presence"
                description="The visible header and outbound link on shared shelf pages."
              />

              <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_18rem] gap-6">
                <div className="space-y-5">
                  <Input
                    type="text"
                    label="Store Link"
                    name="storeUrl"
                    value={formData.storeUrl}
                    onChange={handleChange}
                    icon={Store}
                    inputMode="url"
                    placeholder="https://amazon.com/author/your-page"
                    error={errors.storeUrl}
                    helperText="Optional. This appears as the store button on public preview pages."
                  />

                  <Input
                    type="text"
                    label="Shelf Page Name"
                    name="shelfPageName"
                    value={formData.shelfPageName}
                    onChange={handleChange}
                    icon={BookOpen}
                    maxLength={80}
                    placeholder="Ross's Featured Books"
                    error={errors.shelfPageName}
                    helperText="Optional. This overrides the public shelf title."
                  />

                  <Input
                    type="text"
                    label="Shelf Photo URL"
                    name="shelfPhotoUrl"
                    value={formData.shelfPhotoUrl}
                    onChange={handleChange}
                    icon={ImageIcon}
                    inputMode="url"
                    placeholder="https://example.com/shelf.png"
                    error={errors.shelfPhotoUrl}
                    helperText="Optional. A PNG, JPG, or WebP link shown at the top of your shared shelf."
                  />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="h-36 bg-slate-950 flex items-center justify-center overflow-hidden">
                    {shelfPhotoPreviewUrl ? (
                      <img
                        src={shelfPhotoPreviewUrl}
                        alt="Shelf preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="size-10 text-white/70" />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">
                      Shared Bookshelf
                    </p>
                    <h3 className="text-lg font-black text-slate-950 mt-2 leading-tight">
                      {shelfDisplayName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2">
                      {formData.storeUrl.trim()
                        ? "Store link ready"
                        : "No store link set"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
              <SectionHeader
                icon={Search}
                eyebrow="Share SEO"
                title="Link preview"
                description="The title, summary, and image shown by crawlers and social cards."
              />

              <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-6">
                <div className="space-y-5">
                  <Input
                    type="text"
                    label="Share Meta Title"
                    name="publicShareMetaTitle"
                    value={formData.publicShareMetaTitle}
                    onChange={handleChange}
                    icon={Heading}
                    maxLength={80}
                    placeholder="Ross Cohen Books"
                    error={errors.publicShareMetaTitle}
                    helperText="Optional. Used as the shelf title and preview title suffix."
                  />

                  <div className="w-full grid grid-cols-1 gap-y-2">
                    <label
                      htmlFor="publicShareMetaDescription"
                      className="text-gray-700 text-sm font-medium"
                    >
                      Share Meta Description
                    </label>
                    <div className="relative">
                      <div className="pl-3 pt-3 pointer-events-none absolute left-0 top-0">
                        <TextQuote className="size-4 text-gray-400" />
                      </div>
                      <textarea
                        id="publicShareMetaDescription"
                        name="publicShareMetaDescription"
                        value={formData.publicShareMetaDescription}
                        onChange={handleChange}
                        maxLength={180}
                        rows={4}
                        placeholder="A short description that appears in Google and social previews."
                        className={`w-full min-h-28 resize-y bg-white text-gray-900 text-sm placeholder-gray-400 pl-10 pr-3 py-3 border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
                          errors.publicShareMetaDescription
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-200 focus:border-transparent"
                        }`}
                        aria-invalid={
                          errors.publicShareMetaDescription ? "true" : "false"
                        }
                        aria-describedby={
                          errors.publicShareMetaDescription
                            ? "publicShareMetaDescription-error"
                            : "publicShareMetaDescription-helper"
                        }
                      />
                    </div>
                    {errors.publicShareMetaDescription ? (
                      <p
                        id="publicShareMetaDescription-error"
                        className="text-red-600 text-xs mt-1"
                        role="alert"
                      >
                        {errors.publicShareMetaDescription}
                      </p>
                    ) : (
                      <p
                        id="publicShareMetaDescription-helper"
                        className="text-gray-500 text-xs mt-1"
                      >
                        {formData.publicShareMetaDescription.length}/180
                        characters.
                      </p>
                    )}
                  </div>

                  <Input
                    type="text"
                    label="Share Image URL"
                    name="publicShareImageUrl"
                    value={formData.publicShareImageUrl}
                    onChange={handleChange}
                    icon={ImageIcon}
                    inputMode="url"
                    placeholder="https://example.com/share-card.png"
                    error={errors.publicShareImageUrl}
                    helperText="Optional. Best as a 1200x630 PNG for link previews."
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="aspect-[1.91/1] bg-linear-to-br from-slate-900 via-slate-800 to-violet-950 flex items-center justify-center overflow-hidden">
                    {shareImagePreviewUrl ? (
                      <img
                        src={shareImagePreviewUrl}
                        alt="Share card preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-10 text-white/70" />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Social Card
                    </p>
                    <h3 className="text-base font-black text-slate-950 mt-2 leading-tight line-clamp-2">
                      {shareMetaTitle}
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-6 line-clamp-4">
                      {shareMetaDescription}
                    </p>
                    <p className="text-xs text-slate-400 mt-4 truncate">
                      {typeof window === "undefined"
                        ? "your-domain.com"
                        : window.location.host}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-xl shadow-slate-950/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm font-medium text-slate-600">
                {isSaveDisabled
                  ? "Everything is saved."
                  : "Save changes to update public pages."}
              </p>
              <Button
                type="submit"
                isLoading={isLoading || authContextLoading || isUploadingAvatar}
                disabled={isSaveDisabled}
                className="w-full sm:w-auto"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </main>
    </DashboardLayout>
  );
}

export default ProfilePage;
