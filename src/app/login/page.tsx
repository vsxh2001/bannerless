import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/auth-helpers";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    try {
      await signIn("resend", { email, redirectTo: "/" });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/login?error=${err.type}`);
      }
      throw err; // re-throw NEXT_REDIRECT
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">
          Bannerless
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Training group sign-in
        </p>
        <Card>
          <CardBody className="space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error === "AccessDenied"
                  ? "This email isn't a registered member. Ask the admin to add you."
                  : "Something went wrong. Please try again."}
              </p>
            )}
            <form action={login} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full">
                Send me a sign-in link
              </Button>
            </form>
            <p className="text-center text-xs text-gray-400">
              We&apos;ll email you a one-tap link. No password needed.
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
