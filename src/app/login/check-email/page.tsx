import Link from "next/link";
import { Card, CardBody } from "@/components/ui";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Card>
          <CardBody className="space-y-3 py-8">
            <h1 className="text-xl font-semibold text-gray-900">
              Check your email
            </h1>
            <p className="text-sm text-gray-500">
              We sent you a sign-in link. Open it on this device to continue.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm text-indigo-600 hover:underline"
            >
              Back to sign-in
            </Link>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
