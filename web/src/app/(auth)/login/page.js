import { signInDemo } from "@/app/actions/auth-actions";
import { Button } from "@/components/shared";
import { Card } from "@/components/shared";
import { getPageMetadata } from "@/config/metadata";

export const metadata = getPageMetadata({
  title: "Sign In",
  description: "Sign in to Baseline Arena to manage your pickleball court bookings, view transactions, and redeem rewards.",
  path: "/login",
  isPrivate: true,
});

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = params?.next || "/dashboard";

  return (
    <main className="sm:mx-auto sm:w-full sm:max-w-md px-6">
      <Card className="p-8">
        <h1 className="text-4xl font-black">Choose a demo role</h1>
        <p className="mt-4 text-muted">
          This front-end build uses secure HTTP-only role cookies for route
          demonstration. Production auth plugs into the backend OTP/JWT flow.
        </p>
        <form action={signInDemo} className="mt-7 grid gap-4">
          <input type="hidden" name="next" value={next} />
          <label className="grid gap-2 text-sm font-bold text-muted">
            Role
            <select name="role" className="rounded-lg border border-line bg-background p-3 text-foreground">
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
          <Button type="submit" className="w-full justify-center">Continue</Button>
        </form>
      </Card>
    </main>
  );
}
