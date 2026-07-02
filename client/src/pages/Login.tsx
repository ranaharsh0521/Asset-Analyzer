import { FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  QrCode,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  buildOtpAuthUrl,
  markUserTotpConfigured,
  registerUser,
  rememberLoggedInUser,
  resetUserTotpSecret,
  type StoredUser,
  validateCredentials,
  verifyTotpCode,
} from "@/lib/localAuth";

type AuthTab = "signin" | "signup";

type AuthFlow =
  | {
      kind: "setup";
      user: StoredUser;
      source: "signin" | "signup";
    }
  | {
      kind: "verify";
      user: StoredUser;
    };

function formatSecretKey(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function maskEmail(email: string) {
  const [name, domain = ""] = email.split("@");

  if (name.length <= 2) {
    return `${name[0] ?? ""}*@${domain}`;
  }

  return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [activeTab, setActiveTab] = useState<AuthTab>("signin");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [activeFlow, setActiveFlow] = useState<AuthFlow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setOtpToken("");

    if (activeFlow?.kind !== "setup") {
      setQrCodeDataUrl("");
      return;
    }

    let ignore = false;

    QRCode.toDataURL(buildOtpAuthUrl(activeFlow.user), {
      width: 280,
      margin: 1,
      color: {
        dark: "#d8fbff",
        light: "#0000",
      },
    })
      .then((url: string) => {
        if (!ignore) {
          setQrCodeDataUrl(url);
        }
      })
      .catch(() => {
        if (!ignore) {
          setQrCodeDataUrl("");
          toast({
            title: "QR code could not be generated",
            description: "The secret key is still available for manual setup in Google Authenticator.",
            variant: "destructive",
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeFlow]);

  function resetFlow() {
    setActiveFlow(null);
    setOtpToken("");
    setQrCodeDataUrl("");
    setIsSubmitting(false);
  }

  function handleTabChange(value: string) {
    setActiveTab(value as AuthTab);
    resetFlow();
  }

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signInEmail.trim() || !signInPassword) {
      toast({
        title: "Missing credentials",
        description: "Enter your email and password to continue.",
        variant: "destructive",
      });
      return;
    }

    const user = validateCredentials(signInEmail, signInPassword);

    if (!user) {
      toast({
        title: "Login failed",
        description: "The email or password does not match any local account.",
        variant: "destructive",
      });
      return;
    }

    setSignInPassword("");
    setActiveFlow(
      user.otpConfiguredAt
        ? {
            kind: "verify",
            user,
          }
        : {
            kind: "setup",
            user,
            source: "signin",
          },
    );

    toast({
      title: user.otpConfiguredAt ? "Authenticator check required" : "Set up Google Authenticator",
      description: user.otpConfiguredAt
        ? "Enter the 6-digit code from your authenticator app."
        : "Scan the QR code once, verify the code, and your next logins will ask only for TOTP.",
    });
  }

  function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword || !confirmPassword) {
      toast({
        title: "Incomplete sign up",
        description: "Fill in your name, email, and password before creating the account.",
        variant: "destructive",
      });
      return;
    }

    if (signUpPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters so the local account is not trivially weak.",
        variant: "destructive",
      });
      return;
    }

    if (signUpPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Re-enter the same password in both fields.",
        variant: "destructive",
      });
      return;
    }

    const result = registerUser({
      name: signUpName,
      email: signUpEmail,
      password: signUpPassword,
    });

    if ("error" in result) {
      toast({
        title: "Sign up failed",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setActiveFlow({
      kind: "setup",
      user: result.user,
      source: "signup",
    });
    setSignUpPassword("");
    setConfirmPassword("");

    toast({
      title: "Account created",
      description: "Scan the QR code in Google Authenticator, then enter the 6-digit code to finish setup.",
    });
  }

  async function copySecretKey() {
    if (activeFlow?.kind !== "setup") {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeFlow.user.otpSecret);
      toast({
        title: "Secret key copied",
        description: "Paste it into Google Authenticator if you prefer manual setup.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access is unavailable, so use the key shown on the page.",
        variant: "destructive",
      });
    }
  }

  function regenerateSecret() {
    if (activeFlow?.kind !== "setup") {
      return;
    }

    const updatedUser = resetUserTotpSecret(activeFlow.user.email);

    if (!updatedUser) {
      toast({
        title: "Could not refresh the key",
        description: "The local account could not be updated. Try starting the flow again.",
        variant: "destructive",
      });
      return;
    }

    setActiveFlow({
      ...activeFlow,
      user: updatedUser,
    });

    toast({
      title: "New authenticator key generated",
      description: "Scan the refreshed QR code and use the new 6-digit code.",
    });
  }

  function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeFlow) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (!verifyTotpCode(activeFlow.user, otpToken)) {
        toast({
          title: "Invalid authenticator code",
          description: "Check the current 6-digit code in Google Authenticator and try again.",
          variant: "destructive",
        });
        return;
      }

      const authenticatedUser =
        activeFlow.kind === "setup"
          ? markUserTotpConfigured(activeFlow.user.email)
          : activeFlow.user;

      if (!authenticatedUser) {
        toast({
          title: "Authentication failed",
          description: "The user record could not be finalized locally.",
          variant: "destructive",
        });
        return;
      }

      rememberLoggedInUser(authenticatedUser.email);
      toast({
        title: activeFlow.kind === "setup" ? "Two-step verification enabled" : "Login verified",
        description:
          activeFlow.kind === "setup"
            ? "Google Authenticator is now linked to this account."
            : "The current TOTP code was accepted.",
      });
      onLogin();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_26%),radial-gradient(circle_at_80%_15%,rgba(59,130,246,0.1),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.86),rgba(2,8,18,1))]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <section className="panel-card relative overflow-hidden p-6 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />

            <div className="relative space-y-8">
              <div className="space-y-4">
                <div className="page-kicker">Secure Access Layer</div>
                <div className="max-w-2xl space-y-4">
                  <h1 className="text-4xl font-semibold text-white sm:text-5xl">
                    GNN-IDS operator access with one-time Google Authenticator setup.
                  </h1>
                  <p className="max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                    New accounts receive a fresh secret key and QR code. Existing accounts verify
                    with a 6-digit TOTP code, and accounts that never finished setup can scan the QR
                    once before entering the dashboard.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="panel-subtle space-y-3 p-4">
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                  <div className="space-y-1">
                    <div className="font-mono text-sm uppercase tracking-[0.16em] text-slate-100">
                      Step 1
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                      Sign in or sign up with the local account stored in this project.
                    </p>
                  </div>
                </div>

                <div className="panel-subtle space-y-3 p-4">
                  <QrCode className="h-5 w-5 text-cyan-300" />
                  <div className="space-y-1">
                    <div className="font-mono text-sm uppercase tracking-[0.16em] text-slate-100">
                      Step 2
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                      Scan the QR once in Google Authenticator or enter the secret key manually.
                    </p>
                  </div>
                </div>

                <div className="panel-subtle space-y-3 p-4">
                  <Fingerprint className="h-5 w-5 text-cyan-300" />
                  <div className="space-y-1">
                    <div className="font-mono text-sm uppercase tracking-[0.16em] text-slate-100">
                      Step 3
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                      Enter the live 6-digit code and continue into Mission Control.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="panel-subtle space-y-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
                      <LockKeyhole className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-mono text-sm uppercase tracking-[0.16em] text-slate-100">
                        Demo Account
                      </div>
                      <div className="text-xs text-slate-400">
                        Useful for testing the new 2-step flow quickly.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-200">
                    <div>
                      Email: <span className="font-mono text-cyan-200">analyst@security.local</span>
                    </div>
                    <div>
                      Password: <span className="font-mono text-cyan-200">password123</span>
                    </div>
                    <div className="text-xs leading-5 text-slate-400">
                      On the first successful password check, the page will show a QR code so the
                      seeded user can finish Google Authenticator enrollment.
                    </div>
                  </div>
                </div>

                <div className="panel-subtle p-5">
                  <div className="space-y-3">
                    <div className="font-mono text-sm uppercase tracking-[0.16em] text-slate-100">
                      Project Read
                    </div>
                    <p className="text-sm leading-7 text-slate-300">
                      This project currently keeps authentication entirely in browser storage, so the
                      new 2-step flow is local to this frontend. It is a good prototype for the QR,
                      secret-key, and TOTP experience, but production security should move these
                      checks to the server and hash passwords instead of storing them in plain text.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel-card overflow-hidden p-6 sm:p-8">
            {!activeFlow ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="font-mono text-sm uppercase tracking-[0.16em] text-cyan-200">
                    Identity Checkpoint
                  </div>
                  <h2 className="text-2xl font-semibold text-white">Access the operator console</h2>
                  <p className="text-sm leading-6 text-slate-400">
                    Sign in with an existing account or create a new one. A fresh QR code is
                    generated for every new signup.
                  </p>
                </div>

                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                  <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-white/6 p-1">
                    <TabsTrigger value="signin" className="rounded-xl py-2.5">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-xl py-2.5">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin" className="mt-0">
                    <form className="space-y-5" onSubmit={handleSignIn}>
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Email</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          autoComplete="email"
                          placeholder="analyst@security.local"
                          value={signInEmail}
                          onChange={(event) => setSignInEmail(event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Password</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          value={signInPassword}
                          onChange={(event) => setSignInPassword(event.target.value)}
                        />
                      </div>

                      <Button className="w-full" size="lg" type="submit">
                        Continue to 2-step verification
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-0">
                    <form className="space-y-5" onSubmit={handleSignUp}>
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full name</Label>
                        <Input
                          id="signup-name"
                          autoComplete="name"
                          placeholder="Security Analyst"
                          value={signUpName}
                          onChange={(event) => setSignUpName(event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={signUpEmail}
                          onChange={(event) => setSignUpEmail(event.target.value)}
                        />
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <Input
                            id="signup-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                            value={signUpPassword}
                            onChange={(event) => setSignUpPassword(event.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-confirm-password">Confirm password</Label>
                          <Input
                            id="signup-confirm-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Repeat password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                          />
                        </div>
                      </div>

                      <Button className="w-full" size="lg" type="submit">
                        Create account and generate QR
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={resetFlow}
                  className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to account form
                </button>

                <div className="space-y-2">
                  <div className="font-mono text-sm uppercase tracking-[0.16em] text-cyan-200">
                    {activeFlow.kind === "setup" ? "Authenticator Setup" : "Authenticator Check"}
                  </div>
                  <h2 className="text-2xl font-semibold text-white">
                    {activeFlow.kind === "setup"
                      ? "Link Google Authenticator to this account"
                      : "Enter the current 6-digit code"}
                  </h2>
                  <p className="text-sm leading-6 text-slate-400">
                    {activeFlow.kind === "setup"
                      ? activeFlow.source === "signup"
                        ? "This signup generated a fresh secret key. Scan the QR code once, then verify the live code."
                        : "This account has not completed 2-step verification yet. Scan the QR once, then continue."
                      : `Use the code from Google Authenticator for ${maskEmail(activeFlow.user.email)}.`}
                  </p>
                </div>

                {activeFlow.kind === "setup" ? (
                  <div className="space-y-5">
                    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                      <div className="panel-subtle flex min-h-[260px] items-center justify-center p-5">
                        {qrCodeDataUrl ? (
                          <img
                            src={qrCodeDataUrl}
                            alt={`QR code for ${activeFlow.user.email}`}
                            className="w-full max-w-[250px] rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                          />
                        ) : (
                          <div className="flex h-full min-h-[220px] w-full items-center justify-center rounded-3xl border border-dashed border-white/12 bg-black/20 text-sm text-slate-500">
                            Generating QR code...
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="panel-subtle space-y-3 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                            <KeyRound className="h-4 w-4 text-cyan-300" />
                            Manual secret key
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 font-mono text-sm tracking-[0.22em] text-cyan-100">
                            {formatSecretKey(activeFlow.user.otpSecret)}
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <Button type="button" variant="secondary" onClick={copySecretKey}>
                              <Copy className="h-4 w-4" />
                              Copy key
                            </Button>
                            <Button type="button" variant="outline" onClick={regenerateSecret}>
                              <RefreshCcw className="h-4 w-4" />
                              Generate new key
                            </Button>
                          </div>
                        </div>

                        <div className="panel-subtle space-y-3 p-4 text-sm leading-6 text-slate-300">
                          <div className="flex items-center gap-2 font-medium text-slate-100">
                            <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                            Setup notes
                          </div>
                          <p>Open Google Authenticator, tap add account, and scan the QR code.</p>
                          <p>
                            If scanning is unavailable, choose manual entry and use the secret key
                            shown above.
                          </p>
                          <p>Enter the current 6-digit code below to finish linking this account.</p>
                        </div>
                      </div>
                    </div>

                    <form className="space-y-5" onSubmit={handleOtpSubmit}>
                      <div className="space-y-3">
                        <Label htmlFor="setup-otp">Authenticator code</Label>
                        <InputOTP
                          id="setup-otp"
                          maxLength={6}
                          value={otpToken}
                          onChange={setOtpToken}
                          containerClassName="justify-center sm:justify-start"
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>

                      <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
                        Finish setup and enter dashboard
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="panel-subtle space-y-4 p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-100">
                            Account ready for 2-step verification
                          </div>
                          <div className="text-xs text-slate-400">{maskEmail(activeFlow.user.email)}</div>
                        </div>
                      </div>

                      <p className="text-sm leading-6 text-slate-300">
                        The QR code is intentionally hidden after setup. Use the latest 6-digit code
                        from Google Authenticator to continue.
                      </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleOtpSubmit}>
                      <div className="space-y-3">
                        <Label htmlFor="verify-otp">Authenticator code</Label>
                        <InputOTP
                          id="verify-otp"
                          maxLength={6}
                          value={otpToken}
                          onChange={setOtpToken}
                          containerClassName="justify-center sm:justify-start"
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>

                      <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
                        Verify code and continue
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
