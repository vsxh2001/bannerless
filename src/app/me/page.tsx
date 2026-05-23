import { PageHeading } from "@/components/app-shell";

export default function MemberHomePage() {
  return (
    <>
      <PageHeading title="My sessions" />
      <p className="text-sm text-gray-500">Your upcoming sessions will appear here.</p>
    </>
  );
}
